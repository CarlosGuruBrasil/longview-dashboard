import { NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { sql } from '@/lib/pg';

export const runtime = 'nodejs';

export async function GET() {
  const user = await verifyPermission('viewSalesVision');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [overviewRows, corretoresRows, funilRows, cicloRows] = await Promise.all([
    // Overview: totais de vendas e ciclo médio
    sql`
      SELECT
        COUNT(*) FILTER (WHERE data_venda IS NOT NULL)                         AS total_vendas,
        ROUND(AVG(tempo_conversao_dias) FILTER (
          WHERE tempo_conversao_dias IS NOT NULL
            AND tempo_conversao_dias >= 0
            AND tempo_conversao_dias < 1000
        ))::int                                                                AS ciclo_medio_dias,
        COUNT(*) FILTER (
          WHERE data_cadastro >= CURRENT_DATE - INTERVAL '30 days'
        )                                                                      AS leads_mes,
        COUNT(*) FILTER (
          WHERE data_venda >= CURRENT_DATE - INTERVAL '30 days'
        )                                                                      AS vendas_mes
      FROM fato_leads
    `,
    // Corretores: ranking por número de vendas (valor_contrato é 0 no CV)
    sql`
      SELECT
        dc.nome,
        dc.imobiliaria,
        COUNT(*)                                                                AS vendas,
        ROUND(AVG(fl.tempo_conversao_dias) FILTER (
          WHERE fl.tempo_conversao_dias IS NOT NULL AND fl.tempo_conversao_dias >= 0
        ))::int                                                                 AS ciclo_medio
      FROM cv_vendas cv
      JOIN dim_corretores dc
        ON dc.id_corretor = (cv.raw->'_reserva'->'corretor'->>'idcorretor_cv')::int
      LEFT JOIN fato_leads fl ON fl.id_lead = (cv.raw->>'idlead')
      GROUP BY dc.nome, dc.imobiliaria
      ORDER BY vendas DESC
    `,
    // Funil: etapas com contagem real de leads
    sql`
      SELECT fe.nome, fe.ordem, COUNT(l.id)::int AS qtd
      FROM funil_etapas fe
      LEFT JOIN leads l ON l.status = fe.nome
      GROUP BY fe.nome, fe.ordem
      ORDER BY fe.ordem, fe.nome
    `,
    // Ciclo de conversão: distribuição por faixas
    sql`
      SELECT
        CASE
          WHEN tempo_conversao_dias = 0           THEN 'No mesmo dia'
          WHEN tempo_conversao_dias BETWEEN 1 AND 7   THEN '1-7 dias'
          WHEN tempo_conversao_dias BETWEEN 8 AND 30  THEN '8-30 dias'
          WHEN tempo_conversao_dias BETWEEN 31 AND 90 THEN '31-90 dias'
          ELSE '90+ dias'
        END AS faixa,
        COUNT(*) AS qtd
      FROM fato_leads
      WHERE tempo_conversao_dias IS NOT NULL
        AND tempo_conversao_dias >= 0
        AND tempo_conversao_dias < 1000
      GROUP BY 1
      ORDER BY MIN(tempo_conversao_dias)
    `,
  ]);

  const overview = overviewRows[0] ?? {};

  return NextResponse.json({
    overview: {
      totalVendas: Number(overview.total_vendas ?? 0),
      cicloMedioDias: Number(overview.ciclo_medio_dias ?? 0),
      leadsMes: Number(overview.leads_mes ?? 0),
      vendasMes: Number(overview.vendas_mes ?? 0),
    },
    corretores: corretoresRows.map((r) => ({
      nome: r.nome,
      imobiliaria: r.imobiliaria,
      vendas: Number(r.vendas),
      cicloMedio: Number(r.ciclo_medio ?? 0),
    })),
    funil: funilRows.map((r) => ({
      nome: r.nome,
      ordem: r.ordem,
      qtd: r.qtd,
    })),
    cicloDistribuicao: cicloRows.map((r) => ({
      faixa: r.faixa,
      qtd: Number(r.qtd),
    })),
  });
}
