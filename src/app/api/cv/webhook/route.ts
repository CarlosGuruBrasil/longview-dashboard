/**
 * /api/cv/webhook
 *
 * Recebe webhooks do CV CRM em tempo real.
 * Configurar no CV CRM: Configurações → Webhooks → URL: https://longview-dashboard.vercel.app/api/cv/webhook
 *
 * Gatilho principal:
 *   Quando um lead muda de etapa para "Sem Conexão"
 *   → envia conversão "sem_conexao_longview" ao RD Station
 *   → dispara o flow de e-mail de reativação configurado no RD
 *
 * Outros eventos recebidos são logados no KV para auditoria.
 */
import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import axios from 'axios';
import { getBearerToken } from '@/lib/internal-auth';
import logger from '@/lib/logger'

// CV CRM retorna etapa/situacao ora como string, ora como { nome }.
type NamedRef = { nome?: string } | string | null | undefined;

type WebhookLead = {
  idlead?: string | number;
  id_lead?: string | number;
  id?: string | number;
  codigo?: string | number;
  lead_id?: string | number;
  referencia?: string | number;
  nome?: string;
  name?: string;
  email?: string;
  email_principal?: string;
  telefone?: string;
  celular?: string;
  fone?: string;
  etapa?: NamedRef;
  etapa_nome?: string;
  situacao?: NamedRef;
};

type WebhookBody = {
  lead?: WebhookLead;
  data?: { lead?: WebhookLead };
  etapa_nome?: string;
  evento?: string;
  event?: string;
  tipo?: string;
} & WebhookLead;

type WebhookLogEntry = {
  ts: string;
  leadId: string | number;
  nome: string;
  etapa: string;
  evento: string;
  triggered: boolean;
  rdOk?: boolean;
  rdError?: string;
};

function refName(v: NamedRef): string {
  if (typeof v === 'string') return v;
  return v?.nome ?? '';
}

// Possíveis nomes da etapa no CV CRM (case-insensitive)
const SEM_CONEXAO_PATTERNS = [
  'sem conexão', 'sem conexao', 'semconexao', 'sem_conexao',
  'sem contato', 'inativo', 'lost contact', 'perdido contato',
];

function isSemConexao(etapaNome: string): boolean {
  const normalized = (etapaNome || '').toLowerCase().trim();
  return SEM_CONEXAO_PATTERNS.some(p => normalized.includes(p));
}

// Envia conversão ao RD Station para disparar o flow de e-mail
async function triggerRDSemConexao(lead: {
  id: string | number;
  nome?: string;
  email?: string;
  telefone?: string;
  etapa?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RD_TOKEN_PUBLIC;
  if (!apiKey) return { ok: false, error: 'RD_TOKEN_PUBLIC não configurado' };
  if (!lead.email && !lead.telefone) return { ok: false, error: 'lead sem email nem telefone' };

  const payload: Record<string, unknown> = {
    conversion_identifier: 'sem_conexao_longview',
    cf_etapa_crm:          lead.etapa     || 'Sem Conexão',
    cf_origem_captacao:    'crm_webhook',
    cf_data_score:         new Date().toISOString().split('T')[0],
    tags:                  ['sem_conexao', 'reativacao_automatica', 'cv_crm'],
    available_for_mailing: true,
    legal_bases: [{ category: 'communications', type: 'consent', status: 'granted' }],
  };

  if (lead.email)    payload.email          = lead.email.toLowerCase().trim();
  if (lead.nome)     payload.name           = lead.nome;
  if (lead.telefone) payload.personal_phone = lead.telefone;

  try {
    await axios.post(
      'https://api.rd.services/platform/conversions',
      { event_type: 'CONVERSION', event_family: 'CDP', payload },
      { params: { api_key: apiKey }, timeout: 12000 }
    );
    return { ok: true };
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? err.response?.data?.errors?.[0]?.message || err.message
      : err instanceof Error ? err.message : String(err);
    return { ok: false, error: detail };
  }
}

// Salva log no KV
async function logEvent(event: WebhookBody & { etapa?: string }, triggered: boolean, rdResult?: { ok: boolean; error?: string }) {
  try {
    const existing = (await kv.get<WebhookLogEntry[]>('cv:webhook:log')) || [];
    const entry: WebhookLogEntry = {
      ts:        new Date().toISOString(),
      leadId:    event.lead?.id || event.id || '?',
      nome:      event.lead?.nome || event.nome || '?',
      etapa:     refName(event.lead?.etapa) || event.etapa || '?',
      evento:    event.evento || event.event || event.tipo || 'unknown',
      triggered,
      rdOk:      rdResult?.ok,
      rdError:   rdResult?.error,
    };
    const updated = [entry, ...existing].slice(0, 200);
    await kv.set('cv:webhook:log', updated);
    await kv.set('cv:webhook:last', entry.ts);
    if (triggered && rdResult?.ok) {
      const count = ((await kv.get<number>('cv:webhook:sem_conexao_count')) || 0) + 1;
      await kv.set('cv:webhook:sem_conexao_count', count);
    }
  } catch (e) {
    logger.warn({ e }, '[cv/webhook] KV log error:');
  }
}

// ─── POST: recebe evento do CV CRM ────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let body: WebhookBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const cvSecret = process.env.CV_WEBHOOK_SECRET;
  const incomingSecret =
    request.headers.get('x-webhook-secret') ||
    request.headers.get('x-cv-secret') ||
    getBearerToken(request);
  if (!cvSecret || incomingSecret !== cvSecret) {
    logger.warn('[cv/webhook] Secret ausente ou inválido');
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  logger.info({ bodyPreview: JSON.stringify(body).slice(0, 300) }, '[cv/webhook] Evento recebido');

  // Suporta múltiplos formatos de payload que o CV CRM pode enviar
  const lead     = body.lead    || body.data?.lead || body;
  const etapa    = refName(lead.etapa) || lead.etapa_nome || body.etapa_nome || '';
  const situacao = refName(lead.situacao);
  const leadId   = String(
    lead.idlead || lead.id_lead || lead.id || lead.codigo || lead.lead_id || lead.referencia || ''
  ).trim();

  // Verifica se é uma mudança de etapa para "Sem Conexão"
  const semConexao = isSemConexao(etapa) || isSemConexao(situacao);

  if (!semConexao) {
    await logEvent({ ...body, lead, etapa, evento: 'outros' }, false);
    return NextResponse.json({ ok: true, action: 'ignored', etapa });
  }

  // Identidade estavel para dedup: email > telefone > id do CRM.
  // Mesma convencao de chave usada pelo cron recalc-scores.
  const leadEmail = String(lead.email || lead.email_principal || '').toLowerCase().trim();
  const leadPhone = String(lead.telefone || lead.celular || lead.fone || '').replace(/\D/g, '');
  const dedupKey =
    leadEmail ? `cv:sem_conexao:sent:email:${leadEmail}` :
    leadPhone ? `cv:sem_conexao:sent:phone:${leadPhone}` :
    leadId    ? `cv:sem_conexao:sent:${leadId}` : null;

  // Sem identidade nao ha como deduplicar nem como o RD identificar o contato
  if (!dedupKey) {
    await logEvent({ ...body, lead, etapa, evento: 'sem_conexao_sem_identidade' }, false);
    return NextResponse.json({ ok: true, action: 'skipped_no_identity', etapa });
  }

  // Evita enviar duplicado para o mesmo contato (dedup por 90 dias)
  const alreadySent = await kv.get(dedupKey);
  if (alreadySent) {
    logger.info(`[cv/webhook] Contato $ já processado — dedup`);
    await logEvent({ ...body, lead, etapa, evento: 'sem_conexao_dedup' }, false);
    return NextResponse.json({ ok: true, action: 'dedup', leadId });
  }

  // Dispara o gatilho no RD Station
  const rdResult = await triggerRDSemConexao({
    id:       leadId,
    nome:     lead.nome || lead.name || '',
    email:    leadEmail,
    telefone: lead.telefone || lead.celular || lead.fone || '',
    etapa,
  });

  // Marca como enviado por 90 dias
  if (rdResult.ok) {
    await kv.set(dedupKey, new Date().toISOString(), { ex: 90 * 86400 });
  }

  await logEvent({ ...body, lead, etapa, evento: 'sem_conexao' }, true, rdResult);

  logger.info(`[cv/webhook] Lead $ → RD: $`);

  return NextResponse.json({
    ok:      rdResult.ok,
    action:  'sem_conexao_triggered',
    leadId,
    etapa,
    rd:      rdResult,
  });
}

// ─── GET: status e log do webhook ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const [log, last, count] = await Promise.all([
      kv.get<WebhookLogEntry[]>('cv:webhook:log'),
      kv.get<string>('cv:webhook:last'),
      kv.get<number>('cv:webhook:sem_conexao_count'),
    ]);
    return NextResponse.json({
      ok:              true,
      webhookUrl:      `${request.nextUrl.origin || 'https://app.guru.dev.br'}/api/cv/webhook`,
      lastReceived:    last,
      semConexaoTotal: count || 0,
      recentEvents:    (log || []).slice(0, 50),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
