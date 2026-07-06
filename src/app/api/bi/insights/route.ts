import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { sql } from '@/lib/pg';

const JWT_SECRET = process.env.JWT_SECRET ?? (() => { throw new Error('[LongView] JWT_SECRET nao configurado. Defina no .env.local') })();

type AuthUser = { role?: string; email?: string };

async function verifyAuth(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch { return null; }
}

export async function GET(_request: NextRequest) {
  const authUser = await verifyAuth();
  if (!authUser) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  try {
    const [funnel, perDev, convTime, campaigns, monthly, summary, pageInsights] = await Promise.all([
      // Funnel: lead distribution by status
      sql<{ name: string; value: number }[]>`
        SELECT COALESCE(NULLIF(status, ''), 'Sem etapa') AS name, COUNT(*)::int AS value
        FROM fato_leads GROUP BY status ORDER BY value DESC
      `,
      // Per-development metrics
      sql`
        SELECT
          COALESCE(e.nome, 'Sem empreendimento') AS nome,
          COUNT(f.id)::int AS leads,
          COUNT(*) FILTER (WHERE f.status ILIKE '%visita%')::int AS visits,
          COUNT(*) FILTER (WHERE f.status ILIKE '%reserva%')::int AS reservations,
          COUNT(*) FILTER (WHERE f.valor_venda > 0)::int AS sales,
          COALESCE(SUM(f.valor_venda), 0) AS vgv,
          CASE WHEN COUNT(*) FILTER (WHERE f.valor_venda > 0) > 0
            THEN ROUND((SUM(f.valor_venda) / COUNT(*) FILTER (WHERE f.valor_venda > 0))::numeric, 2)
            ELSE 0 END AS avg_ticket,
          CASE WHEN COUNT(*) > 0
            THEN ROUND((COUNT(*) FILTER (WHERE f.valor_venda > 0)::numeric / COUNT(*)::numeric) * 100, 1)
            ELSE 0 END AS conversion_pct,
          0 AS cpl
        FROM fato_leads f
        LEFT JOIN dim_empreendimentos e ON f.id_empreendimento = e.id_empreendimento
        GROUP BY e.nome
        ORDER BY leads DESC
      `,
      // Conversion time buckets
      sql`
        SELECT
          CASE
            WHEN tempo_conversao_dias <= 1 THEN 'Até 1 dia'
            WHEN tempo_conversao_dias <= 7 THEN '1-7 dias'
            WHEN tempo_conversao_dias <= 30 THEN '8-30 dias'
            WHEN tempo_conversao_dias <= 90 THEN '31-90 dias'
            ELSE '90+ dias'
          END AS range,
          COUNT(*)::int AS count
        FROM fato_leads
        WHERE tempo_conversao_dias IS NOT NULL
        GROUP BY range
        ORDER BY MIN(tempo_conversao_dias)
      `,
      // Campaign attribution
      sql`
        SELECT
          COALESCE(NULLIF(midia, ''), 'Sem origem') AS campaign_name,
          0 AS spend, 0 AS impressions, 0 AS clicks,
          COUNT(*)::int AS leads,
          COUNT(*) FILTER (WHERE valor_venda > 0)::int AS sales,
          COALESCE(SUM(valor_venda), 0) AS revenue,
          0 AS cpl, 0 AS cac, 0 AS roas
        FROM fato_leads
        GROUP BY midia
        ORDER BY leads DESC
        LIMIT 20
      `,
      // Monthly series
      sql`
        SELECT
          to_char(data_cadastro, 'YYYY-MM') AS month,
          COUNT(*)::int AS leads,
          COUNT(*) FILTER (WHERE valor_venda > 0)::int AS sales,
          COALESCE(SUM(valor_venda), 0) AS vgv,
          0 AS spend
        FROM fato_leads
        WHERE data_cadastro >= CURRENT_DATE - INTERVAL '18 months'
        GROUP BY month
        ORDER BY month
      `,
      // Summary
      sql`
        SELECT
          COUNT(*)::int AS total_leads,
          COUNT(*) FILTER (WHERE valor_venda > 0)::int AS total_sales,
          COALESCE(SUM(valor_venda), 0) AS total_vgv,
          CASE WHEN COUNT(*) FILTER (WHERE valor_venda > 0) > 0
            THEN ROUND((SUM(valor_venda) / COUNT(*) FILTER (WHERE valor_venda > 0))::numeric, 2)
            ELSE 0 END AS avg_ticket,
          COALESCE(ROUND(AVG(tempo_conversao_dias)), 0)::int AS avg_conversion_days,
          0 AS total_spend,
          0 AS cpl, 0 AS cac, 0 AS roas,
          COUNT(*) FILTER (WHERE valor_venda > 0)::int AS leads_with_sale
        FROM fato_leads
      `,
      // Meta page insights (from dim_campanhas_meta or empty)
      Promise.resolve([{ followers: 0, instagram_followers: 0, profile_views: 0, reach: 0, engagement: 0 }]),
    ]);

    const totals = summary[0] as {
      total_leads: number; total_sales: number; total_vgv: number;
      avg_ticket: number; avg_conversion_days: number;
      total_spend: number; cpl: number; cac: number; roas: number; leads_with_sale: number;
    };
    const pInsights = pageInsights[0] as {
      followers: number; instagram_followers: number;
      profile_views: number; reach: number; engagement: number;
    };

    const funnelTotal = funnel.reduce((s, r) => s + r.value, 0);
    const convTimeTyped = convTime as unknown as { range: string; count: number }[];

    return NextResponse.json({
      funnel: funnel.map(r => ({ ...r, percentage: funnelTotal > 0 ? Math.round((r.value / funnelTotal) * 100) : 0 })),
      perDevelopment: perDev,
      conversionTime: convTimeTyped.map(r => {
        const total = convTimeTyped.reduce((s, x) => s + x.count, 0);
        return { ...r, percentage: total > 0 ? Math.round((r.count / total) * 100) : 0 };
      }),
      campaignAttribution: campaigns,
      monthlySeries: monthly,
      summary: {
        totalLeads: totals.total_leads,
        totalSales: totals.total_sales,
        totalVGV: totals.total_vgv,
        avgTicket: totals.avg_ticket,
        avgConversionDays: totals.avg_conversion_days,
        totalSpend: totals.total_spend,
        cpl: totals.cpl,
        cac: totals.cac,
        roas: totals.roas,
        leadsWithSale: totals.leads_with_sale,
      },
      metaPageInsights: pInsights,
      syncedAt: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[/api/bi/insights]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
