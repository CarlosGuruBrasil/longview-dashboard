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
import { kv } from '@vercel/kv';
import axios from 'axios';

const META_BASE = 'https://graph.facebook.com/v21.0';
const PAGE_ID   = '259079394232614';
const ACT_ID    = process.env.META_ACT_ID;
const CACHE_TTL = 900; // 15 min

function metaAuth() {
  return { access_token: process.env.META_TOKEN };
}

// Buscar page access token dinamicamente (necessário para leadgen_forms)
async function getPageAccessToken(): Promise<string | null> {
  try {
    const res = await axios.get(`${META_BASE}/${PAGE_ID}`, {
      params: { fields: 'access_token', ...metaAuth() },
      timeout: 10000,
    });
    return (res as any).data?.access_token || null;
  } catch {
    return null;
  }
}

// Buscar formulários de leads — tenta via página, fallback via ad account
async function fetchLeadForms(pageToken: string | null): Promise<any[]> {
  const token = pageToken || process.env.META_TOKEN;

  // Tentativa 1: via página com page token
  try {
    const res = await axios.get(`${META_BASE}/${PAGE_ID}/leadgen_forms`, {
      params: { fields: 'id,name,status,leads_count,created_time,questions', limit: 100, access_token: token },
      timeout: 15000,
    });
    const forms = (res as any).data?.data ?? [];
    if (forms.length >= 0) return forms; // retorna mesmo se vazio
  } catch (err: any) {
    console.warn('[meta/leads] leadgen_forms via página falhou:', err.response?.data?.error?.message);
  }

  // Tentativa 2: via ad account
  try {
    const res = await axios.get(`${META_BASE}/${ACT_ID}/leadgen_forms`, {
      params: { fields: 'id,name,status,leads_count,created_time,questions', limit: 100, ...metaAuth() },
      timeout: 15000,
    });
    return (res as any).data?.data ?? [];
  } catch (err: any) {
    console.warn('[meta/leads] leadgen_forms via ad account falhou:', err.response?.data?.error?.message);
  }

  return [];
}

// Cruzar lead Meta com leads do CRM por nome/telefone/email
function crossMatchWithCRM(metaLead: any, crmLeads: any[]): any | null {
  const fd = metaLead.field_data || [];
  const getName  = (keys: string[]) => fd.find((f: any) => keys.some((k: string) => (f.name || '').toLowerCase().includes(k)))?.values?.[0]?.toLowerCase()?.trim() || '';
  const getPhone = (keys: string[]) => (fd.find((f: any) => keys.some((k: string) => (f.name || '').toLowerCase().includes(k)))?.values?.[0] || '').replace(/\D/g, '');
  const getEmail = (keys: string[]) => fd.find((f: any) => keys.some((k: string) => (f.name || '').toLowerCase().includes(k)))?.values?.[0]?.toLowerCase()?.trim() || '';

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
      const cached = await kv.get<any>(cacheKey);
      if (cached) return NextResponse.json({ ...cached, _cached: true });
    } catch { /* non-critical */ }
  }

  // 1. Buscar page access token
  const pageToken = await getPageAccessToken();
  const tokenUsed = pageToken || process.env.META_TOKEN;

  // 2. Buscar formulários
  const forms = await fetchLeadForms(pageToken);

  // 3. Buscar leads do CRM para cruzamento
  let crmLeads: any[] = [];
  try {
    const crmRes = await axios.get('https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads', {
      params: { limit: 200, offset: 0 },
      headers: { email: process.env.CV_CRM_EMAIL, token: process.env.CV_CRM_TOKEN, Accept: 'application/json' },
      timeout: 15000,
    });
    crmLeads = crmRes.data?.leads || [];
  } catch (err: any) {
    console.warn('[meta/leads] CRM leads falhou:', err.message);
  }

  // 4. Buscar leads dos formulários
  let allMetaLeads: any[] = [];
  let leadsPerForm: any[] = [];

  try {
    if (formId) {
      // Formulário específico
      const leadsRes = await axios.get(`${META_BASE}/${formId}/leads`, {
        params: {
          fields: 'id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id',
          limit: 500,
          access_token: tokenUsed,
          ...(since ? { filtering: JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: Math.floor(new Date(since).getTime() / 1000) }]) } : {}),
        },
        timeout: 20000,
      });
      allMetaLeads = (leadsRes as any).data?.data ?? [];
    } else {
      // Todos os formulários ativos (máx 5 mais recentes)
      const activeForms = forms.filter((f: any) => f.status !== 'ARCHIVED').slice(0, 5);
      const promises = activeForms.map((form: any) =>
        axios.get(`${META_BASE}/${form.id}/leads`, {
          params: {
            fields: 'id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id',
            limit: 200,
            access_token: tokenUsed,
          },
          timeout: 20000,
        }).then((r: any) => ({ form_id: form.id, form_name: form.name, leads: r.data?.data ?? [] }))
          .catch((err: any) => {
            console.warn(`[meta/leads] Form ${form.id} falhou:`, err.response?.data?.error?.message);
            return { form_id: form.id, form_name: form.name, leads: [], _error: true };
          })
      );
      leadsPerForm   = await Promise.all(promises);
      allMetaLeads   = leadsPerForm.flatMap((f: any) => f.leads.map((l: any) => ({ ...l, _form_name: f.form_name })));
    }
  } catch (err: any) {
    console.error('[meta/leads] Erro ao buscar leads:', err.response?.data || err.message);
  }

  // 5. Cruzar leads Meta com CRM
  const leadsComCruzamento = allMetaLeads.map((lead: any) => {
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

  const matchCount   = leadsComCruzamento.filter((l: any) => l._crm_match).length;
  const noMatchCount = leadsComCruzamento.length - matchCount;

  const result = {
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
