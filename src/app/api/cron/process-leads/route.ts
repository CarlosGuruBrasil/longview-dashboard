/**
 * /api/cron/process-leads
 *
 * Cron a cada 2 horas — processa automaticamente novos leads dos formulários Meta.
 *
 * Fluxo por lead novo:
 *   1. Busca leads Meta capturados desde o último processamento
 *   2. Para cada lead novo:
 *      a. Calcula score de intenção (match CRM + dados Meta)
 *      b. Cria/atualiza contato no RD Station com dados + score + temperatura
 *      c. Envia evento CAPI 'Lead' para o pixel Meta (loop de feedback)
 *   3. Atualiza timestamp do último processamento no KV
 *   4. Registra estatísticas no KV para monitoramento
 */
import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import axios from 'axios';
import { sendCAPIEvents, type CAPIEvent } from '@/app/api/meta/capi/route';
import logger from '@/lib/logger'

const META_BASE = 'https://graph.facebook.com/v21.0';
const PAGE_ID   = '259079394232614';

type MetaForm = { id: string; name: string; status: string };
type MetaFieldDatum = { name?: string; values?: string[] };
type MetaLead = {
  id: string;
  created_time: string;
  field_data?: MetaFieldDatum[];
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  form_id?: string;
  _form_name?: string;
};
type ProcessStats = {
  startedAt: string;
  finishedAt?: string;
  error?: string;
  newLeads: number;
  sentToRD: number;
  capiSent: number;
  errors: number;
  ok: boolean;
};

function metaAuth() {
  return { access_token: process.env.META_TOKEN };
}

function isCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const auth       = request.headers.get('Authorization') || '';
  if (!cronSecret) return false; // fail-safe
  return auth === `Bearer ${cronSecret}`;
}

// Pega page token para ler leadgen
async function getPageToken(): Promise<string> {
  try {
    const res = await axios.get<{ access_token?: string }>(`${META_BASE}/${PAGE_ID}`, {
      params: { fields: 'access_token', ...metaAuth() }, timeout: 10000,
    });
    return res.data?.access_token || process.env.META_TOKEN || '';
  } catch {
    return process.env.META_TOKEN || '';
  }
}

// Busca formulários
async function fetchForms(pageToken: string): Promise<MetaForm[]> {
  try {
    const res = await axios.get<{ data?: MetaForm[] }>(`${META_BASE}/${PAGE_ID}/leadgen_forms`, {
      params: { fields: 'id,name,status', limit: 50, access_token: pageToken },
      timeout: 15000,
    });
    return (res.data?.data || []).filter(f => f.status !== 'ARCHIVED');
  } catch {
    return [];
  }
}

// Busca leads de um formulário desde determinado timestamp
async function fetchLeadsFromForm(formId: string, since: number, pageToken: string): Promise<MetaLead[]> {
  const leads: MetaLead[] = [];
  let cursor: string | null = null;

  do {
    const params: Record<string, string | number> = {
      fields: 'id,created_time,field_data,ad_id,adset_id,campaign_id,form_id',
      limit:  100,
      access_token: pageToken,
      filtering: JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: since }]),
    };
    if (cursor) params.after = cursor;

    try {
      const res = await axios.get<{ data?: MetaLead[]; paging?: { cursors?: { after?: string }; next?: string } }>(
        `${META_BASE}/${formId}/leads`, { params, timeout: 15000 }
      );
      leads.push(...(res.data?.data || []));
      cursor = res.data?.paging?.cursors?.after || null;
      const hasNext = !!res.data?.paging?.next;
      if (!hasNext) break;
    } catch {
      break;
    }
  } while (leads.length < 500); // cap

  return leads;
}

// Extrai campos do lead Meta
function extractField(fieldData: MetaFieldDatum[], keys: string[]): string {
  const entry = fieldData.find(f => keys.some(k => (f.name || '').toLowerCase().includes(k)));
  return entry?.values?.[0] || '';
}

// Calcula score básico para um lead recém-capturado (sem dados CRM ainda)
function calcInitialScore(lead: MetaLead): number {
  let score = 15; // +15 por ser lead ad Meta
  const fields = lead.field_data || [];
  const phone = extractField(fields, ['phone', 'telefone', 'cel', 'whatsapp']);
  const email = extractField(fields, ['email', 'e-mail']);
  if (phone) score += 5;  // +5 telefone válido
  if (email) score += 5;  // +5 email preenchido
  return Math.min(score, 100);
}

function getTier(score: number) {
  if (score >= 75) return { label: 'quente', conversion_id: 'lead_quente_longview' };
  if (score >= 40) return { label: 'morno',  conversion_id: 'lead_morno_longview'  };
  return             { label: 'frio',   conversion_id: 'lead_frio_longview'   };
}

// Envia lead para o RD Station
async function sendToRD(lead: MetaLead, score: number): Promise<boolean> {
  const apiKey = process.env.RD_TOKEN_PUBLIC;
  if (!apiKey) return false;

  const fields  = lead.field_data || [];
  const nome    = extractField(fields, ['name', 'nome', 'full_name']);
  const email   = extractField(fields, ['email', 'e-mail']);
  const phone   = extractField(fields, ['phone', 'telefone', 'cel', 'whatsapp']);

  if (!email && !phone) return false;

  const tier    = getTier(score);

  const payload: Record<string, unknown> = {
    conversion_identifier: tier.conversion_id,
    cf_score_intencao:    String(score),
    cf_temperatura_lead:  tier.label,
    cf_origem_captacao:   'meta_ads_form',
    cf_data_score:        new Date().toISOString().split('T')[0],
    tags:                 [`score_${tier.label}`, 'meta_form', 'auto_captured'],
    available_for_mailing: true,
    legal_bases: [{ category: 'communications', type: 'consent', status: 'granted' }],
  };
  if (email) payload.email          = email;
  if (nome)  payload.name           = nome;
  if (phone) payload.personal_phone = phone;

  try {
    await axios.post(
      'https://api.rd.services/platform/conversions',
      { event_type: 'CONVERSION', event_family: 'CDP', payload },
      { params: { api_key: apiKey }, timeout: 15000 }
    );
    return true;
  } catch (err) {
    logger.warn({ err: axios.isAxiosError(err) ? err.response?.data?.error ?? err.message : err }, '[process-leads] RD error');
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const log: string[]  = [];
  const stats: ProcessStats = { startedAt, newLeads: 0, sentToRD: 0, capiSent: 0, errors: 0, ok: false };

  try {
    // Timestamp da última execução (padrão: 2h atrás)
    const lastFetch = await kv.get<number>('meta:leads:lastFetch') || (Math.floor(Date.now() / 1000) - 7200);
    const since     = lastFetch;
    const nowUnix   = Math.floor(Date.now() / 1000);

    log.push(`[META] Buscando leads novos desde ${new Date(since * 1000).toISOString()}`);

    const pageToken = await getPageToken();
    const forms     = await fetchForms(pageToken);
    log.push(`[META] ${forms.length} formulários ativos`);

    // IDs já processados (set persistido no KV)
    const processedSet: Set<string> = new Set(
      (await kv.get<string[]>('meta:leads:processed')) || []
    );

    const newLeads: MetaLead[] = [];
    for (const form of forms) {
      const leads = await fetchLeadsFromForm(form.id, since, pageToken);
      for (const lead of leads) {
        if (!processedSet.has(lead.id)) {
          newLeads.push({ ...lead, _form_name: form.name });
        }
      }
    }

    log.push(`[META] ${newLeads.length} leads novos encontrados`);
    stats.newLeads = newLeads.length;

    if (newLeads.length === 0) {
      stats.ok = true;
      stats.finishedAt = new Date().toISOString();
      await kv.set('meta:leads:lastFetch', nowUnix);
      await kv.set('meta:leads:lastRun', stats.finishedAt);
      await kv.set('meta:leads:lastStats', stats);
      return NextResponse.json(stats);
    }

    // Processa cada lead novo
    const capiEvents: CAPIEvent[] = [];

    for (const lead of newLeads) {
      try {
        const fields = lead.field_data || [];
        const email  = extractField(fields, ['email', 'e-mail']);
        const phone  = extractField(fields, ['phone', 'telefone', 'cel', 'whatsapp']);
        const nome   = extractField(fields, ['name', 'nome', 'full_name']);

        const score = calcInitialScore(lead);
        const tier  = getTier(score);

        // Envia para RD Station
        const rdOk = await sendToRD(lead, score);
        if (rdOk) stats.sentToRD++;

        // Prepara evento CAPI Lead
        if (email || phone) {
          capiEvents.push({
            event_name:  'Lead',
            email:       email  || undefined,
            phone:       phone  || undefined,
            first_name:  nome   || undefined,
            event_id:    `meta_form_${lead.id}`,
            event_time:  Math.floor(new Date(lead.created_time).getTime() / 1000),
          });
        }

        // Marca como processado
        processedSet.add(lead.id);

        log.push(`[OK] Lead ${lead.id} — score ${score} (${tier.label}) — RD: ${rdOk ? 'ok' : 'skip'}`);
      } catch (err) {
        stats.errors++;
        log.push(`[ERR] Lead ${lead.id}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Envia todos os eventos CAPI de uma vez
    if (capiEvents.length > 0) {
      const capiResult = await sendCAPIEvents(capiEvents);
      stats.capiSent = capiResult.sent;
      log.push(`[CAPI] ${capiResult.sent} eventos Lead enviados ao pixel`);
    }

    // Atualiza KV
    const processedArr = [...processedSet].slice(-2000); // mantém últimos 2000 IDs
    await kv.set('meta:leads:processed', processedArr);
    await kv.set('meta:leads:lastFetch',  nowUnix);

    stats.ok         = true;
    stats.finishedAt = new Date().toISOString();

    await kv.set('meta:leads:lastRun',   stats.finishedAt);
    await kv.set('meta:leads:lastStats', stats);

    log.push(`[✓] Concluído: ${stats.newLeads} leads, ${stats.sentToRD} → RD, ${stats.capiSent} → CAPI`);
    logger.info({ stats }, '[cron/process-leads]');

    return NextResponse.json({ ...stats, log });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stats.error      = msg;
    stats.finishedAt = new Date().toISOString();
    log.push(`[ERRO FATAL] ${msg}`);
    await kv.set('meta:leads:lastStats', stats);
    logger.error({ msg }, '[cron/process-leads] Erro:');
    return NextResponse.json({ ...stats, log }, { status: 500 });
  }
}
