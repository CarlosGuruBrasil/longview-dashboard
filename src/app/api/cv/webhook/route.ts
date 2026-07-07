/**
 * /api/cv/webhook
 *
 * Recebe webhooks do CV CRM em tempo real.
 * Configurar no CV CRM: Configurações → Webhooks → URL: https://app.guru.dev.br/api/cv/webhook
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

function norm(s: string) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }

/** Busca gatilho RD para a etapa — lê do banco (dinâmico, sem hardcode) */
async function getGatilhoRD(etapaNome: string): Promise<string | null> {
  if (!etapaNome || !process.env.DATABASE_URL) return null;
  try {
    const { sql } = await import('@/lib/pg');
    const n = norm(etapaNome);
    const rows = await sql<{ gatilho_rd: string }[]>`
      SELECT gatilho_rd FROM funil_etapas
      WHERE ativa = true AND gatilho_rd IS NOT NULL
        AND (nome_norm = ${n} OR ${n} LIKE '%' || nome_norm || '%' OR nome_norm LIKE '%' || ${n} || '%')
      LIMIT 1
    `;
    return rows[0]?.gatilho_rd ?? null;
  } catch { return null; }
}

/** Upsert automático de etapa desconhecida — apareceu no webhook, registra sem gatilho */
async function upsertEtapa(etapaNome: string): Promise<void> {
  if (!etapaNome || !process.env.DATABASE_URL) return;
  try {
    const { sql } = await import('@/lib/pg');
    await sql`
      INSERT INTO funil_etapas (nome, nome_norm, tipo)
      VALUES (${etapaNome}, ${norm(etapaNome)}, 'lead')
      ON CONFLICT (nome) DO NOTHING
    `;
  } catch { /* não bloqueia */ }
}

// Envia conversão ao RD Station para disparar o flow de e-mail
async function triggerRDSemConexao(lead: {
  id: string | number;
  nome?: string;
  email?: string;
  telefone?: string;
  etapa?: string;
  gatilhoNome?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RD_TOKEN_PUBLIC;
  if (!apiKey) return { ok: false, error: 'RD_TOKEN_PUBLIC não configurado' };
  if (!lead.email && !lead.telefone) return { ok: false, error: 'lead sem email nem telefone' };

  const payload: Record<string, unknown> = {
    conversion_identifier: lead.gatilhoNome ?? 'sem_conexao_longview',
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
  if (cvSecret) {
    const incomingSecret =
      request.headers.get('x-webhook-secret') ||
      request.headers.get('x-cv-secret') ||
      getBearerToken(request);
    if (incomingSecret !== cvSecret) {
      logger.warn('[cv/webhook] Secret inválido — payload rejeitado');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
  } else {
    logger.warn('[cv/webhook] CV_WEBHOOK_SECRET não configurado — sem validação de autenticação');
  }

  logger.info({ bodyPreview: JSON.stringify(body).slice(0, 300) }, '[cv/webhook] Evento recebido');

  // Suporta múltiplos formatos de payload que o CV CRM pode enviar
  const lead     = body.lead    || body.data?.lead || body;
  const etapa    = refName(lead.etapa) || lead.etapa_nome || body.etapa_nome || '';
  const situacao = refName(lead.situacao);
  const leadId   = String(
    lead.idlead || lead.id_lead || lead.id || lead.codigo || lead.lead_id || lead.referencia || ''
  ).trim();

  const etapaAtiva = etapa || situacao;

  // Registra etapa no banco se ainda não existe (autodiscovery)
  if (etapaAtiva) await upsertEtapa(etapaAtiva);

  // Busca gatilho RD dinamicamente no banco
  const gatilhoRD = await getGatilhoRD(etapaAtiva);

  if (!gatilhoRD) {
    await logEvent({ ...body, lead, etapa: etapaAtiva, evento: 'outros' }, false);
    return NextResponse.json({ ok: true, action: 'ignored', etapa: etapaAtiva });
  }

  // Identidade estavel para dedup: email > telefone > id do CRM.
  const leadEmail = String(lead.email || lead.email_principal || '').toLowerCase().trim();
  const leadPhone = String(lead.telefone || lead.celular || lead.fone || '').replace(/\D/g, '');
  const dedupKey =
    leadEmail ? `cv:rd_gatilho:sent:email:${leadEmail}:${gatilhoRD}` :
    leadPhone ? `cv:rd_gatilho:sent:phone:${leadPhone}:${gatilhoRD}` :
    leadId    ? `cv:rd_gatilho:sent:${leadId}:${gatilhoRD}` : null;

  if (!dedupKey) {
    await logEvent({ ...body, lead, etapa: etapaAtiva, evento: 'sem_identidade' }, false);
    return NextResponse.json({ ok: true, action: 'skipped_no_identity', etapa: etapaAtiva });
  }

  const alreadySent = await kv.get(dedupKey);
  if (alreadySent) {
    logger.info(`[cv/webhook] Contato ${leadId} já processado para ${gatilhoRD} — dedup`);
    await logEvent({ ...body, lead, etapa: etapaAtiva, evento: 'dedup' }, false);
    return NextResponse.json({ ok: true, action: 'dedup', leadId });
  }

  // Dispara o gatilho dinâmico no RD Station
  const rdResult = await triggerRDSemConexao({
    id:            leadId,
    nome:          lead.nome || lead.name || '',
    email:         leadEmail,
    telefone:      lead.telefone || lead.celular || lead.fone || '',
    etapa:         etapaAtiva,
    gatilhoNome:   gatilhoRD,
  });

  if (rdResult.ok) {
    await kv.set(dedupKey, new Date().toISOString(), { ex: 90 * 86400 });
  }

  await logEvent({ ...body, lead, etapa: etapaAtiva, evento: gatilhoRD }, true, rdResult);

  logger.info(`[cv/webhook] Lead ${leadId} etapa=${etapaAtiva} → RD ${gatilhoRD}: ${rdResult.ok ? 'OK' : rdResult.error}`);

  return NextResponse.json({
    ok:      rdResult.ok,
    action:  'rd_gatilho_triggered',
    leadId,
    etapa:   etapaAtiva,
    gatilho: gatilhoRD,
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
