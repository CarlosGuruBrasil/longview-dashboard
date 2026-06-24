/**
 * /api/meta/webhook
 *
 * Pipeline: Meta Lead Ads → CV CRM (direto, sem RD Station) → Postgres → FCM
 *
 * GET  → Verificação do webhook pela Meta (hub.challenge)
 * POST → Recebe evento leadgen em tempo real
 *
 * Configurar em:
 *   Meta Business Manager → Webhooks → Adicionar webhook → Página
 *   Campos:   leadgen
 *   URL:      https://app.guru.dev.br/api/meta/webhook
 *   Token:    META_WEBHOOK_VERIFY_TOKEN (definir no Coolify e no Meta)
 *
 * Fluxo após receber webhook:
 *   1. Busca lead completo na Meta API (campo field_data)
 *   2. Salva no Postgres (tabela leads) — dedup por meta_lead_id
 *   3. Cria lead no CV CRM via API direta (sem RD Station)
 *   4. Encaminha para RD Station em background (para e-mail/automação)
 *   5. Envia push FCM para equipe comercial
 *
 * RD Station continua no loop para nutrição por e-mail, mas
 * o lead chega no CRM em segundos (não minutos/horas).
 */
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { createCrmLead } from '@/lib/cvcrm';
import { parseCrmDate } from '@/lib/dateUtils';

const META_BASE    = 'https://graph.facebook.com/v21.0';
const PAGE_ID      = process.env.META_PAGE_ID ?? '259079394232614';
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? '';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface MetaFieldData {
  name: string;
  values: string[];
}

interface MetaLeadFull {
  id:           string;
  created_time: string;
  field_data:   MetaFieldData[];
  ad_id?:       string;
  ad_name?:     string;
  adset_id?:    string;
  adset_name?:  string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?:     string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extrai valor de field_data pela chave (suporta variações de nome) */
function getField(fields: MetaFieldData[], ...keys: string[]): string {
  for (const key of keys) {
    const found = fields.find(f =>
      f.name?.toLowerCase().replace(/[^a-z0-9]/g, '') ===
      key.toLowerCase().replace(/[^a-z0-9]/g, '')
    );
    if (found?.values?.[0]) return found.values[0].trim();
  }
  return '';
}

/** Busca lead completo na Meta API usando page access token */
async function fetchMetaLead(leadgenId: string): Promise<MetaLeadFull | null> {
  const token = process.env.META_TOKEN;
  if (!token) return null;

  try {
    // Tenta com page access token primeiro (necessário para leadgen_forms de página)
    const res = await axios.get(`${META_BASE}/${leadgenId}`, {
      params: {
        fields: 'id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id',
        access_token: token,
      },
      timeout: 10_000,
    });
    return res.data as MetaLeadFull;
  } catch (err: any) {
    console.warn(`[meta/webhook] fetchMetaLead ${leadgenId} falhou:`, err.response?.data?.error?.message ?? err.message);
    return null;
  }
}

/** Salva lead no Postgres (dedup por meta_lead_id via campo raw.id) */
async function saveToPostgres(lead: MetaLeadFull, parsed: {
  nome: string; email: string; telefone: string;
  empreendimento: string; midia: string; origem: string;
}): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();

    // ID sintético prefixado para não colidir com IDs do CRM
    const id = `meta_${lead.id}`;

    await sql`
      INSERT INTO leads (
        id, nome, email, telefone, origem, status,
        empreendimento, score, temperatura,
        data_cadastro, data_atualizacao, raw, synced_at
      ) VALUES (
        ${id},
        ${parsed.nome     || null},
        ${parsed.email    || null},
        ${parsed.telefone || null},
        ${parsed.origem},
        ${'Novo'},
        ${parsed.empreendimento || null},
        ${null}, ${null},
        ${lead.created_time ? new Date(lead.created_time).toISOString() : null},
        ${new Date().toISOString()},
        ${JSON.stringify({ ...lead, _source: 'meta_webhook', _parsed: parsed })},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        nome             = EXCLUDED.nome,
        email            = EXCLUDED.email,
        telefone         = EXCLUDED.telefone,
        origem           = EXCLUDED.origem,
        empreendimento   = EXCLUDED.empreendimento,
        data_atualizacao = EXCLUDED.data_atualizacao,
        raw              = EXCLUDED.raw,
        synced_at        = NOW()
    `;
  } catch (e: any) {
    console.warn('[meta/webhook] saveToPostgres falhou:', e.message);
  }
}

/** Encaminha para RD Station em background (para nutrição por e-mail) */
function forwardToRDStation(parsed: {
  nome: string; email: string; telefone: string;
  empreendimento: string; midia: string;
}): void {
  const apiKey = process.env.RD_TOKEN_PUBLIC;
  if (!apiKey || !parsed.email) return;

  // Fire-and-forget: não bloqueia a resposta
  axios.post(
    'https://api.rd.services/platform/conversions',
    {
      event_type:   'CONVERSION',
      event_family: 'CDP',
      payload: {
        conversion_identifier: 'lead_meta_ads',
        email:      parsed.email.toLowerCase().trim(),
        name:       parsed.nome,
        ...(parsed.telefone     ? { personal_phone: parsed.telefone }   : {}),
        ...(parsed.empreendimento ? { cf_empreendimento: parsed.empreendimento } : {}),
        ...(parsed.midia        ? { cf_campanha_meta: parsed.midia }    : {}),
        tags: ['meta_lead_ads', 'webhook_direto'],
        available_for_mailing: true,
        legal_bases: [{
          category: 'communications', type: 'consent', status: 'granted',
        }],
      },
    },
    { params: { api_key: apiKey }, timeout: 12_000 }
  ).catch(err => {
    console.warn('[meta/webhook] RD Station forward falhou:', err.response?.data?.error_description ?? err.message);
  });
}

/** Envia push FCM para equipe comercial */
function sendFCMPush(nome: string, empreendimento: string, campanha: string): void {
  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://app.guru.dev.br';
  const body = [empreendimento, campanha].filter(Boolean).join(' • ');

  fetch(`${baseUrl}/api/notifications/send`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${process.env.CRON_SECRET}`,
    },
    body: JSON.stringify({
      title: '🎯 Novo Lead Meta Ads',
      body:  `${nome}${body ? ` — ${body}` : ''}`,
      roles: ['Desenvolvedor', 'Diretoria', 'Gestor', 'Operador'],
      data:  { url: '/marketing-vision', type: 'novo_lead' },
    }),
  }).catch(() => {});
}

// ─── GET — verificação do webhook pela Meta ───────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    console.log('[meta/webhook] Verificação OK');
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  return new Response('Forbidden', { status: 403 });
}

// ─── POST — recebe evento de novo lead ───────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  // Meta sempre envia { object: "page", entry: [...] }
  if (body?.object !== 'page') {
    return NextResponse.json({ ok: true, action: 'ignored', reason: 'object !== page' });
  }

  // Responde 200 imediatamente — Meta considera timeout > 20s como falha
  const processAsync = async () => {
    const entries = body?.entry ?? [];

    for (const entry of entries) {
      const changes = entry?.changes ?? [];
      for (const change of changes) {
        if (change?.field !== 'leadgen') continue;

        const { leadgen_id, form_id, ad_id, ad_name, campaign_id, campaign_name, page_id } = change.value ?? {};

        if (!leadgen_id) {
          console.warn('[meta/webhook] change sem leadgen_id');
          continue;
        }

        console.log(`[meta/webhook] Processando lead ${leadgen_id} (campanha: ${campaign_name ?? '?'})`);

        // 1. Busca dados completos na Meta API
        const metaLead = await fetchMetaLead(leadgen_id);
        if (!metaLead) {
          console.warn(`[meta/webhook] Não foi possível buscar lead ${leadgen_id}`);
          continue;
        }

        const fields = metaLead.field_data ?? [];

        // 2. Parseia campos do formulário
        const nome          = getField(fields, 'full_name', 'nome', 'name', 'first_name');
        const sobrenome     = getField(fields, 'last_name', 'sobrenome');
        const nomeCompleto  = sobrenome ? `${nome} ${sobrenome}`.trim() : nome;
        const email         = getField(fields, 'email', 'email_address', 'e-mail');
        const telefone      = getField(fields, 'phone_number', 'telefone', 'phone', 'celular', 'whatsapp');
        const empreendimento = getField(fields, 'empreendimento', 'produto', 'product', 'interest', 'interesse');
        const mensagem      = getField(fields, 'message', 'mensagem', 'observacao', 'comments');

        const campanha      = campaign_name ?? metaLead.campaign_name ?? '';
        const conjunto      = metaLead.adset_name ?? '';
        const midia         = [campanha, conjunto].filter(Boolean).join(' › ');
        const origem        = 'Meta Lead Ads';

        if (!nomeCompleto && !email && !telefone) {
          console.warn(`[meta/webhook] Lead ${leadgen_id} sem dados de contato — ignorado`);
          continue;
        }

        const parsed = {
          nome: nomeCompleto || email || 'Lead Meta',
          email, telefone, empreendimento, midia, origem,
        };

        // 3. Salva no Postgres (background-safe)
        await saveToPostgres(metaLead, parsed);

        // 4. Cria direto no CV CRM (principal mudança — sem passar pelo RD Station)
        const crmResult = await createCrmLead({
          nome:            parsed.nome,
          email:           email     || undefined,
          telefone:        telefone  || undefined,
          origem,
          midia,
          empreendimento:  empreendimento || undefined,
          mensagem:        [
            mensagem ? `Mensagem: ${mensagem}` : '',
            `Formulário: ${form_id ?? '?'}`,
            `Anúncio: ${ad_name ?? ad_id ?? '?'}`,
          ].filter(Boolean).join(' | ') || undefined,
        });

        if (!crmResult.ok) {
          console.warn(`[meta/webhook] CV CRM falhou para ${leadgen_id}: ${crmResult.error}`);
          // Não aborta — os outros passos continuam
        }

        // 5. RD Station em background (para e-mail e nutrição)
        forwardToRDStation(parsed);

        // 6. Push FCM para equipe comercial
        sendFCMPush(parsed.nome, empreendimento, campanha);

        console.log(
          `[meta/webhook] Lead ${leadgen_id} processado — ` +
          `CRM: ${crmResult.ok ? `OK (id=${crmResult.id})` : 'FALHOU'}`
        );
      }
    }
  };

  // Inicia processamento assíncrono e responde imediatamente
  processAsync().catch(e => console.error('[meta/webhook] processAsync error:', e));

  return NextResponse.json({ ok: true, received: true });
}
