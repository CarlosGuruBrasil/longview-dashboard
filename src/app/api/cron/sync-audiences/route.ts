/**
 * /api/cron/sync-audiences
 *
 * Cron semanal (domingo 03h BRT) — sincroniza automaticamente a base CRM com o Meta Ads.
 *
 * Fluxo:
 *   1. Busca compradores do CVCRM (contratos ativos)
 *   2. Cria/atualiza Custom Audience "LV | Compradores CRM | HBM"
 *   3. Faz upload com SHA-256
 *   4. Cria Lookalike 1% Brasil
 *   5. Atualiza audiência de exclusão (base completa)
 *   6. Registra resultado no KV para o painel de monitoramento
 *   7. Envia eventos CAPI de Purchase para os compradores (educa o algoritmo)
 */
import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import axios from 'axios';
import crypto from 'crypto';
import { sendCAPIEvents, type CAPIEvent } from '@/app/api/meta/capi/route';

const META_BASE = 'https://graph.facebook.com/v21.0';
const ACT_ID    = process.env.META_ACT_ID;

type CrmContact = {
  nome?: string;
  name?: string;
  nome_completo?: string;
  email?: string;
  email_principal?: string;
  telefone?: string;
  celular?: string;
  fone?: string;
};
type NormalizedContact = { fn: string; email: string; phone: string };
type MetaAudience = { id: string; name: string };
type SyncResult = {
  startedAt: string;
  finishedAt?: string;
  error?: string;
  log: string[];
  audiences: Record<string, unknown>[];
  capi?: { sent: number; errors: number; details: unknown[] };
  totalContacts?: { buyers: number; all: number };
  ok: boolean;
};

function metaAuth() {
  return { access_token: process.env.META_TOKEN };
}

function hash(value: string): string {
  if (!value) return '';
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

function hashPhone(phone: string): string {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  const n = (d.length === 11 || d.length === 10) ? `+55${d}` : `+${d}`;
  return crypto.createHash('sha256').update(n).digest('hex');
}

function isCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const auth       = request.headers.get('Authorization') || '';
  if (!cronSecret) return false; // fail-safe
  return auth === `Bearer ${cronSecret}`;
}

async function fetchCRMContacts(filter: 'compradores' | 'todos'): Promise<CrmContact[]> {
  const email   = process.env.CV_CRM_EMAIL;
  const token   = process.env.CV_CRM_TOKEN;
  const base    = 'https://longviewempreendimentos.cvcrm.com.br/api/v1';
  const headers = { email, token, Accept: 'application/json' };

  if (filter === 'compradores') {
    try {
      const res = await axios.get<{ contratos?: CrmContact[]; data?: CrmContact[] } | CrmContact[]>(
        `${base}/comercial/contratos`,
        { headers, params: { limit: 1000, situacao: 'ativo' }, timeout: 25000 }
      );
      const body = res.data;
      const data = Array.isArray(body) ? body : (body?.contratos || body?.data || []);
      return Array.isArray(data) ? data : [];
    } catch {
      const res = await axios.get<{ leads?: CrmContact[] }>(`${base}/comercial/leads`, {
        headers, params: { limit: 2000, situacao: 'Vendido' }, timeout: 25000,
      });
      return res.data?.leads || [];
    }
  }

  // Base completa (paginada)
  const initial = await axios.get<{ total?: number }>(`${base}/comercial/leads`, {
    headers, params: { limit: 1 }, timeout: 15000,
  });
  const total = Math.min(initial.data?.total || 500, 5000);
  const pages = Math.ceil(total / 500);
  const promises = Array.from({ length: pages }, (_, i) =>
    axios.get<{ leads?: CrmContact[] }>(`${base}/comercial/leads`, {
      headers, params: { limit: 500, offset: i * 500 }, timeout: 25000,
    })
  );
  const results = await Promise.allSettled(promises);
  return results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value.data?.leads || []);
}

function normalizeContact(c: CrmContact): NormalizedContact {
  return {
    fn:    (c.nome || c.name || c.nome_completo || '').trim(),
    email: (c.email || c.email_principal || '').toLowerCase().trim(),
    phone: (c.telefone || c.celular || c.fone || '').replace(/\D/g, ''),
  };
}

async function findOrCreateAudience(name: string, description: string): Promise<string> {
  // Tenta encontrar audiência existente pelo nome
  try {
    const res = await axios.get<{ data?: MetaAudience[] }>(`${META_BASE}/${ACT_ID}/customaudiences`, {
      params: { fields: 'id,name', limit: 100, ...metaAuth() },
      timeout: 15000,
    });
    const existing = (res.data?.data || []).find(a => a.name === name);
    if (existing) return existing.id;
  } catch { /* ignora, cria nova */ }

  const res = await axios.post<{ id: string }>(
    `${META_BASE}/${ACT_ID}/customaudiences`,
    {
      name, description,
      subtype: 'CUSTOM',
      customer_file_source: 'USER_PROVIDED_ONLY',
      retention_days: 180,
      ...metaAuth(),
    },
    { timeout: 15000 }
  );
  return res.data.id;
}

async function uploadContactsToAudience(audienceId: string, contacts: NormalizedContact[]): Promise<{ received: number; invalid: number }> {
  const BATCH = 500;
  let received = 0;
  let invalid  = 0;

  for (let i = 0; i < contacts.length; i += BATCH) {
    const batch = contacts.slice(i, i + BATCH).map(c => [
      hash(c.fn.split(' ')[0] || ''),
      hash(c.email),
      hashPhone(c.phone),
    ]);
    try {
      const res = await axios.post<{ num_received?: number; num_invalid_entries?: number }>(
        `${META_BASE}/${audienceId}/users`,
        {
          payload: { schema: ['FN', 'EMAIL', 'PHONE'], data: batch, is_raw: false },
          ...metaAuth(),
        },
        { timeout: 30000 }
      );
      received += res.data?.num_received   || batch.length;
      invalid  += res.data?.num_invalid_entries || 0;
    } catch (err) {
      console.error('[sync] upload batch erro:', axios.isAxiosError(err) ? err.response?.data?.error?.message : err);
      invalid += batch.length;
    }
  }
  return { received, invalid };
}

export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const log: string[] = [];
  const result: SyncResult = { startedAt, log, audiences: [], ok: false };

  try {
    log.push(`[${new Date().toISOString()}] Iniciando sync semanal de audiências`);

    // ── 1. Compradores ──────────────────────────────────────────────────────
    log.push('[CRM] Buscando compradores (contratos ativos)...');
    const rawBuyers   = await fetchCRMContacts('compradores');
    const buyers      = rawBuyers.map(normalizeContact).filter(c => c.email || c.phone);
    log.push(`[CRM] ${buyers.length} compradores válidos`);

    const buyerAudId = await findOrCreateAudience(
      'LV | Compradores CRM | HBM',
      `Clientes com contrato — seed Lookalike (sync ${new Date().toLocaleDateString('pt-BR')})`
    );
    const buyerUpload = await uploadContactsToAudience(buyerAudId, buyers);
    log.push(`[META] Compradores → ID ${buyerAudId}: ${buyerUpload.received} recebidos`);
    result.audiences.push({ id: buyerAudId, name: 'LV | Compradores CRM | HBM', type: 'compradores', ...buyerUpload });

    // ── 2. Lookalike 1% a partir dos compradores ────────────────────────────
    try {
      const llName = 'LV | Lookalike 1% Compradores | HBM';
      const existRes = await axios.get<{ data?: MetaAudience[] }>(`${META_BASE}/${ACT_ID}/customaudiences`, {
        params: { fields: 'id,name', limit: 100, ...metaAuth() }, timeout: 10000,
      });
      const existingLL = (existRes.data?.data || []).find(a => a.name === llName);

      if (!existingLL) {
        const llRes = await axios.post<{ id: string }>(
          `${META_BASE}/${ACT_ID}/customaudiences`,
          {
            name: llName,
            description: `Lookalike 1% compradores reais (${new Date().toLocaleDateString('pt-BR')})`,
            subtype: 'LOOKALIKE',
            origin_audience_id: buyerAudId,
            lookalike_spec: JSON.stringify({ type: 'similarity', ratio: 0.01, country: 'BR' }),
            ...metaAuth(),
          },
          { timeout: 20000 }
        );
        log.push(`[META] Lookalike criado: ID ${llRes.data.id}`);
        result.audiences.push({ id: llRes.data.id, name: llName, type: 'lookalike' });
      } else {
        log.push(`[META] Lookalike já existe (ID ${existingLL.id}) — sem alteração`);
        result.audiences.push({ id: existingLL.id, name: llName, type: 'lookalike', existing: true });
      }
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error?.message || err.message : String(err);
      log.push(`[META] Aviso — lookalike: ${msg}`);
    }

    // ── 3. Base completa (exclusão) ─────────────────────────────────────────
    log.push('[CRM] Buscando base completa...');
    const rawAll  = await fetchCRMContacts('todos');
    const allBase = rawAll.map(normalizeContact).filter(c => c.email || c.phone);
    log.push(`[CRM] ${allBase.length} contatos na base completa`);

    const exclAudId = await findOrCreateAudience(
      'LV | Base CRM Completa | Exclusao',
      `Todos os contatos CRM — usar como exclusão em prospecção (${new Date().toLocaleDateString('pt-BR')})`
    );
    const exclUpload = await uploadContactsToAudience(exclAudId, allBase);
    log.push(`[META] Exclusão → ID ${exclAudId}: ${exclUpload.received} recebidos`);
    result.audiences.push({ id: exclAudId, name: 'LV | Base CRM Completa | Exclusao', type: 'exclusao', ...exclUpload });

    // ── 4. CAPI: envia eventos Purchase para compradores (educa o algoritmo) ─
    log.push('[CAPI] Enviando eventos Purchase para compradores...');
    const capiEvents: CAPIEvent[] = buyers
      .filter(b => b.email || b.phone)
      .slice(0, 200) // limita batch CAPI
      .map((b, idx) => ({
        event_name:  'Purchase',
        email:       b.email  || undefined,
        phone:       b.phone  || undefined,
        first_name:  b.fn     || undefined,
        event_id:    `buyer_sync_${buyerAudId}_${idx}`,
        value:       0, // valor não confidencial enviado como 0
      }));

    const capiResult = await sendCAPIEvents(capiEvents);
    log.push(`[CAPI] ${capiResult.sent} eventos Purchase enviados ao pixel`);
    result.capi = capiResult;

    // ── 5. Persiste resultado no KV ─────────────────────────────────────────
    result.ok         = true;
    result.finishedAt = new Date().toISOString();
    result.totalContacts = { buyers: buyers.length, all: allBase.length };

    await kv.set('meta:sync:last', result);
    await kv.set('meta:sync:lastRun', result.finishedAt);

    log.push(`[✓] Sync concluído em ${result.finishedAt}`);
    console.log('[cron/sync-audiences] Concluído:', result.totalContacts);

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.error     = msg;
    result.finishedAt = new Date().toISOString();
    log.push(`[ERRO] ${msg}`);
    await kv.set('meta:sync:last', result);
    console.error('[cron/sync-audiences] Erro:', msg);
    return NextResponse.json(result, { status: 500 });
  }
}
