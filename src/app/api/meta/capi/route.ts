/**
 * /api/meta/capi
 *
 * Envia eventos para o Meta Conversions API (CAPI) usando a especificação
 * oficial de "Conversion Leads" (integração de CRM), documentada em:
 * developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration
 *
 * Isso é o que faz o algoritmo do Meta entender qualidade de lead
 * (visita agendada, compra, etc.) e otimizar entrega para todas as
 * campanhas com meta de desempenho "Leads de conversão" (QUALITY_LEAD) —
 * não é uma configuração por campanha, é conta-wide via este pixel/dataset.
 *
 * Chamado automaticamente pelo webhook do CV CRM e pelos cron jobs —
 * não requer interação do usuário.
 *
 * POST → envia um ou mais eventos
 * Body: { events: Array<CAPIEvent> }
 *
 * CAPIEvent:
 *   event_name:  string  (texto livre — estágio do funil: "Lead", "Visita agendada",
 *                         "Venda realizada" etc. Não precisa ser evento padrão do Meta)
 *   lead_id?:    string | number  (leadgen_id do Meta — PRIORIDADE MÁXIMA de match,
 *                         obrigatório sempre que disponível, per doc oficial)
 *   email?:      string  (será hashed SHA-256 — fallback de match se não houver lead_id)
 *   phone?:      string  (será hashed SHA-256, normalizado +55)
 *   first_name?: string  (será hashed SHA-256)
 *   value?:      number  (para Purchase — valor do contrato em BRL)
 *   event_id?:   string  (dedup key — normalmente o ID do lead no CRM)
 *   event_time?: number  (unix timestamp — padrão: agora)
 *   source_url?: string
 *
 * Campos fixos exigidos pela spec (não configuráveis por chamada):
 *   action_source        = "system_generated" (evento gerado por automação do CRM, não por ação direta do usuário)
 *   custom_data.event_source       = "crm"
 *   custom_data.lead_event_source  = "CV CRM"
 * Sem esses dois campos de custom_data, o evento pode aparecer no Gerenciador
 * de Eventos mas NÃO conta para o treinamento de "Leads de conversão".
 */
import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import crypto from 'crypto';
import axios from 'axios';
import logger from '@/lib/logger'

const META_BASE = 'https://graph.facebook.com/v21.0';
const PIXEL_ID  = process.env.META_PIXEL_ID;

function hash(value: string): string {
  if (!value) return '';
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

function hashPhone(phone: string): string {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  const normalized = (d.length === 11 || d.length === 10) ? `+55${d}` : `+${d}`;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// Verificação de cron ou admin interno
function isCronOrInternal(request: NextRequest): boolean {
  const cronSecret  = process.env.CRON_SECRET;
  const authHeader  = request.headers.get('Authorization') || '';
  const internalKey = request.headers.get('x-internal-key') || '';
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  if (internalKey === process.env.INTERNAL_API_KEY) return true;
  return false;
}

export interface CAPIEvent {
  event_name:  string;
  /** leadgen_id do Meta — chave de match de maior prioridade para Conversion Leads */
  lead_id?:    string | number;
  email?:      string;
  phone?:      string;
  first_name?: string;
  value?:      number;
  event_id?:   string;
  event_time?: number;
  source_url?: string;
}

type CAPILogEntry = {
  event: string;
  event_id: string;
  email: string;
  ts: string;
};

// Função exportada para uso interno pelos cron jobs (sem HTTP)
export async function sendCAPIEvents(events: CAPIEvent[]): Promise<{
  sent: number; errors: number; details: unknown[]
}> {
  if (!PIXEL_ID || !process.env.META_TOKEN) {
    return { sent: 0, errors: events.length, details: [{ error: 'META_PIXEL_ID ou META_TOKEN não configurado' }] };
  }

  const now = Math.floor(Date.now() / 1000);

  const metaEvents = events.map(ev => {
    // user_data: lead_id é a chave de match de maior prioridade (leadgen_id do
    // formulário Meta). Mantido como string para não perder precisão — IDs de
    // leadgen têm 15-17 dígitos, acima de Number.MAX_SAFE_INTEGER (~9e15).
    const userData: Record<string, string> = {};
    if (ev.lead_id != null) userData.lead_id = String(ev.lead_id);
    if (ev.email)      userData.em  = hash(ev.email);
    if (ev.phone)      userData.ph  = hashPhone(ev.phone);
    if (ev.first_name) userData.fn  = hash(ev.first_name.split(' ')[0]);

    // custom_data: event_source + lead_event_source são OBRIGATÓRIOS pela spec
    // oficial de Conversion Leads — sem eles o evento não conta para o
    // treinamento do modelo de qualidade de lead, mesmo aparecendo no painel.
    const customData: Record<string, unknown> = {
      event_source:      'crm',
      lead_event_source: 'CV CRM',
    };
    if (ev.value !== undefined) {
      customData.value    = ev.value;
      customData.currency = 'BRL';
    }

    const data: Record<string, unknown> = {
      event_name:        ev.event_name,
      event_time:        ev.event_time || now,
      event_id:          ev.event_id   || `${ev.event_name}_${now}_${Math.random().toString(36).slice(2)}`,
      // Fixo pela spec oficial: evento gerado por automação do CRM, não por
      // ação direta do usuário no site/app ('crm' não é um valor válido de
      // action_source na API do Meta).
      action_source:     'system_generated',
      user_data:         userData,
      custom_data:       customData,
    };

    if (ev.source_url) {
      data.event_source_url = ev.source_url;
    }

    return data;
  });

  try {
    const res = await axios.post(
      `${META_BASE}/${PIXEL_ID}/events`,
      {
        data: metaEvents,
        access_token: process.env.META_TOKEN,
        // test_event_code: process.env.META_TEST_EVENT_CODE, // descomentar p/ debug
      },
      { timeout: 20000 }
    );

    const result = res.data;
    const sent   = result?.events_received ?? events.length;

    // Salvar log no KV (últimos 100 eventos)
    try {
      const existing = (await kv.get<CAPILogEntry[]>('meta:capi:log')) || [];
      const newEntries = events.map(ev => ({
        event:    ev.event_name,
        event_id: ev.event_id || '',
        email:    ev.email ? `${ev.email.substring(0, 3)}***` : '',
        ts:       new Date().toISOString(),
      }));
      const updated = [...newEntries, ...existing].slice(0, 100);
      await kv.set('meta:capi:log', updated);
      await kv.set('meta:capi:last', new Date().toISOString());
      // Contador diário
      const today = new Date().toISOString().split('T')[0];
      const dayKey = `meta:capi:count:${today}`;
      const current = ((await kv.get<number>(dayKey)) || 0) + sent;
      await kv.set(dayKey, current, { ex: 86400 * 3 }); // 3 dias TTL
    } catch (kvErr) {
      logger.warn({ kvErr }, '[capi] Erro ao salvar log KV:');
    }

    return { sent, errors: 0, details: [result] };
  } catch (err: unknown) {
    const detail = axios.isAxiosError(err) ? err.response?.data || err.message : err instanceof Error ? err.message : String(err);
    logger.error({ detail }, '[capi] Erro ao enviar eventos:');
    return { sent: 0, errors: events.length, details: [detail] };
  }
}

export async function POST(request: NextRequest) {
  if (!isCronOrInternal(request)) {
    // Permite também admin autenticado via cookie
    const { verifyAdminAuth } = await import('@/lib/auth');
    const admin = await verifyAdminAuth();
    if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const body = await request.json();
  const events: CAPIEvent[] = Array.isArray(body.events) ? body.events : [body];

  if (events.length === 0) {
    return NextResponse.json({ error: 'Nenhum evento fornecido' }, { status: 400 });
  }

  const result = await sendCAPIEvents(events);
  return NextResponse.json(result, { status: result.errors > 0 && result.sent === 0 ? 500 : 200 });
}
