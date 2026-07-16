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
import { recordIntegrationEvent } from '@/lib/integration-events';
import logger from '@/lib/logger'

const META_BASE    = 'https://graph.facebook.com/v21.0';
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

/** Grava erro de webhook na tabela webhook_errors */
async function logWebhookError(source: string, error: string, payload: unknown): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const { sql } = await import('@/lib/pg');
    await sql`
      INSERT INTO webhook_errors (source, error, payload, created_at)
      VALUES (${source}, ${error}, ${(payload ?? {}) as never}, NOW())
    `;
  } catch (e) {
    logger.error({ e }, '[meta/webhook] Falha ao logar erro no banco:');
  }
}

/** Obtém Page Access Token da Meta dinamicamente */
async function getPageAccessToken(): Promise<string> {
  const token = process.env.META_TOKEN;
  if (!token) return '';
  const PAGE_ID = '259079394232614';
  try {
    const res = await axios.get(`${META_BASE}/${PAGE_ID}`, {
      params: { fields: 'access_token', access_token: token },
      timeout: 8000,
    });
    return res.data?.access_token || token;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err: msg }, '[meta/webhook] Erro ao obter page access token');
    return token;
  }
}

/** Infere empreendimento pelo nome da campanha/conjunto/formulário */
function empFromCampaign(text: string): string {
  const s = (text || '').toLowerCase();
  if (s.includes('nautic'))                        return 'Nautic';
  if (s.includes('hub') || s.includes('beira mar') || s.includes('hbm')) return 'HUB Beira Mar';
  if (s.includes('infiniti'))                      return 'Infiniti';
  if (s.includes('sunclub') || s.includes('sun club')) return 'SunClub';
  if (s.includes('gran reserva'))                  return 'Gran Reserva';
  if (s.includes('le grand'))                      return 'Le Grand View';
  if (s.includes('porto da lagoa'))                return 'Porto da Lagoa';
  if (s.includes('south beach'))                   return 'South Beach';
  if (s.includes('trindade'))                      return 'Trindade';
  if (s.includes('exupery') || s.includes('exupéry')) return 'Exupéry';
  return '';
}

/** Extrai valor de field_data pela chave (suporta variações de nome por substring) */
function getField(fields: MetaFieldData[], ...keys: string[]): string {
  for (const key of keys) {
    const searchKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = fields.find(f => {
      if (!f.name) return false;
      const normalizedName = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return normalizedName === searchKey || normalizedName.includes(searchKey) || searchKey.includes(normalizedName);
    });
    if (found?.values?.[0]) return found.values[0].trim();
  }
  return '';
}

/** Busca lead completo na Meta API usando page access token */
async function fetchMetaLead(leadgenId: string): Promise<MetaLeadFull | null> {
  try {
    const pageToken = await getPageAccessToken();
    if (!pageToken) return null;

    const res = await axios.get(`${META_BASE}/${leadgenId}`, {
      params: {
        fields: 'id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id',
        access_token: pageToken,
      },
      timeout: 10_000,
    });
    return res.data as MetaLeadFull;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    logger.warn({ msg, leadgenId }, '[meta/webhook] fetchMetaLead falhou:');
    await logWebhookError('meta_webhook', `fetchMetaLead falhou para leadgenId ${leadgenId}: ${msg}`, { leadgenId });
    return null;
  }
}

/**
 * Salva lead no Postgres.
 * Se o CV CRM retornou um ID (cvId), usa ele como chave — sem duplicata.
 * Se CV CRM falhou, cai para meta_xxx como fallback temporário.
 * O raw do Meta fica em _meta para preservar atribuição de campanha/UTM.
 */
async function saveToPostgres(
  lead: MetaLeadFull,
  parsed: {
    nome: string; email: string; telefone: string;
    empreendimento: string; midia: string; origem: string;
    conhece_empreendimento?: string; procura_imovel_para?: string; cidade?: string;
  },
  cvId?: string | number,
): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();

    const id      = cvId ? String(cvId) : `meta_${lead.id}`;
    const metaRaw = { ...lead, _source: 'meta_webhook', _parsed: parsed };

    // Se temos o ID do CV, o raw virá via webhook do CV CRM depois — guardamos só _meta agora.
    // Se é fallback meta_xxx, o raw é o objeto Meta completo.
    const rawVal = cvId
      ? { _meta: metaRaw, _meta_lead_id: lead.id, origem: parsed.origem, midia_principal: parsed.midia }
      : metaRaw;

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
        ${sql.json(rawVal as never)},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        nome             = EXCLUDED.nome,
        email            = EXCLUDED.email,
        telefone         = EXCLUDED.telefone,
        origem           = COALESCE(leads.origem, EXCLUDED.origem),
        empreendimento   = COALESCE(leads.empreendimento, EXCLUDED.empreendimento),
        data_atualizacao = EXCLUDED.data_atualizacao,
        raw              = CASE
          WHEN EXCLUDED.raw ? '_meta'
          THEN leads.raw || EXCLUDED.raw
          ELSE EXCLUDED.raw
        END,
        synced_at        = NOW()
    `;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    logger.warn({ msg }, '[meta/webhook] saveToPostgres falhou:');
  }
}

/** Encaminha para RD Station em background (para nutrição por e-mail) */
function forwardToRDStation(parsed: {
  nome: string; email: string; telefone: string;
  empreendimento: string; midia: string;
  conhece_empreendimento?: string; procura_imovel_para?: string; cidade?: string;
}, metaLeadId?: string): void {
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
  )
    .then(() =>
      recordIntegrationEvent({
        systemSource: 'longview',
        systemTarget: 'rdstation',
        entityType: 'lead',
        entityId: metaLeadId ?? parsed.email,
        externalId: metaLeadId ?? parsed.email,
        status: 'sent',
        summary: 'Lead encaminhado para o RD Station',
        detail: parsed.midia || parsed.empreendimento || '',
        payload: { email: parsed.email, midia: parsed.midia, empreendimento: parsed.empreendimento },
      })
    )
    .catch(err => {
      const detail = err?.response?.data?.error_description || err?.message || String(err);
      logger.warn({ err: detail }, '[meta/webhook] RD Station forward falhou');
      void recordIntegrationEvent({
        systemSource: 'longview',
        systemTarget: 'rdstation',
        entityType: 'lead',
        entityId: metaLeadId ?? parsed.email,
        externalId: metaLeadId ?? parsed.email,
        status: 'error',
        summary: 'Falha ao encaminhar lead para o RD Station',
        detail,
        payload: { email: parsed.email, midia: parsed.midia, empreendimento: parsed.empreendimento },
      });
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
  }).catch(() => logger.warn('[meta/webhook] FCM push falhou'));
}

// ─── GET — verificação do webhook pela Meta ───────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    logger.info('[meta/webhook] Verificação OK');
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  return new Response('Forbidden', { status: 403 });
}

// ─── POST — recebe evento de novo lead ───────────────────────────────────────

export async function POST(request: NextRequest) {
  // Lê corpo como texto primeiro para poder validar assinatura
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ ok: false, error: 'Erro ao ler corpo' }, { status: 400 });
  }

  // Valida X-Hub-Signature-256 se META_APP_SECRET estiver configurado
  const appSecret = process.env.META_APP_SECRET;
  if (appSecret) {
    const sig = request.headers.get('x-hub-signature-256') ?? '';
    const { createHmac } = await import('crypto');
    const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');
    if (sig !== expected) {
      logger.warn({ sig }, '[meta/webhook] Assinatura inválida — payload rejeitado');
      return NextResponse.json({ ok: false, error: 'signature mismatch' }, { status: 403 });
    }
  } else {
    logger.warn('[meta/webhook] META_APP_SECRET não configurado — validação de assinatura desativada');
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  // Meta sempre envia { object: "page", entry: [...] }
  if (body?.object !== 'page') {
    return NextResponse.json({ ok: true, action: 'ignored', reason: 'object !== page' });
  }

  // Responde 200 imediatamente — Meta considera timeout > 20s como falha
  const processAsync = async () => {
    const entries = Array.isArray(body?.entry) ? body.entry : [];

    for (const entry of entries) {
      const changes = entry?.changes ?? [];
      for (const change of changes) {
        if (change?.field !== 'leadgen') continue;

        const { leadgen_id, form_id, ad_id, ad_name, campaign_name } = change.value ?? {};

        if (!leadgen_id) {
          logger.warn('[meta/webhook] change sem leadgen_id');
          continue;
        }

        await recordIntegrationEvent({
          systemSource: 'meta',
          systemTarget: 'longview',
          entityType: 'lead',
          entityId: leadgen_id,
          externalId: leadgen_id,
          status: 'received',
          summary: 'Webhook de lead recebido da Meta',
          detail: campaign_name ?? ad_name ?? '',
          payload: { form_id, ad_id, ad_name, campaign_name },
        });

        logger.info(`[meta/webhook] Processando lead ${leadgen_id} (campanha: ${campaign_name ?? '?'})`);

        // 1. Busca dados completos na Meta API
        const metaLead = await fetchMetaLead(leadgen_id);
        if (!metaLead) {
          logger.warn(`[meta/webhook] Não foi possível buscar lead ${leadgen_id}`);
          await recordIntegrationEvent({
            systemSource: 'meta',
            systemTarget: 'longview',
            entityType: 'lead',
            entityId: leadgen_id,
            externalId: leadgen_id,
            status: 'error',
            summary: 'Falha ao buscar payload completo do lead na Meta',
          });
          continue;
        }

        const fields = metaLead.field_data ?? [];

        // 2. Parseia campos do formulário
        const nome          = getField(fields, 'full_name', 'nome', 'name', 'first_name', 'completo');
        const sobrenome     = getField(fields, 'last_name', 'sobrenome');
        const nomeCompleto  = sobrenome ? `${nome} ${sobrenome}`.trim() : nome;
        const email         = getField(fields, 'email', 'email_address', 'e-mail');
        const telefone      = getField(fields, 'phone_number', 'telefone', 'phone', 'celular', 'whatsapp', 'tel');
        const mensagem      = getField(fields, 'message', 'mensagem', 'observacao', 'comments');

        // Campos extras do formulário (não usados como empreendimento)
        const conheceEmp    = getField(fields, 'você_conhece_o_empreendimento', 'conhece_o_empreendimento');
        const procuraImovel = getField(fields, 'você_procura_imóvel_para', 'procura_imovel_para', 'procura_para');
        const cidadeForm    = getField(fields, 'city', 'cidade', 'qual_a_sua_cidade');

        // Empreendimento inferido do nome da campanha (nunca do campo sim/não do form)
        const campanha      = campaign_name ?? metaLead.campaign_name ?? '';
        const conjunto      = metaLead.adset_name ?? '';
        const midia         = [campanha, conjunto].filter(Boolean).join(' › ');
        const empreendimento = empFromCampaign(campanha || conjunto || (metaLead.form_id ?? ''));
        const origem        = 'Meta Lead Ads';

        if (!nomeCompleto && !email && !telefone) {
          logger.warn(`[meta/webhook] Lead ${leadgen_id} sem dados de contato — ignorado`);
          await logWebhookError('meta_webhook', 'Lead descartado por falta de dados de contato básicos (nome, email ou telefone)', { leadgen_id, fields });
          await recordIntegrationEvent({
            systemSource: 'meta',
            systemTarget: 'longview',
            entityType: 'lead',
            entityId: leadgen_id,
            externalId: leadgen_id,
            status: 'skipped',
            summary: 'Lead ignorado por falta de contato basico',
          });
          continue;
        }

        const parsed = {
          nome: nomeCompleto || email || 'Lead Meta',
          email, telefone, empreendimento, midia, origem,
          conhece_empreendimento: conheceEmp || undefined,
          procura_imovel_para:    procuraImovel || undefined,
          cidade:                 cidadeForm || undefined,
        };

        // 3a. Lead já cadastrado preenchendo o formulário de novo? Reativa em vez de duplicar.
        let reengajado = false;
        if (email || telefone) {
          try {
            const { reengajarLeadPorContato } = await import('@/lib/leadReativacao');
            const reeng = await reengajarLeadPorContato({
              email, telefone,
              motivo: `Reengajamento via Meta Ads — preencheu o formulário novamente. Campanha: ${campanha || '?'} | Anúncio: ${ad_name ?? ad_id ?? '?'}`,
            });
            reengajado = reeng.ok;
            logger.info(`[meta/webhook] checagem de reengajamento para ${leadgen_id}: ${reeng.reason}`);
            await recordIntegrationEvent({
              systemSource: 'longview',
              systemTarget: 'cvcrm',
              entityType: 'lead',
              entityId: leadgen_id,
              externalId: email || telefone || leadgen_id,
              status: reeng.ok ? 'processed' : 'warning',
              summary: reeng.ok ? 'Lead reengajado no CV CRM' : 'Tentativa de reengajamento sem efeito',
              detail: reeng.reason,
              payload: { email, telefone, campanha, ad_id, ad_name },
            });
          } catch (e: unknown) {
            // Nunca bloqueia o fluxo normal de criação por causa dessa checagem
            logger.warn({ e }, '[meta/webhook] checagem de reengajamento falhou — segue fluxo normal');
            await recordIntegrationEvent({
              systemSource: 'longview',
              systemTarget: 'cvcrm',
              entityType: 'lead',
              entityId: leadgen_id,
              externalId: email || telefone || leadgen_id,
              status: 'warning',
              summary: 'Falha na checagem de reengajamento antes do envio ao CV CRM',
              detail: e instanceof Error ? e.message : String(e),
            });
          }
        }

        if (reengajado) {
          // Lead existente já foi reativado no CV CRM — o próprio CV CRM manda o
          // webhook de volta e atualiza o Postgres. Não cria linha nova nem duplicata.
          sendFCMPush(parsed.nome, empreendimento, campanha);
          logger.info(`[meta/webhook] Lead ${leadgen_id} tratado como reengajamento — sem novo cadastro no CV CRM`);
          continue;
        }

        // 3b. Lead novo — cria direto no CV CRM — o ID retornado vira a chave do Postgres
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
          logger.warn(`[meta/webhook] CV CRM falhou para ${leadgen_id}: ${crmResult.error}`);
          await logWebhookError('meta_webhook', `CV CRM falhou: ${crmResult.error}`, { leadgen_id, parsed });
        }
        await recordIntegrationEvent({
          systemSource: 'longview',
          systemTarget: 'cvcrm',
          entityType: 'lead',
          entityId: crmResult.ok ? crmResult.id ?? leadgen_id : leadgen_id,
          externalId: leadgen_id,
          status: crmResult.ok ? 'sent' : 'error',
          summary: crmResult.ok ? 'Lead enviado ao CV CRM' : 'Falha ao enviar lead ao CV CRM',
          detail: crmResult.ok ? campaign_name ?? '' : crmResult.error ?? '',
          payload: { email, telefone, empreendimento, midia },
        });

        // 4. Salva no Postgres com ID do CV CRM (sem duplicata); fallback meta_xxx se CV falhou
        await saveToPostgres(metaLead, parsed, crmResult.ok ? crmResult.id : undefined);

        // 5. RD Station em background (para e-mail e nutrição)
        forwardToRDStation(parsed, leadgen_id);

        // 6. Push FCM para equipe comercial
        sendFCMPush(parsed.nome, empreendimento, campanha);

        logger.info(
          `[meta/webhook] Lead ${leadgen_id} processado — ` +
          `CRM: ${crmResult.ok ? `OK (id=${crmResult.id})` : 'FALHOU'}`
        );
        await recordIntegrationEvent({
          systemSource: 'meta',
          systemTarget: 'longview',
          entityType: 'lead',
          entityId: crmResult.ok ? crmResult.id ?? leadgen_id : leadgen_id,
          externalId: leadgen_id,
          status: 'processed',
          summary: 'Lead da Meta processado no LongView',
          detail: crmResult.ok ? 'Persistido e encaminhado para integrações seguintes' : 'Persistido com fallback local',
          payload: { empreendimento, midia, origem },
        });
      }
    }
  };

  // Inicia processamento assíncrono e responde imediatamente
  processAsync().catch(e => logger.error('[meta/webhook] processAsync error:', e));

  return NextResponse.json({ ok: true, received: true });
}
