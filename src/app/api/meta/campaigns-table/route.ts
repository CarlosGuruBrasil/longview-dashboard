/**
 * /api/meta/campaigns-table
 * GET → campanhas da Meta API (status, budget) + métricas do banco (spend, leads, impressões)
 * Alimenta a tabela estilo Meta Ads Manager no GestaoAdsView
 */
import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { sql } from '@/lib/pg';
import axios from 'axios';
import logger from '@/lib/logger';

const META_BASE = 'https://graph.facebook.com/v21.0';
const META_ACT_ID = process.env.META_ACT_ID;

type MetaCampaignRaw = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective?: string;
  buying_type?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time?: string;
};

type MetaListResponse = { data?: MetaCampaignRaw[]; paging?: unknown };

function metaAuth() {
  return { access_token: process.env.META_TOKEN };
}

export async function GET() {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    // 1. Campanhas da Meta API (status real + budget) e métricas do DB — em paralelo
    const [metaRes, dbMetrics] = await Promise.allSettled([
      axios.get<MetaListResponse>(`${META_BASE}/${META_ACT_ID}/campaigns`, {
        params: {
          fields: 'id,name,status,effective_status,objective,buying_type,daily_budget,lifetime_budget,created_time',
          limit: 200,
          ...metaAuth(),
        },
        timeout: 12000,
      }),
      sql`
        SELECT
          m.id_campanha,
          COALESCE(SUM(m.spend),0)::float          AS spend,
          COALESCE(SUM(m.impressions),0)::bigint   AS impressions,
          COALESCE(SUM(m.clicks),0)::bigint        AS clicks,
          COALESCE(SUM(m.leads_meta),0)::bigint    AS leads,
          COALESCE(SUM(m.reach),0)::bigint         AS reach,
          MIN(m.data)                              AS data_inicio,
          MAX(m.data)                              AS data_fim
        FROM fato_midia_paga m
        GROUP BY m.id_campanha
      `,
    ]);

    // Métricas do DB por id_campanha
    const metricsMap = new Map<string, Record<string, number>>();
    if (dbMetrics.status === 'fulfilled') {
      for (const row of dbMetrics.value as Record<string, unknown>[]) {
        metricsMap.set(String(row.id_campanha), {
          spend:       Number(row.spend ?? 0),
          impressions: Number(row.impressions ?? 0),
          clicks:      Number(row.clicks ?? 0),
          leads:       Number(row.leads ?? 0),
          reach:       Number(row.reach ?? 0),
        });
      }
    }

    // Campanhas da Meta API (fallback: tabela do banco se API falhar)
    let campaigns: MetaCampaignRaw[] = [];
    if (metaRes.status === 'fulfilled') {
      campaigns = metaRes.value.data?.data ?? [];
    } else {
      logger.warn('[campaigns-table] Meta API falhou, usando dim_campanhas_meta do banco');
      const dbCamps = await sql`
        SELECT id_campanha AS id, nome AS name, status, status AS effective_status,
               objective, buying_type, created_time
        FROM dim_campanhas_meta
        ORDER BY created_time DESC
      `;
      campaigns = (dbCamps as Record<string, string>[]).map(r => ({
        id: r.id, name: r.name, status: r.status,
        effective_status: r.effective_status, objective: r.objective,
        buying_type: r.buying_type, created_time: r.created_time,
      }));
    }

    // Monta o payload final
    const result = campaigns.map(c => {
      const m = metricsMap.get(c.id) ?? { spend: 0, impressions: 0, clicks: 0, leads: 0, reach: 0 };
      const dailyBudget   = c.daily_budget   ? Number(c.daily_budget)   / 100 : null;
      const lifetimeBudget = c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null;
      const cpl  = m.leads > 0 ? m.spend / m.leads : 0;
      const ctr  = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
      const hasDelivery = m.spend > 0 || m.impressions > 0;

      return {
        id:              c.id,
        name:            c.name,
        status:          c.status,          // ACTIVE | PAUSED
        effectiveStatus: c.effective_status, // ACTIVE | PAUSED | WITH_ISSUES | etc.
        objective:       c.objective ?? null,
        buyingType:      c.buying_type ?? null,
        dailyBudget,
        lifetimeBudget,
        createdTime:     c.created_time ?? null,
        // Métricas acumuladas do banco
        spend:      m.spend,
        impressions: m.impressions,
        clicks:     m.clicks,
        leads:      m.leads,
        reach:      m.reach,
        cpl:        Math.round(cpl * 100) / 100,
        ctr:        Math.round(ctr * 100) / 100,
        hasDelivery,
      };
    });

    // Ordena: ativas primeiro, depois por spend desc
    result.sort((a, b) => {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
      return b.spend - a.spend;
    });

    return NextResponse.json({ campaigns: result, total: result.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ msg }, '[/api/meta/campaigns-table]');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
