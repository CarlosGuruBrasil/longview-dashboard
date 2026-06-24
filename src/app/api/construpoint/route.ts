import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';

export const runtime = 'nodejs';
// Cache of 1 hour for the dash, but we can make it shorter or 0 if we want instant webhook updates.
// We'll set it to 0 so webhooks reflect instantly on refresh.
export const revalidate = 0;

const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startYear = parseInt(searchParams.get('startYear') ?? String(new Date().getFullYear() - 1));
  const endYear   = parseInt(searchParams.get('endYear')   ?? String(new Date().getFullYear()));

  try {
    await ensureSchema();

    // 1. Verificacoes Stats (Aprovadas/Reprovadas)
    const verifStatsQuery = await sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE resultado = 'Aprovado')::int as aprovadas,
        COUNT(*) FILTER (WHERE resultado = 'Reprovado')::int as reprovadas,
        COUNT(*) FILTER (WHERE resultado = 'Não se aplica')::int as nao_aplica
      FROM construpoint_verificacoes
      WHERE EXTRACT(YEAR FROM data) >= ${startYear} AND EXTRACT(YEAR FROM data) <= ${endYear}
    `;
    const vs = verifStatsQuery[0] || { total: 0, aprovadas: 0, reprovadas: 0, nao_aplica: 0 };

    // 2. Inspecoes por Tipo
    const inspPorTipoQuery = await sql`
      SELECT modelo as key, COUNT(*)::int as count
      FROM construpoint_inspecoes
      WHERE EXTRACT(YEAR FROM COALESCE(data_agendamento, data_criacao)) >= ${startYear} 
        AND EXTRACT(YEAR FROM COALESCE(data_agendamento, data_criacao)) <= ${endYear}
      GROUP BY modelo
    `;
    const inspecoesPorTipo: Record<string, number> = {};
    let totalInspections = 0;
    for (const row of inspPorTipoQuery) {
      inspecoesPorTipo[row.key] = row.count;
      totalInspections += row.count;
    }

    // 3. Ultimas Inspecoes (top 20)
    const ultimasInspecoesQuery = await sql`
      SELECT id, code, modelo, obra, inspetor, status, raw->>'StatusId' as status_id, COALESCE(data_agendamento, data_criacao) as data, nota
      FROM construpoint_inspecoes
      WHERE COALESCE(data_agendamento, data_criacao) IS NOT NULL
      ORDER BY COALESCE(data_agendamento, data_criacao) DESC
      LIMIT 20
    `;
    const ultimasInspecoes = ultimasInspecoesQuery.map(row => ({
      id: row.id,
      code: row.code,
      modelo: row.modelo,
      obra: row.obra,
      inspetor: row.inspetor,
      status: row.status,
      statusId: row.status_id ? parseInt(row.status_id) : null,
      data: row.data,
      nota: row.nota,
    }));

    // 4. Serie Mensal (Merging Inspecoes and Verificacoes per month)
    const inspMensalQuery = await sql`
      SELECT 
        EXTRACT(YEAR FROM COALESCE(data_agendamento, data_criacao))::int as year,
        EXTRACT(MONTH FROM COALESCE(data_agendamento, data_criacao))::int as month,
        COUNT(*)::int as total
      FROM construpoint_inspecoes
      WHERE EXTRACT(YEAR FROM COALESCE(data_agendamento, data_criacao)) >= ${startYear} 
        AND EXTRACT(YEAR FROM COALESCE(data_agendamento, data_criacao)) <= ${endYear}
      GROUP BY 1, 2
    `;

    const verifMensalQuery = await sql`
      SELECT 
        EXTRACT(YEAR FROM data)::int as year,
        EXTRACT(MONTH FROM data)::int as month,
        COUNT(*) FILTER (WHERE resultado = 'Aprovado')::int as aprovadas,
        COUNT(*) FILTER (WHERE resultado = 'Reprovado')::int as reprovadas,
        COUNT(*) FILTER (WHERE resultado = 'Não se aplica')::int as nao_aplica
      FROM construpoint_verificacoes
      WHERE EXTRACT(YEAR FROM data) >= ${startYear} AND EXTRACT(YEAR FROM data) <= ${endYear}
      GROUP BY 1, 2
    `;

    // Merge monthly series
    const seriesMap: Record<string, any> = {};

    for (const row of inspMensalQuery) {
      if (!row.year || !row.month) continue;
      const mk = `${row.year}-${String(row.month).padStart(2, '0')}`;
      seriesMap[mk] = {
        label: `${MONTHS_PT[row.month - 1]}/${String(row.year).slice(2)}`,
        year: row.year,
        month: row.month,
        total: row.total,
        aprovadas: 0,
        reprovadas: 0,
        naoAplica: 0
      };
    }

    for (const row of verifMensalQuery) {
      if (!row.year || !row.month) continue;
      const mk = `${row.year}-${String(row.month).padStart(2, '0')}`;
      if (!seriesMap[mk]) {
        seriesMap[mk] = {
          label: `${MONTHS_PT[row.month - 1]}/${String(row.year).slice(2)}`,
          year: row.year,
          month: row.month,
          total: 0,
          aprovadas: 0,
          reprovadas: 0,
          naoAplica: 0
        };
      }
      seriesMap[mk].aprovadas = row.aprovadas;
      seriesMap[mk].reprovadas = row.reprovadas;
      seriesMap[mk].naoAplica = row.nao_aplica;
    }

    const serieMensal = Object.entries(seriesMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);

    const totalVerif = vs.total;
    const taxaAprovacao = totalVerif > 0 ? Math.round((vs.aprovadas / totalVerif) * 1000) / 10 : 0;
    const taxaReprovacao = totalVerif > 0 ? Math.round((vs.reprovadas / totalVerif) * 1000) / 10 : 0;

    return NextResponse.json({
      kpis: {
        totalInspections,
        taxaAprovacao,
        taxaReprovacao,
        totalVerificacoes: totalVerif,
        aprovadas: vs.aprovadas,
        reprovadas: vs.reprovadas,
        naoAplica: vs.nao_aplica,
      },
      inspecoesPorTipo,
      serieMensal,
      ultimasInspecoes,
      meta: { startYear, endYear },
    });
  } catch (error: any) {
    console.error('[API/construpoint]', error);
    return NextResponse.json({ error: `Erro ao buscar dados no SQL: ${error.message}` }, { status: 500 });
  }
}
