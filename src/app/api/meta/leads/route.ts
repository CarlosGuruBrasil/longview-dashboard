/**
 * /api/meta/leads
 *
 * GET → leads dos formulários Meta + cruzamento automático com CVCRM
 *   ?form_id=xxx    → leads de formulário específico
 *   ?since=YYYY-MM-DD → filtro por data
 *   ?refresh=true   → ignora cache
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { kv } from '@/lib/kv';
import axios from 'axios';
import logger from '@/lib/logger'

const META_BASE = 'https://graph.facebook.com/v21.0';
const PAGE_ID   = '259079394232614';
const ACT_ID    = process.env.META_ACT_ID;
const CACHE_TTL = 900; // 15 min

type MetaPageTokenResponse = { access_token?: string };
type MetaListResponse<T> = { data?: T[] };
type MetaLeadForm = Record<string, unknown> & {
  id: string;
  name?: string;
  status?: string;
};
type MetaLeadField = {
  name?: string;
  values?: string[];
};
type MetaLead = Record<string, unknown> & {
  id?: string;
  field_data?: MetaLeadField[];
};
type MetaLeadWithForm = MetaLead & {
  _form_name?: string;
  _crm_match?: CrmMatch | null;
};
type CrmLead = Record<string, unknown> & {
  id?: string | number;
  nome?: string;
  telefone?: string;
  email?: string;
  situacao?: { nome?: string };
  etapa?: { nome?: string };
  corretor?: { nome?: string };
  valor_negocio?: unknown;
  data_cad?: unknown;
};
type CrmLeadsResponse = { leads?: CrmLead[] };
type CrmMatch = {
  id: string | number | undefined;
  nome: string | undefined;
  situacao: string;
  etapa: string;
  corretor: string;
  valor: unknown;
  data_cad: unknown;
  link: string;
};
type LeadsByForm = {
  form_id: string;
  form_name: string | undefined;
  leads: MetaLead[];
  _error?: boolean;
};
type MetaLeadsResult = {
  forms: MetaLeadForm[];
  leads: MetaLeadWithForm[];
  leads_by_form: LeadsByForm[];
  total_leads: number;
  crm_stats: {
    total_crm_leads: number;
    matched: number;
    not_matched: number;
    match_rate: number;
  };
  updatedAt: string;
};
type MetaErrorData = { error?: { message?: string } };

function metaAuth() {
  return { access_token: process.env.META_TOKEN };
}

function errorMessage(err: unknown): string {
  if (axios.isAxiosError<MetaErrorData>(err)) {
    return err.response?.data?.error?.message ?? err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

function errorData(err: unknown): unknown {
  return axios.isAxiosError(err) ? err.response?.data ?? err.message : errorMessage(err);
}

function leadFieldValue(fields: MetaLeadField[], keys: string[]): string {
  return fields.find(f => keys.some(k => (f.name || '').toLowerCase().includes(k)))?.values?.[0] ?? '';
}

// Buscar page access token dinamicamente (necessário para leadgen_forms)
async function getPageAccessToken(): Promise<string | null> {
  try {
    const res = await axios.get<MetaPageTokenResponse>(`${META_BASE}/${PAGE_ID}`, {
      params: { fields: 'access_token', ...metaAuth() },
      timeout: 10000,
    });
    return res.data.access_token || null;
  } catch {
    return null;
  }
}

// Buscar formulários de leads — tenta via página, fallback via ad account
async function fetchLeadForms(pageToken: string | null): Promise<MetaLeadForm[]> {
  const token = pageToken || process.env.META_TOKEN;

  // Tentativa 1: via página com page token
  try {
    const res = await axios.get<MetaListResponse<MetaLeadForm>>(`${META_BASE}/${PAGE_ID}/leadgen_forms`, {
      params: { fields: 'id,name,status,leads_count,created_time,questions', limit: 100, access_token: token },
      timeout: 15000,
    });
    const forms = res.data.data ?? [];
    if (forms.length >= 0) return forms; // retorna mesmo se vazio
  } catch (err: unknown) {
    logger.warn({ err: errorMessage(err) }, '[meta/leads] leadgen_forms via página falhou:');
  }

  // Tentativa 2: via ad account
  try {
    const res = await axios.get<MetaListResponse<MetaLeadForm>>(`${META_BASE}/${ACT_ID}/leadgen_forms`, {
      params: { fields: 'id,name,status,leads_count,created_time,questions', limit: 100, ...metaAuth() },
      timeout: 15000,
    });
    return res.data.data ?? [];
  } catch (err: unknown) {
    logger.warn({ err: errorMessage(err) }, '[meta/leads] leadgen_forms via ad account falhou:');
  }

  return [];
}

// Cruzar lead Meta com leads do CRM por nome/telefone/email
function crossMatchWithCRM(metaLead: MetaLead, crmLeads: CrmLead[]): CrmLead | null {
  const fd = metaLead.field_data || [];
  const getName  = (keys: string[]) => leadFieldValue(fd, keys).toLowerCase().trim();
  const getPhone = (keys: string[]) => leadFieldValue(fd, keys).replace(/\D/g, '');
  const getEmail = (keys: string[]) => leadFieldValue(fd, keys).toLowerCase().trim();

  const metaNome  = getName(['name', 'nome', 'full_name']);
  const metaTel   = getPhone(['phone', 'telefone', 'cel', 'whatsapp']);
  const metaEmail = getEmail(['email', 'e-mail']);

  if (!metaNome && !metaTel && !metaEmail) return null;

  return crmLeads.find(crm => {
    // Match por telefone (mais confiável)
    if (metaTel && crm.telefone) {
      const crmTel = crm.telefone.replace(/\D/g, '');
      if (metaTel.length >= 8 && crmTel.endsWith(metaTel.slice(-8))) return true;
    }
    // Match por email
    if (metaEmail && crm.email && metaEmail === crm.email.toLowerCase().trim()) return true;
    // Match por nome (fuzzy)
    if (metaNome && crm.nome) {
      const crmNome = crm.nome.toLowerCase().trim();
      if (metaNome.length > 3 && crmNome.includes(metaNome.split(' ')[0])) return true;
    }
    return false;
  }) || null;
}

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const ip = getClientIp(request);
  const rl = await rateLimit(`meta_leads:${ip}`, 20, 60);
  if (!rl.success) return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 });

  const { searchParams } = new URL(request.url);
  const formId       = searchParams.get('form_id');
  const since        = searchParams.get('since');
  const forceRefresh = searchParams.get('refresh') === 'true';

  const cacheKey = `meta_leads_${formId ?? 'all'}_${since ?? 'all'}`;

  if (!forceRefresh) {
    try {
      const cached = await kv.get<MetaLeadsResult>(cacheKey);
      if (cached) return NextResponse.json({ ...cached, _cached: true });
    } catch { /* non-critical */ }
  }

  // 1. Buscar page access token
  const pageToken = await getPageAccessToken();
  const tokenUsed = pageToken || process.env.META_TOKEN;

  // 2. Buscar formulários
  const forms = await fetchLeadForms(pageToken);

  // 3. Buscar leads do CRM para cruzamento
  let crmLeads: CrmLead[] = [];
  try {
    const crmRes = await axios.get<CrmLeadsResponse>('https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads', {
      params: { limit: 200, offset: 0 },
      headers: { email: process.env.CV_CRM_EMAIL, token: process.env.CV_CRM_TOKEN, Accept: 'application/json' },
      timeout: 15000,
    });
    crmLeads = crmRes.data?.leads || [];
  } catch (err: unknown) {
    logger.warn({ err: errorMessage(err) }, '[meta/leads] CRM leads falhou:');
  }

  // 4. Buscar leads dos formulários
  let allMetaLeads: MetaLeadWithForm[] = [];
  let leadsPerForm: LeadsByForm[] = [];

  try {
    if (formId) {
      // Formulário específico
      const leadsRes = await axios.get<MetaListResponse<MetaLead>>(`${META_BASE}/${formId}/leads`, {
        params: {
          fields: 'id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id',
          limit: 500,
          access_token: tokenUsed,
          ...(since ? { filtering: JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: Math.floor(new Date(since).getTime() / 1000) }]) } : {}),
        },
        timeout: 20000,
      });
      allMetaLeads = leadsRes.data.data ?? [];
    } else {
      // Todos os formulários ativos (máx 5 mais recentes)
      const activeForms = forms.filter(f => f.status !== 'ARCHIVED').slice(0, 5);
      const promises = activeForms.map((form) =>
        axios.get<MetaListResponse<MetaLead>>(`${META_BASE}/${form.id}/leads`, {
          params: {
            fields: 'id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id',
            limit: 200,
            access_token: tokenUsed,
          },
          timeout: 20000,
        }).then((r): LeadsByForm => ({ form_id: form.id, form_name: form.name, leads: r.data?.data ?? [] }))
          .catch((err: unknown): LeadsByForm => {
            logger.warn({ err: errorMessage(err) }, '[meta/leads] Form $ falhou:');
            return { form_id: form.id, form_name: form.name, leads: [], _error: true };
          })
      );
      leadsPerForm   = await Promise.all(promises);
      allMetaLeads   = leadsPerForm.flatMap((f) => f.leads.map((l) => ({ ...l, _form_name: f.form_name })));
    }
  } catch (err: unknown) {
    logger.error({ err: errorData(err) }, '[meta/leads] Erro ao buscar leads:');
  }

  // 5. Cruzar leads Meta com CRM
  const leadsComCruzamento = allMetaLeads.map((lead): MetaLeadWithForm => {
    const crmMatch = crossMatchWithCRM(lead, crmLeads);
    return {
      ...lead,
      _crm_match: crmMatch ? {
        id:         crmMatch.id,
        nome:       crmMatch.nome,
        situacao:   crmMatch.situacao?.nome || '—',
        etapa:      crmMatch.etapa?.nome   || '—',
        corretor:   crmMatch.corretor?.nome || '—',
        valor:      crmMatch.valor_negocio  || null,
        data_cad:   crmMatch.data_cad       || null,
        link:       `https://longviewempreendimentos.cvcrm.com.br/comercial/leads/${crmMatch.id}`,
      } : null,
    };
  });

  const matchCount   = leadsComCruzamento.filter((l) => l._crm_match).length;
  const noMatchCount = leadsComCruzamento.length - matchCount;

  const result: MetaLeadsResult = {
    forms,
    leads:         leadsComCruzamento,
    leads_by_form: leadsPerForm,
    total_leads:   leadsComCruzamento.length,
    crm_stats: {
      total_crm_leads:    crmLeads.length,
      matched:            matchCount,
      not_matched:        noMatchCount,
      match_rate:         leadsComCruzamento.length > 0 ? Math.round((matchCount / leadsComCruzamento.length) * 100) : 0,
    },
    updatedAt: new Date().toISOString(),
  };

  try { await kv.set(cacheKey, result, { ex: CACHE_TTL }); } catch { /* non-critical */ }
  return NextResponse.json(result);
}
