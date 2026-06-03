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
import { kv } from '@vercel/kv';
import axios from 'axios';
import { sendCAPIEvents } from '@/app/api/meta/capi/route';

function isCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const auth       = request.headers.get('Authorization') || '';
  return !cronSecret || auth === `Bearer ${cronSecret}`;
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
      'https://api.rd.services/platform/events',
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
  };

  try {
    const [crmLeads, metaLeads] = await Promise.all([
      fetchActiveLeads(),
      fetchRecentMetaLeads(),
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
