/**
 * /api/cron/process-leads
 *
 * Cron a cada 2 horas — processa automaticamente novos leads dos formulários Meta.
 *
 * Fluxo por lead novo:
 *   1. Busca leads Meta capturados desde o último processamento via API
 *   2. Para cada lead novo:
 *      a. Salva no banco (Postgres)
 *      b. Envia ao CV CRM (com custom fields no campo 'mensagem')
 *      c. Envia ao RD Station
 *      d. Envia evento CAPI 'Lead' para o pixel Meta
 *      e. Notifica via Push FCM
 *   3. Atualiza timestamp do último processamento no KV
 */
import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import axios from 'axios';
import { sendCAPIEvents, type CAPIEvent } from '@/app/api/meta/capi/route';
import { createCrmLead } from '@/lib/cvcrm';
import { reengajarLeadPorContato } from '@/lib/leadReativacao';
import logger from '@/lib/logger';
import { sql, ensureSchema } from '@/lib/pg';

const META_BASE = 'https://graph.facebook.com/v21.0';
const PAGE_ID   = '259079394232614';

type MetaForm = { id: string; name: string; status: string };
type MetaFieldDatum = { name: string; values: string[] };
type MetaLead = {
  id: string;
  created_time: string;
  field_data?: MetaFieldDatum[];
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_name?: string;
  form_id?: string;
  _form_name?: string;
};
type ProcessStats = {
  startedAt: string;
  finishedAt?: string;
  error?: string;
  newLeads: number;
  sentToRD: number;
  sentToCV: number;
  capiSent: number;
  reengaged: number;
  errors: number;
  ok: boolean;
};

function metaAuth() {
  return { access_token: process.env.META_TOKEN };
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
      fields: 'id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id',
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

// Extrai campos do lead Meta (buscando por substrings nas chaves)
function extractField(fieldData: MetaFieldDatum[], keys: string[]): string {
  const entry = fieldData.find(f => keys.some(k => (f.name || '').toLowerCase().includes(k)));
  return entry?.values?.[0] || '';
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

// Extrai campos customizados do form do Meta (todas as respostas)
function extractCustomFieldsAsMessage(fieldData: MetaFieldDatum[]): string {
  const ignoredKeys = ['name', 'nome', 'full_name', 'email', 'e-mail', 'phone', 'telefone', 'cel', 'whatsapp'];
  const extraInfo: string[] = [];

  for (const field of fieldData) {
    if (!field.name || !field.values || field.values.length === 0) continue;
    const isIgnored = ignoredKeys.some(k => field.name.toLowerCase().includes(k));
    if (!isIgnored) {
      // Formata nome legível
      const readableKey = field.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      extraInfo.push(`${readableKey}: ${field.values.join(', ')}`);
    }
  }
  return extraInfo.join(' | ');
}

// Envia push FCM para equipe comercial
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
  }).catch(() => logger.warn('[process-leads] FCM push falhou'));
}

async function saveToPostgres(lead: MetaLead, parsed: any, cvId?: string | number): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await ensureSchema();
    const id = cvId ? String(cvId) : `meta_${lead.id}`;
    const metaRaw = { ...lead, _source: 'process_leads_cron', _parsed: parsed };
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
        ${rawVal as never},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        nome             = EXCLUDED.nome,
        email            = EXCLUDED.email,
        telefone         = EXCLUDED.telefone,
        origem           = COALESCE(leads.origem, EXCLUDED.origem),
        empreendimento   = COALESCE(leads.empreendimento, EXCLUDED.empreendimento),
        data_atualizacao = EXCLUDED.data_atualizacao,
        raw              = leads.raw || jsonb_build_object('_meta', ${metaRaw as never}),
        synced_at        = NOW()
    `;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    logger.warn({ msg }, '[process-leads] saveToPostgres falhou:');
  }
}

// Calcula score básico para um lead recém-capturado
function calcInitialScore(lead: MetaLead): number {
  let score = 15;
  const fields = lead.field_data || [];
  const phone = extractField(fields, ['phone', 'telefone', 'cel', 'whatsapp']);
  const email = extractField(fields, ['email', 'e-mail']);
  if (phone) score += 5;
  if (email) score += 5;
  return Math.min(score, 100);
}

function getTier(score: number) {
  if (score >= 75) return { label: 'quente', conversion_id: 'lead_quente_longview' };
  if (score >= 40) return { label: 'morno',  conversion_id: 'lead_morno_longview'  };
  return             { label: 'frio',   conversion_id: 'lead_frio_longview'   };
}

// Envia lead para o RD Station
async function sendToRD(lead: MetaLead, score: number, midia: string, empreendimento: string): Promise<boolean> {
  const apiKey = process.env.RD_TOKEN_PUBLIC;
  if (!apiKey) return false;

  const fields  = lead.field_data || [];
  const nome    = extractField(fields, ['name', 'nome', 'full_name']);
  const email   = extractField(fields, ['email', 'e-mail']);
  const phone   = extractField(fields, ['phone', 'telefone', 'cel', 'whatsapp']);

  if (!email && !phone) return false;

  const tier = getTier(score);
  const payload: Record<string, unknown> = {
    conversion_identifier: 'lead_meta_ads',
    cf_score_intencao:    String(score),
    cf_temperatura_lead:  tier.label,
    cf_origem_captacao:   'meta_ads_form',
    cf_data_score:        new Date().toISOString().split('T')[0],
    cf_campanha_meta:     midia,
    cf_empreendimento:    empreendimento,
    tags:                 [`score_${tier.label}`, 'meta_form', 'auto_captured', 'process_leads_cron'],
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

function isCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const auth   = request.headers.get('Authorization') || '';
  if (!secret) return false; // fail-safe: exige CRON_SECRET em produção
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isCron(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const log: string[]  = [];
  const stats: ProcessStats = { startedAt, newLeads: 0, sentToRD: 0, sentToCV: 0, capiSent: 0, reengaged: 0, errors: 0, ok: false };

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
        const nome   = extractField(fields, ['name', 'nome', 'full_name']) || email || 'Lead Meta';
        
        const campanha = lead.campaign_name || lead.adset_name || lead._form_name || '';
        const midia = campanha;
        const empreendimento = empFromCampaign(campanha);
        const origem = 'Meta Lead Ads';
        
        const score = calcInitialScore(lead);
        const tier  = getTier(score);

        const customFieldsMessage = extractCustomFieldsAsMessage(fields);
        
        const parsed = {
          nome,
          email,
          telefone: phone,
          empreendimento,
          midia,
          origem,
          mensagem: customFieldsMessage || undefined,
        };

        // Lead já cadastrado preenchendo o formulário de novo? Reativa em vez de duplicar
        // no CV CRM (mesma checagem do /api/meta/webhook — evita duplicata quando o
        // contato já existe, seja de uma captura anterior via webhook ou via CV CRM).
        let reengajado = false;
        if (email || phone) {
          try {
            const reeng = await reengajarLeadPorContato({
              email, telefone: phone,
              motivo: `Reengajamento via Meta Ads (cron process-leads) — preencheu o formulário novamente. Campanha: ${campanha || '?'}`,
            });
            reengajado = reeng.ok;
            log.push(`[reengajamento] lead ${lead.id}: ${reeng.reason}`);
          } catch (e: unknown) {
            // Nunca bloqueia o fluxo normal de criação por causa dessa checagem
            log.push(`[WARN] checagem de reengajamento falhou para ${lead.id} — segue fluxo normal`);
          }
        }

        if (reengajado) {
          stats.reengaged++;
          sendFCMPush(nome, empreendimento, campanha);
          processedSet.add(lead.id);
          log.push(`[OK] Lead ${lead.id} tratado como reengajamento — sem novo cadastro no CV CRM`);
          continue;
        }

        // Envia para o CV CRM
        const cvRes = await createCrmLead(parsed);
        if (cvRes.ok) stats.sentToCV++;
        else log.push(`[ERR] Falha CV CRM Lead ${lead.id}: ${cvRes.error}`);

        // Salva no Postgres
        await saveToPostgres(lead, parsed, cvRes.ok ? cvRes.id : undefined);

        // Envia para RD Station
        const rdOk = await sendToRD(lead, score, midia, empreendimento);
        if (rdOk) stats.sentToRD++;

        // FCM Notificação
        sendFCMPush(nome, empreendimento, campanha);

        // Prepara evento CAPI
        if (email || phone) {
          capiEvents.push({
            event_name:  'Lead',
            lead_id:     lead.id,
            email:       email  || undefined,
            phone:       phone  || undefined,
            first_name:  nome   || undefined,
            event_id:    `meta_form_${lead.id}`,
            event_time:  Math.floor(new Date(lead.created_time).getTime() / 1000),
          });
        }

        // Marca como processado
        processedSet.add(lead.id);

        log.push(`[OK] Lead ${lead.id} — CRM: ${cvRes.ok ? 'ok' : 'fail'} — RD: ${rdOk ? 'ok' : 'fail'}`);
      } catch (err: any) {
        stats.errors++;
        log.push(`[ERR] Lead ${lead.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Envia todos os eventos CAPI de uma vez
    if (capiEvents.length > 0) {
      const capiResult = await sendCAPIEvents(capiEvents);
      stats.capiSent = capiResult.sent;
      log.push(`[CAPI] ${capiResult.sent} eventos Lead enviados ao pixel`);
    }

    // Atualiza KV
    const processedArr = [...processedSet].slice(-2000);
    await kv.set('meta:leads:processed', processedArr);
    await kv.set('meta:leads:lastFetch',  nowUnix);

    stats.ok         = true;
    stats.finishedAt = new Date().toISOString();

    await kv.set('meta:leads:lastRun',   stats.finishedAt);
    await kv.set('meta:leads:lastStats', stats);

    log.push(`[✓] Concluído: ${stats.newLeads} leads, ${stats.sentToCV} → CRM, ${stats.sentToRD} → RD, ${stats.capiSent} → CAPI`);
    logger.info({ stats }, '[cron/process-leads]');

    return NextResponse.json({ ...stats, log });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    stats.error      = msg;
    stats.finishedAt = new Date().toISOString();
    log.push(`[ERRO FATAL] ${msg}`);
    await kv.set('meta:leads:lastStats', stats);
    logger.error({ msg }, '[cron/process-leads] Erro:');
    return NextResponse.json({ ...stats, log }, { status: 500 });
  }
}
