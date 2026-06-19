/**
 * /api/cron/recalc-scores
 *
 * Cron diário (04h BRT) — recalcula scores de intenção e envia eventos CAPI.
 *
 * Fluxo:
 *   1. Busca leads ativos do CVCRM (últimos 60 dias)
 *   2. Busca leads Meta recentes para cruzamento
 *   3. Para cada lead CRM, calcula score cruzado (mesmo algoritmo da view Score)
 *   4. Envia leads quentes e mornos ao RD Station com score atualizado
 *   5. Envia eventos CAPI ViewContent (leads quentes) para o pixel Meta
 *   6. Registra resultado no KV
 */
import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import axios from 'axios';
import { sendCAPIEvents } from '@/app/api/meta/capi/route';

function isCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const auth       = request.headers.get('Authorization') || '';
  if (!cronSecret) return false; // fail-safe
  return auth === `Bearer ${cronSecret}`;
}

// ── Score engine (igual ao marketing-vision/page.tsx) ────────────────────────
function calcScore(crmLead: any, metaMatch: any | null): number {
  let score = 0;

  if (metaMatch)                    score += 30; // Match Meta × CRM
  if (metaMatch?.ad_id)             score += 15; // Origem Lead Ad

  // Etapa no funil
  const etapa = (crmLead.etapa || crmLead.situacao_etapa || '').toLowerCase();
  if (/qualific|proposta|negoci|contrato/i.test(etapa)) score += 20;
  else if (/atend|interest|triag/i.test(etapa))         score += 15;

  // Corretor atribuído
  if (crmLead.corretor || crmLead.responsavel || crmLead.vendedor) score += 5;

  // Telefone válido
  const tel = (crmLead.telefone || crmLead.celular || '').replace(/\D/g, '');
  if (tel.length >= 10) score += 5;

  // Tempo sem contato (penalidade)
  const ultimoContato = crmLead.data_ultimo_contato || crmLead.updated_at || crmLead.created_at;
  if (ultimoContato) {
    const dias = (Date.now() - new Date(ultimoContato).getTime()) / 86400000;
    if (dias > 30) score -= 15;
    else if (dias > 7) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

function getTier(score: number) {
  if (score >= 75) return { label: 'quente', conversion_id: 'lead_quente_longview' };
  if (score >= 40) return { label: 'morno',  conversion_id: 'lead_morno_longview'  };
  return             { label: 'frio',   conversion_id: 'lead_frio_longview'   };
}

// Padrões de etapa "Sem Conexão" no CV CRM
const SEM_CONEXAO_PATTERNS = [
  'sem conexão', 'sem conexao', 'sem contato', 'semconexao', 'sem_conexao',
  'inativo', 'lost contact', 'perdido contato',
];

function isSemConexaoEtapa(etapaNome: string): boolean {
  const n = (etapaNome || '').toLowerCase().trim();
  return SEM_CONEXAO_PATTERNS.some(p => n.includes(p));
}

// TTL do dedup: 90 dias. Lead parado na etapa nao recebe novamente.
const SEM_CONEXAO_DEDUP_TTL = 90 * 86400;

/**
 * Identidade estavel do lead para deduplicacao.
 * Prioridade: email > telefone > id do CRM.
 * O RD Station identifica contatos por email, entao email e a chave primaria.
 * Inclui idlead/referencia porque o CV CRM nao retorna "id" em todos os endpoints.
 */
function getSemConexaoDedupKey(lead: any): string | null {
  const email = String(lead.email || lead.email_principal || '').toLowerCase().trim();
  const phone = String(lead.telefone || lead.celular || lead.fone || '').replace(/\D/g, '');
  const leadId = String(
    lead.idlead || lead.id_lead || lead.id || lead.codigo || lead.lead_id || lead.referencia || ''
  ).trim();
  if (email)  return `cv:sem_conexao:sent:email:${email}`;
  if (phone)  return `cv:sem_conexao:sent:phone:${phone}`;
  if (leadId) return `cv:sem_conexao:sent:${leadId}`;
  return null;
}

async function fetchActiveLeads(): Promise<any[]> {
  const email   = process.env.CV_CRM_EMAIL;
  const token   = process.env.CV_CRM_TOKEN;
  const base    = 'https://longviewempreendimentos.cvcrm.com.br/api/v1';
  const headers = { email, token, Accept: 'application/json' };

  const since60 = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];

  try {
    const res = await axios.get(`${base}/comercial/leads`, {
      headers,
      params: { limit: 1000, situacao: 'Ativo', data_criacao_inicio: since60 },
      timeout: 25000,
    });
    return res.data?.leads || [];
  } catch (err: any) {
    // fallback sem filtro de data
    const res = await axios.get(`${base}/comercial/leads`, {
      headers, params: { limit: 1000, situacao: 'Ativo' }, timeout: 25000,
    });
    return res.data?.leads || [];
  }
}

// Busca todos os leads dos últimos 30 dias (incluindo sem conexão)
async function fetchAllRecentLeads(): Promise<any[]> {
  const email   = process.env.CV_CRM_EMAIL;
  const token   = process.env.CV_CRM_TOKEN;
  const base    = 'https://longviewempreendimentos.cvcrm.com.br/api/v1';
  const headers = { email, token, Accept: 'application/json' };
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  try {
    const res = await axios.get(`${base}/comercial/leads`, {
      headers,
      params: { limit: 1000, data_criacao_inicio: since30 }, // sem filtro de situacao
      timeout: 25000,
    });
    return res.data?.leads || [];
  } catch {
    return [];
  }
}

// Dispara gatilho "Sem Conexão" no RD Station
async function triggerSemConexaoRD(lead: any): Promise<boolean> {
  const apiKey  = process.env.RD_TOKEN_PUBLIC;
  const email   = lead.email?.toLowerCase()?.trim();
  const phone   = lead.telefone || lead.celular || '';
  if (!apiKey || (!email && !phone)) return false;

  const etapa = lead.etapa?.nome || lead.etapa || 'Sem Conexão';
  const payload: Record<string, any> = {
    conversion_identifier: 'sem_conexao_longview',
    cf_etapa_crm:          etapa,
    cf_origem_captacao:    'crm_cron',
    cf_data_score:         new Date().toISOString().split('T')[0],
    tags:                  ['sem_conexao', 'reativacao_automatica', 'cv_crm'],
    available_for_mailing: true,
    legal_bases: [{ category: 'communications', type: 'consent', status: 'granted' }],
  };
  if (email)     payload.email          = email;
  if (lead.nome) payload.name           = lead.nome;
  if (phone)     payload.personal_phone = phone;

  try {
    await axios.post(
      'https://api.rd.services/platform/conversions',
      { event_type: 'CONVERSION', event_family: 'CDP', payload },
      { params: { api_key: apiKey }, timeout: 12000 }
    );
    return true;
  } catch (err: any) {
    console.warn('[recalc] sem_conexao RD error:', err.response?.data || err.message);
    return false;
  }
}

async function fetchRecentMetaLeads(): Promise<any[]> {
  const PAGE_ID   = '259079394232614';
  const META_BASE = 'https://graph.facebook.com/v21.0';

  // Busca leads Meta das últimas 2 semanas para cruzamento
  const since14 = Math.floor((Date.now() - 14 * 86400000) / 1000);

  try {
    const pageRes = await axios.get(`${META_BASE}/${PAGE_ID}`, {
      params: { fields: 'access_token', access_token: process.env.META_TOKEN },
      timeout: 10000,
    });
    const pageToken = pageRes.data?.access_token || process.env.META_TOKEN;

    const formsRes = await axios.get(`${META_BASE}/${PAGE_ID}/leadgen_forms`, {
      params: { fields: 'id', limit: 20, access_token: pageToken },
      timeout: 10000,
    });
    const forms = formsRes.data?.data || [];

    const allLeads: any[] = [];
    for (const form of forms.slice(0, 5)) { // top 5 forms
      try {
        const res = await axios.get(`${META_BASE}/${form.id}/leads`, {
          params: {
            fields:     'id,field_data,created_time',
            limit:      100,
            access_token: pageToken,
            filtering:  JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: since14 }]),
          },
          timeout: 15000,
        });
        allLeads.push(...(res.data?.data || []));
      } catch { /* ignora */ }
    }
    return allLeads;
  } catch {
    return [];
  }
}

function crossMatch(crmLead: any, metaLeads: any[]): any | null {
  const crmPhone = (crmLead.telefone || crmLead.celular || '').replace(/\D/g, '');
  const crmEmail = (crmLead.email || '').toLowerCase().trim();
  const crmNome  = (crmLead.nome  || '').toLowerCase().trim();

  return metaLeads.find(ml => {
    const fields = ml.field_data || [];
    const mlPhone = (fields.find((f: any) => /phone|tel|cel|whats/i.test(f.name))?.values?.[0] || '').replace(/\D/g, '');
    const mlEmail = (fields.find((f: any) => /email/i.test(f.name))?.values?.[0] || '').toLowerCase().trim();
    const mlNome  = (fields.find((f: any) => /name|nome/i.test(f.name))?.values?.[0] || '').toLowerCase().trim();

    if (mlEmail && crmEmail && mlEmail === crmEmail) return true;
    if (mlPhone && crmPhone && mlPhone.slice(-8) === crmPhone.slice(-8)) return true;
    if (mlNome && crmNome && mlNome.length > 3 && crmNome.includes(mlNome.split(' ')[0])) return true;
    return false;
  }) || null;
}

async function sendScoreToRD(lead: any, score: number): Promise<boolean> {
  const apiKey = process.env.RD_TOKEN_PUBLIC;
  if (!apiKey) return false;

  const email   = lead.email?.toLowerCase()?.trim();
  const phone   = lead.telefone || lead.celular || '';
  if (!email && !phone) return false;

  const tier    = getTier(score);
  const payload: Record<string, any> = {
    conversion_identifier: tier.conversion_id,
    cf_score_intencao:    String(score),
    cf_temperatura_lead:  tier.label,
    cf_origem_captacao:   'crm_auto',
    cf_data_score:        new Date().toISOString().split('T')[0],
    tags:                 [`score_${tier.label}`, 'recalc_diario'],
    available_for_mailing: true,
    legal_bases: [{ category: 'communications', type: 'consent', status: 'granted' }],
  };
  if (email) payload.email          = email;
  if (lead.nome) payload.name       = lead.nome;
  if (phone)     payload.personal_phone = phone;

  try {
    await axios.post(
      'https://api.rd.services/platform/conversions',
      { event_type: 'CONVERSION', event_family: 'CDP', payload },
      { params: { api_key: apiKey }, timeout: 12000 }
    );
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const stats: any = {
    startedAt, ok: false,
    total: 0, quentes: 0, mornos: 0, frios: 0,
    sentToRD: 0, capiSent: 0, errors: 0,
    semConexao: 0, semConexaoSentRD: 0,
  };

  try {
    const [crmLeads, metaLeads, allRecentLeads] = await Promise.all([
      fetchActiveLeads(),
      fetchRecentMetaLeads(),
      fetchAllRecentLeads(),
    ]);

    stats.total = crmLeads.length;
    console.log(`[recalc-scores] ${crmLeads.length} leads CRM, ${metaLeads.length} leads Meta`);

    const rdQueue: any[]    = [];
    const capiQueue: any[]  = [];
    const distribution: Record<string, number> = { quente: 0, morno: 0, frio: 0 };

    for (const lead of crmLeads) {
      try {
        const match = crossMatch(lead, metaLeads);
        const score = calcScore(lead, match);
        const tier  = getTier(score);

        distribution[tier.label]++;

        // Envia ao RD apenas quentes e mornos para não saturar a API
        if (score >= 40) {
          rdQueue.push({ lead, score });
        }

        // CAPI ViewContent para leads quentes (ensina o Meta quem tem alta intenção)
        if (score >= 75) {
          const email = lead.email?.toLowerCase()?.trim();
          const phone = (lead.telefone || lead.celular || '').replace(/\D/g, '');
          if (email || phone) {
            capiQueue.push({
              event_name:  'ViewContent',
              email:       email || undefined,
              phone:       phone || undefined,
              first_name:  lead.nome || undefined,
              event_id:    `hot_lead_${lead.id || lead.codigo}_${Date.now()}`,
            });
          }
        }
      } catch { stats.errors++; }
    }

    stats.quentes = distribution.quente;
    stats.mornos  = distribution.morno;
    stats.frios   = distribution.frio;

    // Processa fila RD em paralelo (lotes de 10 simultâneos para respeitar rate limit)
    const BATCH_RD = 10;
    for (let i = 0; i < rdQueue.length; i += BATCH_RD) {
      const batch = rdQueue.slice(i, i + BATCH_RD);
      const results = await Promise.allSettled(
        batch.map(({ lead, score }) => sendScoreToRD(lead, score))
      );
      stats.sentToRD += results.filter(r => r.status === 'fulfilled' && r.value).length;
    }

    // Envia CAPI para leads quentes
    if (capiQueue.length > 0) {
      const capiResult = await sendCAPIEvents(capiQueue.slice(0, 100)); // cap 100/run
      stats.capiSent = capiResult.sent;
    }

    // ── Fallback: detecta leads "Sem Conexão" não capturados pelo webhook ──
    const semConexaoLeads = allRecentLeads.filter(lead => {
      const etapaNome    = lead.etapa?.nome    || lead.etapa    || '';
      const situacaoNome = lead.situacao?.nome || lead.situacao || '';
      return isSemConexaoEtapa(etapaNome) || isSemConexaoEtapa(situacaoNome);
    });

    stats.semConexao = semConexaoLeads.length;
    console.log(`[recalc-scores] ${semConexaoLeads.length} leads Sem Conexão encontrados`);

    // Modo seed: marca os leads atuais como ja processados SEM disparar o RD.
    // Uso unico apos deploy: /api/cron/recalc-scores?seed=1
    const seedOnly = new URL(request.url).searchParams.get('seed') === '1';

    for (const lead of semConexaoLeads) {
      try {
        const dedupKey = getSemConexaoDedupKey(lead);

        // Sem identidade estavel (sem email, telefone e id): nunca dispara.
        // Disparar sem dedup foi a causa de emails duplicados diarios.
        if (!dedupKey) {
          stats.semConexaoSkipped = (stats.semConexaoSkipped || 0) + 1;
          continue;
        }

        const alreadySent = await kv.get(dedupKey);
        if (alreadySent) continue; // webhook ou cron anterior ja processou

        if (seedOnly) {
          await kv.set(dedupKey, `seed:${new Date().toISOString()}`, { ex: SEM_CONEXAO_DEDUP_TTL });
          stats.semConexaoSeeded = (stats.semConexaoSeeded || 0) + 1;
          continue;
        }

        const ok = await triggerSemConexaoRD(lead);
        if (ok) {
          stats.semConexaoSentRD++;
          await kv.set(dedupKey, new Date().toISOString(), { ex: SEM_CONEXAO_DEDUP_TTL });
          // Log no webhook KV para aparecer no painel
          const existing: any[] = (await kv.get('cv:webhook:log')) || [];
          const entry = {
            ts:        new Date().toISOString(),
            leadId:    dedupKey.split(':').pop(),
            nome:      lead.nome || '?',
            etapa:     lead.etapa?.nome || lead.etapa || 'Sem Conexão',
            evento:    'sem_conexao_cron',
            triggered: true,
            rdOk:      true,
          };
          await kv.set('cv:webhook:log', [entry, ...existing].slice(0, 200));
          const count = ((await kv.get<number>('cv:webhook:sem_conexao_count')) || 0) + 1;
          await kv.set('cv:webhook:sem_conexao_count', count);
        }
      } catch { stats.errors++; }
    }

    stats.ok         = true;
    stats.finishedAt = new Date().toISOString();

    await kv.set('meta:scores:lastRun',   stats.finishedAt);
    await kv.set('meta:scores:lastStats', stats);

    console.log('[recalc-scores] Concluído:', stats);
    return NextResponse.json(stats);
  } catch (err: any) {
    stats.error      = err.message;
    stats.finishedAt = new Date().toISOString();
    await kv.set('meta:scores:lastStats', stats);
    console.error('[recalc-scores] Erro:', err.message);
    return NextResponse.json(stats, { status: 500 });
  }
}
