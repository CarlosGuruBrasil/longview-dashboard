import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';
import { verifyPermission } from '@/lib/auth';
import logger from '@/lib/logger'

export const runtime = 'nodejs';
// Cache of 1 hour for the dash, but we can make it shorter or 0 if we want instant webhook updates.
// We'll set it to 0 so webhooks reflect instantly on refresh.
export const revalidate = 0;

const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const SEM_DISCIPLINA = 'Sem classificação';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type MonthlySeriesPoint = {
  label: string;
  year: number;
  month: number;
  total: number;
  aprovadas: number;
  reprovadas: number;
  naoAplica: number;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const user = await verifyPermission('viewQualityVision');
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setFullYear(defaultStart.getFullYear() - 1);

  const startDateParam = searchParams.get('startDate');
  const endDateParam   = searchParams.get('endDate');
  const startDateProvided = !!(startDateParam && DATE_RE.test(startDateParam));
  const endDateProvided   = !!(endDateParam && DATE_RE.test(endDateParam));
  const startDate = startDateProvided ? startDateParam! : isoDate(defaultStart);
  const endDate   = endDateProvided ? endDateParam! : isoDate(today);
  const attention = searchParams.get('attention');
  // A lista de inspeções (Dashboard e /inspecoes) só filtra por data se o usuário explicitamente
  // mandar startDate/endDate — sem isso, mostra o total real sem limite de período escondido.
  // Dashboard e Relatórios sempre mandam os dois (default de 12 meses no próprio frontend deles),
  // então esse fallback só entra em ação na lista pura ou nas telas de atenção.
  const listDateFilter = !startDateProvided && !endDateProvided
    ? sql``
    : sql`AND COALESCE(i.data_agendamento, i.data_criacao) >= ${startDate}::date AND COALESCE(i.data_agendamento, i.data_criacao) < (${endDate}::date + 1)`;

  // Filtros opcionais — todos aplicados só quando presentes (não alteram o comportamento existente das outras telas)
  const obra     = searchParams.get('obra')     || null;
  const status   = searchParams.get('status')   || null;
  const inspetor = searchParams.get('inspetor') || null;
  const disciplinaFiltro = searchParams.get('disciplina') || null; // valor real, ou SEM_DISCIPLINA
  const codeSearch = searchParams.get('code') || null;

  try {
    await ensureSchema();

    // Fragmentos de filtro reutilizados nas queries de inspecoes/verificacoes.
    // `i`/`v` são os aliases das tabelas em cada query que os usa.
    const inspFilters = sql`
      ${obra ? sql`AND i.obra = ${obra}` : sql``}
      ${status ? sql`AND i.status = ${status}` : sql``}
      ${inspetor ? sql`AND i.inspetor = ${inspetor}` : sql``}
      ${codeSearch ? sql`AND i.code ILIKE ${'%' + codeSearch + '%'}` : sql``}
      ${disciplinaFiltro === SEM_DISCIPLINA
        ? sql`AND d.disciplina IS NULL`
        : disciplinaFiltro
          ? sql`AND d.disciplina = ${disciplinaFiltro}`
          : sql``}
    `;
    const verifFilters = sql`
      ${obra ? sql`AND v.obra = ${obra}` : sql``}
      ${inspetor ? sql`AND v.inspetor = ${inspetor}` : sql``}
      ${disciplinaFiltro === SEM_DISCIPLINA
        ? sql`AND d.disciplina IS NULL`
        : disciplinaFiltro
          ? sql`AND d.disciplina = ${disciplinaFiltro}`
          : sql``}
    `;

    // 1. Verificacoes Stats (Aprovadas/Reprovadas)
    const verifStatsQuery = await sql`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE v.resultado = 'Aprovado')::int as aprovadas,
        COUNT(*) FILTER (WHERE v.resultado = 'Reprovado')::int as reprovadas,
        COUNT(*) FILTER (WHERE v.resultado = 'Não se aplica')::int as nao_aplica
      FROM construpoint_verificacoes v
      LEFT JOIN construpoint_disciplinas d ON d.modelo = v.modelo
      WHERE v.data >= ${startDate}::date AND v.data < (${endDate}::date + 1)
      ${verifFilters}
    `;
    const vs = verifStatsQuery[0] || { total: 0, aprovadas: 0, reprovadas: 0, nao_aplica: 0 };

    // 2. Inspecoes por Disciplina (0-TERRENO...9-IMPERMEABILIZAÇÕES) — agrupar pelo "modelo" cru (118 valores)
    // não é legível; a classificação por disciplina (construpoint_disciplinas) é o agrupamento útil pra gráfico.
    const inspPorDisciplinaQuery = await sql`
      SELECT COALESCE(d.disciplina, ${SEM_DISCIPLINA}) as key, COUNT(*)::int as count
      FROM construpoint_inspecoes i
      LEFT JOIN construpoint_disciplinas d ON d.modelo = i.modelo
      WHERE COALESCE(i.data_agendamento, i.data_criacao) >= ${startDate}::date
        AND COALESCE(i.data_agendamento, i.data_criacao) < (${endDate}::date + 1)
      ${inspFilters}
      GROUP BY 1
    `;
    const inspecoesPorDisciplina: Record<string, number> = {};
    let totalInspections = 0;
    for (const row of inspPorDisciplinaQuery) {
      inspecoesPorDisciplina[row.key] = row.count;
      totalInspections += row.count;
    }

    // 3. Status das inspeções no período (pipeline: Agendado, Em Andamento, Aceito, Recusado...)
    const statusBreakdownQuery = await sql`
      SELECT COALESCE(i.status, 'Sem status') as key, COUNT(*)::int as count
      FROM construpoint_inspecoes i
      LEFT JOIN construpoint_disciplinas d ON d.modelo = i.modelo
      WHERE COALESCE(i.data_agendamento, i.data_criacao) >= ${startDate}::date
        AND COALESCE(i.data_agendamento, i.data_criacao) < (${endDate}::date + 1)
        ${obra ? sql`AND i.obra = ${obra}` : sql``}
        ${inspetor ? sql`AND i.inspetor = ${inspetor}` : sql``}
        ${codeSearch ? sql`AND i.code ILIKE ${'%' + codeSearch + '%'}` : sql``}
        ${disciplinaFiltro === SEM_DISCIPLINA
          ? sql`AND d.disciplina IS NULL`
          : disciplinaFiltro
            ? sql`AND d.disciplina = ${disciplinaFiltro}`
            : sql``}
      GROUP BY 1
    `;
    const statusBreakdown: Record<string, number> = {};
    for (const row of statusBreakdownQuery) statusBreakdown[row.key] = row.count;

    // 4. Por inspetor (verificações do período, mesmos filtros exceto inspetor — pra manter o ranking completo).
    // Sem LIMIT: só existem ~14 inspetores reais na base, ordenação/busca fica por conta do frontend.
    const porInspetorQuery = await sql`
      SELECT v.inspetor as inspetor,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE v.resultado = 'Aprovado')::int as aprovadas,
        COUNT(*) FILTER (WHERE v.resultado = 'Reprovado')::int as reprovadas
      FROM construpoint_verificacoes v
      LEFT JOIN construpoint_disciplinas d ON d.modelo = v.modelo
      WHERE v.data >= ${startDate}::date AND v.data < (${endDate}::date + 1)
        AND v.inspetor IS NOT NULL AND v.inspetor <> ''
        ${obra ? sql`AND v.obra = ${obra}` : sql``}
        ${disciplinaFiltro === SEM_DISCIPLINA
          ? sql`AND d.disciplina IS NULL`
          : disciplinaFiltro
            ? sql`AND d.disciplina = ${disciplinaFiltro}`
            : sql``}
      GROUP BY 1
      ORDER BY 2 DESC
    `;
    const porInspetor = porInspetorQuery.map(row => ({
      inspetor: row.inspetor as string,
      total: row.total as number,
      aprovadas: row.aprovadas as number,
      reprovadas: row.reprovadas as number,
      taxaAprovacao: row.total > 0 ? Math.round((row.aprovadas / row.total) * 1000) / 10 : 0,
    }));

    // 5. Ultimas Inspecoes — 100 por página, "carregar mais" avança via offset. Mesma paginação nas
    // 3 variações (lista normal e as duas telas de atenção) — nenhuma delas trava num total escondido.
    const recentLimit = 100;
    const offsetParam = parseInt(searchParams.get('offset') ?? '0', 10);
    const offset = Number.isFinite(offsetParam) && offsetParam > 0 ? offsetParam : 0;
    // Busca 1 linha a mais que o limite só pra saber se tem próxima página, sem precisar de COUNT(*) separado.
    const ultimasInspecoesQuery = attention === 'nonconformity'
      ? await sql`
          SELECT i.id, i.code, i.modelo, i.obra, i.inspetor, i.status, i.raw->>'StatusId' as status_id,
                 COALESCE(i.data_agendamento, i.data_criacao) as data
          FROM construpoint_inspecoes i
          LEFT JOIN construpoint_disciplinas d ON d.modelo = i.modelo
          WHERE i.status IN ('Recusado', 'Pendente Reinspeção')
          ${listDateFilter}
          ${inspFilters}
          ORDER BY COALESCE(i.data_atualizacao, i.data_agendamento, i.data_criacao) DESC NULLS LAST
          LIMIT ${recentLimit + 1} OFFSET ${offset}
        `
      : attention === 'overdue'
        ? await sql`
            SELECT i.id, i.code, i.modelo, i.obra, i.inspetor, i.status, i.raw->>'StatusId' as status_id,
                   COALESCE(i.data_agendamento, i.data_criacao) as data
            FROM construpoint_inspecoes i
            LEFT JOIN construpoint_disciplinas d ON d.modelo = i.modelo
            WHERE i.status = 'Agendado' AND i.data_agendamento < now() - interval '7 days'
            ${listDateFilter}
            ${inspFilters}
            ORDER BY i.data_agendamento ASC
            LIMIT ${recentLimit + 1} OFFSET ${offset}
          `
        : await sql`
            SELECT i.id, i.code, i.modelo, i.obra, i.inspetor, i.status, i.raw->>'StatusId' as status_id,
                   COALESCE(i.data_agendamento, i.data_criacao) as data
            FROM construpoint_inspecoes i
            LEFT JOIN construpoint_disciplinas d ON d.modelo = i.modelo
            WHERE true
            ${listDateFilter}
            ${inspFilters}
            ORDER BY COALESCE(i.data_agendamento, i.data_criacao) DESC
            LIMIT ${recentLimit + 1} OFFSET ${offset}
          `;
    const hasMoreInspecoes = ultimasInspecoesQuery.length > recentLimit;
    const ultimasInspecoes = ultimasInspecoesQuery.slice(0, recentLimit).map(row => ({
      id: row.id,
      code: row.code,
      modelo: row.modelo,
      obra: row.obra,
      inspetor: row.inspetor,
      status: row.status,
      statusId: row.status_id ? parseInt(row.status_id) : null,
      data: row.data,
    }));

    // Total real que bate com os mesmos filtros — mostrado como "X de Y" no frontend,
    // pra deixar claro quando a tabela está paginada (não é um limite escondido).
    const totalInspecoesFiltradasQuery = attention === 'nonconformity'
      ? await sql`
          SELECT COUNT(*)::int as n
          FROM construpoint_inspecoes i
          LEFT JOIN construpoint_disciplinas d ON d.modelo = i.modelo
          WHERE i.status IN ('Recusado', 'Pendente Reinspeção')
          ${listDateFilter}
          ${inspFilters}
        `
      : attention === 'overdue'
        ? await sql`
            SELECT COUNT(*)::int as n
            FROM construpoint_inspecoes i
            LEFT JOIN construpoint_disciplinas d ON d.modelo = i.modelo
            WHERE i.status = 'Agendado' AND i.data_agendamento < now() - interval '7 days'
            ${listDateFilter}
            ${inspFilters}
          `
        : await sql`
            SELECT COUNT(*)::int as n
            FROM construpoint_inspecoes i
            LEFT JOIN construpoint_disciplinas d ON d.modelo = i.modelo
            WHERE true
            ${listDateFilter}
            ${inspFilters}
          `;
    const totalInspecoesFiltradas = totalInspecoesFiltradasQuery[0]?.n ?? ultimasInspecoes.length;

    // 6. Serie Mensal (Merging Inspecoes e Verificacoes por mês, com os mesmos filtros)
    const inspMensalQuery = await sql`
      SELECT
        EXTRACT(YEAR FROM COALESCE(i.data_agendamento, i.data_criacao))::int as year,
        EXTRACT(MONTH FROM COALESCE(i.data_agendamento, i.data_criacao))::int as month,
        COUNT(*)::int as total
      FROM construpoint_inspecoes i
      LEFT JOIN construpoint_disciplinas d ON d.modelo = i.modelo
      WHERE COALESCE(i.data_agendamento, i.data_criacao) >= ${startDate}::date
        AND COALESCE(i.data_agendamento, i.data_criacao) < (${endDate}::date + 1)
      ${inspFilters}
      GROUP BY 1, 2
    `;

    const verifMensalQuery = await sql`
      SELECT
        EXTRACT(YEAR FROM v.data)::int as year,
        EXTRACT(MONTH FROM v.data)::int as month,
        COUNT(*) FILTER (WHERE v.resultado = 'Aprovado')::int as aprovadas,
        COUNT(*) FILTER (WHERE v.resultado = 'Reprovado')::int as reprovadas,
        COUNT(*) FILTER (WHERE v.resultado = 'Não se aplica')::int as nao_aplica
      FROM construpoint_verificacoes v
      LEFT JOIN construpoint_disciplinas d ON d.modelo = v.modelo
      WHERE v.data >= ${startDate}::date AND v.data < (${endDate}::date + 1)
      ${verifFilters}
      GROUP BY 1, 2
    `;

    // Merge monthly series
    const seriesMap: Record<string, MonthlySeriesPoint> = {};

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

    // Opções de filtro — sempre não-filtradas, pra não fazer os selects sumirem opções conforme o usuário filtra
    const [obrasOpt, statusOpt, inspetoresOpt, disciplinasOpt] = await Promise.all([
      sql`SELECT DISTINCT obra FROM construpoint_inspecoes WHERE obra IS NOT NULL AND obra <> '' ORDER BY 1`,
      sql`SELECT DISTINCT status FROM construpoint_inspecoes WHERE status IS NOT NULL AND status <> '' ORDER BY 1`,
      sql`SELECT DISTINCT inspetor FROM construpoint_inspecoes WHERE inspetor IS NOT NULL AND inspetor <> '' ORDER BY 1`,
      sql`SELECT DISTINCT disciplina FROM construpoint_disciplinas WHERE disciplina IS NOT NULL ORDER BY 1`,
    ]);

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
      inspecoesPorDisciplina,
      statusBreakdown,
      porInspetor,
      serieMensal,
      ultimasInspecoes,
      hasMoreInspecoes,
      totalInspecoesFiltradas,
      filterOptions: {
        obras: obrasOpt.map(r => r.obra as string),
        status: statusOpt.map(r => r.status as string),
        inspetores: inspetoresOpt.map(r => r.inspetor as string),
        disciplinas: [...disciplinasOpt.map(r => r.disciplina as string), SEM_DISCIPLINA],
      },
      meta: { startDate, endDate, filtros: { obra, status, inspetor, disciplina: disciplinaFiltro, code: codeSearch } },
    });
  } catch (error: unknown) {
    logger.error({ error }, '[API/construpoint]');
    return NextResponse.json({ error: `Erro ao buscar dados no SQL: ${errorMessage(error)}` }, { status: 500 });
  }
}
