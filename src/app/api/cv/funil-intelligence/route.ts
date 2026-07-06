import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { sql, ensureSchema } from '@/lib/pg';
import type { FunilIntelligenceData } from '@/app/marketing-vision/types';
import logger from '@/lib/logger'

const JWT_SECRET = process.env.JWT_SECRET ?? (() => { throw new Error('[LongView] JWT_SECRET nao configurado. Defina no .env.local') })();
export const runtime = 'nodejs';
export const revalidate = 0;

type AuthUser = { role?: string; email?: string };

async function verifyAuth(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch { return null; }
}

export async function GET() {
  const authUser = await verifyAuth();
  if (!authUser) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  try {
    await ensureSchema();

    // ── 1. Contagem de leads por etapa (funil de leads) ────────────────────────
    const [leadsTotal, vendasRows, cycleRows, monthlyRows, corretoresRows, originRows] = await Promise.all([

      // Total de leads na base
      sql<{ total: number }[]>`SELECT COUNT(*)::int AS total FROM leads`,

      // Vendas/reservas do CVDW com campos completos
      sql`
        SELECT
          COUNT(*)::int                                                         AS total_reservas,
          COUNT(*) FILTER (WHERE raw->>'aprovada' = '1' OR raw->>'aprovada' = 'true')::int AS aprovadas,
          COUNT(*) FILTER (WHERE raw->>'aprovada' = '0' OR raw->>'aprovada' = 'false')::int AS canceladas,
          COALESCE(SUM((raw->>'valor_contrato')::numeric FILTER (WHERE raw->>'valor_contrato' IS NOT NULL)), 0) AS total_vgv,
          CASE
            WHEN COUNT(*) FILTER (WHERE raw->>'valor_contrato' IS NOT NULL) > 0
            THEN ROUND(
              (SUM((raw->>'valor_contrato')::numeric) FILTER (WHERE raw->>'valor_contrato' IS NOT NULL)) /
              NULLIF(COUNT(*) FILTER (WHERE raw->>'valor_contrato' IS NOT NULL), 0)
            , 2)
            ELSE 0
          END AS ticket_medio,
          COALESCE(ROUND(AVG(
            CASE
              WHEN raw->>'data_reserva' IS NOT NULL AND raw->>'data_venda' IS NOT NULL
              THEN (raw->>'data_venda')::date - (raw->>'data_reserva')::date
              ELSE NULL
            END
          )), 0)::int AS avg_days_reserva_to_venda
        FROM cv_vendas
      `,

      // Ciclo médio por empreendimento (Leads + Reservas cruzados)
      sql`
        SELECT
          COALESCE(v.raw->>'empreendimento', 'Não Informado')       AS empreendimento,
          COUNT(DISTINCT l.id)::int                                  AS leads,
          COUNT(DISTINCT v.id)::int                                  AS reservas,
          COALESCE(SUM((v.raw->>'valor_contrato')::numeric FILTER (WHERE v.raw->>'valor_contrato' IS NOT NULL)), 0) AS vgv,
          ROUND(AVG(
            CASE
              WHEN l.data_cadastro IS NOT NULL AND v.data_venda IS NOT NULL
              THEN v.data_venda::date - l.data_cadastro::date
              ELSE NULL
            END
          ))::int AS avg_days_lead_to_venda
        FROM cv_vendas v
        LEFT JOIN leads l ON
          l.id = v.raw->>'idlead'
          OR (l.raw->>'email' IS NOT NULL AND l.raw->>'email' = v.raw->>'email')
          OR (l.raw->>'telefone' IS NOT NULL AND l.raw->>'telefone' = v.raw->>'telefone')
        GROUP BY empreendimento
        ORDER BY vgv DESC
        LIMIT 10
      `,

      // Série mensal de leads + reservas + VGV
      sql`
        SELECT
          to_char(data_venda, 'YYYY-MM') AS month,
          COUNT(*)::int                  AS reservas,
          COALESCE(SUM(valor), 0)        AS vgv
        FROM cv_vendas
        WHERE data_venda >= CURRENT_DATE - INTERVAL '18 months'
        GROUP BY month
        ORDER BY month
      `,

      // Top corretores por VGV
      sql`
        SELECT
          COALESCE(NULLIF(raw->>'corretor', ''), 'Sem Corretor')     AS corretor,
          COUNT(*)::int                                               AS reservas,
          COALESCE(SUM((raw->>'valor_contrato')::numeric FILTER (WHERE raw->>'valor_contrato' IS NOT NULL)), 0) AS vgv,
          CASE
            WHEN COUNT(*) > 0
            THEN ROUND(COALESCE(SUM((raw->>'valor_contrato')::numeric FILTER (WHERE raw->>'valor_contrato' IS NOT NULL)), 0) / COUNT(*), 2)
            ELSE 0
          END AS ticket_medio,
          COUNT(*) FILTER (WHERE raw->>'aprovada' = '0' OR raw->>'aprovada' = 'false')::int AS cancelamentos
        FROM cv_vendas
        GROUP BY corretor
        ORDER BY vgv DESC
        LIMIT 8
      `,

      // VGV e leads por origem/mídia (cruzamento Lead + CVDW)
      sql`
        SELECT
          COALESCE(NULLIF(l.origem, ''), 'Desconhecida')             AS origem,
          COUNT(DISTINCT l.id)::int                                  AS leads,
          COUNT(DISTINCT v.id)::int                                  AS reservas,
          COALESCE(SUM((v.raw->>'valor_contrato')::numeric FILTER (WHERE v.raw->>'valor_contrato' IS NOT NULL)), 0) AS vgv,
          CASE WHEN COUNT(DISTINCT l.id) > 0 THEN 0 ELSE 0 END      AS cpl,
          CASE WHEN COUNT(DISTINCT v.id) > 0
            THEN ROUND(COALESCE(SUM((v.raw->>'valor_contrato')::numeric FILTER (WHERE v.raw->>'valor_contrato' IS NOT NULL)), 0) / NULLIF(COUNT(DISTINCT v.id), 0), 2)
            ELSE 0
          END AS ticket_medio
        FROM leads l
        LEFT JOIN cv_vendas v ON (
          v.raw->>'idlead' = l.id
          OR (l.raw->>'email' IS NOT NULL AND l.raw->>'email' = v.raw->>'email')
          OR (l.raw->>'telefone' IS NOT NULL AND l.raw->>'telefone' = v.raw->>'telefone')
        )
        GROUP BY origem
        ORDER BY vgv DESC, leads DESC
        LIMIT 15
      `,
    ]);

    const totalLeads = leadsTotal[0]?.total ?? 0;
    const vendasSummary = vendasRows[0] as {
      total_reservas: number; aprovadas: number; canceladas: number;
      total_vgv: number; ticket_medio: number; avg_days_reserva_to_venda: number;
    } || { total_reservas: 0, aprovadas: 0, canceladas: 0, total_vgv: 0, ticket_medio: 0, avg_days_reserva_to_venda: 0 };

    // Montar série mensal com fallback de leads da tabela principal
    const leadsMonthly = await sql<{ month: string; leads: number }[]>`
      SELECT
        to_char(data_cadastro, 'YYYY-MM') AS month,
        COUNT(*)::int                      AS leads
      FROM leads
      WHERE data_cadastro >= CURRENT_DATE - INTERVAL '18 months'
      GROUP BY month
      ORDER BY month
    `;

    const monthlyMap = new Map<string, { leads: number; reservas: number; vgv: number }>();
    leadsMonthly.forEach(r => monthlyMap.set(r.month, { leads: r.leads, reservas: 0, vgv: 0 }));
    (monthlyRows as unknown as { month: string; reservas: number; vgv: number }[]).forEach(r => {
      const existing = monthlyMap.get(r.month) ?? { leads: 0, reservas: 0, vgv: 0 };
      monthlyMap.set(r.month, { ...existing, reservas: Number(r.reservas), vgv: Number(r.vgv) });
    });

    const monthly = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v }));

    // Funil de conversão (steps)
    const visitasCount = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM leads
      WHERE status ILIKE '%visita%' OR raw->>'situacao' ILIKE '%visita%'
    `;

    const steps = [
      { label: 'Leads Gerados', value: totalLeads, color: '#0ea5e9' },
      { label: 'Visitaram', value: visitasCount[0]?.count ?? 0, color: '#a855f7' },
      { label: 'Reservaram', value: vendasSummary.total_reservas, color: '#f59e0b' },
      { label: 'Vendido (Aprovado)', value: vendasSummary.aprovadas, color: '#10b981' },
    ].map((step, _, arr) => ({
      ...step,
      percentage: arr[0].value > 0 ? Math.round((step.value / arr[0].value) * 100) : 0,
    }));

    const conversionRate = totalLeads > 0
      ? Math.round((vendasSummary.total_reservas / totalLeads) * 100 * 10) / 10
      : 0;

    const result: FunilIntelligenceData = {
      steps,
      vgvByOrigin: (originRows as unknown as { origem: string; leads: number; reservas: number; vgv: number; cpl: number; ticket_medio: number }[])
        .map(r => ({
          origem: r.origem,
          leads: Number(r.leads),
          reservas: Number(r.reservas),
          vgv: Number(r.vgv),
          cpl: Number(r.cpl),
          roas: 0,
          ticket_medio: Number(r.ticket_medio),
        })),
      cycleByEmp: (cycleRows as unknown as { empreendimento: string; leads: number; reservas: number; vgv: number; avg_days_lead_to_venda: number | null }[])
        .map(r => ({
          empreendimento: r.empreendimento,
          leads: Number(r.leads),
          reservas: Number(r.reservas),
          vgv: Number(r.vgv),
          avg_days_to_reserva: null,
          avg_days_to_venda: r.avg_days_lead_to_venda ? Number(r.avg_days_lead_to_venda) : null,
        })),
      monthly,
      topCorretores: (corretoresRows as unknown as { corretor: string; reservas: number; vgv: number; ticket_medio: number; cancelamentos: number }[])
        .map(r => ({
          corretor: r.corretor,
          reservas: Number(r.reservas),
          vgv: Number(r.vgv),
          ticket_medio: Number(r.ticket_medio),
          cancelamentos: Number(r.cancelamentos),
        })),
      summary: {
        totalLeads,
        totalReservas: vendasSummary.total_reservas,
        totalVendas: vendasSummary.aprovadas,
        totalVgv: Number(vendasSummary.total_vgv),
        avgTicket: Number(vendasSummary.ticket_medio),
        avgDaysLeadToReserva: null,
        conversionRate,
        cancelamentos: vendasSummary.canceladas,
      },
    };

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ msg }, '[/api/cv/funil-intelligence]');
    return NextResponse.json({ error: msg, steps: [], vgvByOrigin: [], cycleByEmp: [], monthly: [], topCorretores: [], summary: { totalLeads: 0, totalReservas: 0, totalVendas: 0, totalVgv: 0, avgTicket: 0, avgDaysLeadToReserva: null, conversionRate: 0, cancelamentos: 0 } }, { status: 200 });
  }
}
