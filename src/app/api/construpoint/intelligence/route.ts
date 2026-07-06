import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';
import logger from '@/lib/logger'

export const runtime = 'nodejs';
export const revalidate = 0;

const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface MonthPoint {
  key: string;            // '2026-06'
  label: string;          // 'Jun/26'
  inspecoes: number;
  verificacoes: number;
  aprovadas: number;
  reprovadas: number;
  taxaReprovacao: number; // %
  mediaMovel: number | null; // média móvel 3m da taxa de reprovação (%)
}

export interface Alerta {
  severidade: 'critico' | 'alto' | 'atencao' | 'info';
  titulo: string;
  detalhe: string;
  recomendacao: string;
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function delta(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function GET() {
  try {
    await ensureSchema();

    // ── Séries mensais ────────────────────────────────────────────────
    const verifMensal = await sql`
      SELECT to_char(date_trunc('month', data), 'YYYY-MM') AS mes,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE resultado = 'Aprovado')::int AS aprovadas,
             COUNT(*) FILTER (WHERE resultado = 'Reprovado')::int AS reprovadas
      FROM construpoint_verificacoes
      WHERE data IS NOT NULL
      GROUP BY 1 ORDER BY 1
    `;
    const inspMensal = await sql`
      SELECT to_char(date_trunc('month', COALESCE(data_agendamento, data_criacao)), 'YYYY-MM') AS mes,
             COUNT(*)::int AS total
      FROM construpoint_inspecoes
      WHERE COALESCE(data_agendamento, data_criacao) IS NOT NULL
      GROUP BY 1 ORDER BY 1
    `;

    const inspByMonth = new Map<string, number>(inspMensal.map(r => [r.mes as string, r.total as number]));
    const serie: MonthPoint[] = verifMensal.map(r => {
      const [y, m] = (r.mes as string).split('-').map(Number);
      return {
        key: r.mes as string,
        label: `${MONTHS_PT[m - 1]}/${String(y).slice(2)}`,
        inspecoes: inspByMonth.get(r.mes as string) ?? 0,
        verificacoes: r.total as number,
        aprovadas: r.aprovadas as number,
        reprovadas: r.reprovadas as number,
        taxaReprovacao: pct(r.reprovadas as number, r.total as number),
        mediaMovel: null,
      };
    });
    // média móvel 3m da taxa de reprovação (sugestão do time de Qualidade: meta = média móvel do período)
    for (let i = 0; i < serie.length; i++) {
      const win = serie.slice(Math.max(0, i - 2), i + 1);
      serie[i].mediaMovel = Math.round((win.reduce((s, p) => s + p.taxaReprovacao, 0) / win.length) * 10) / 10;
    }

    // ── Comparativos: último mês fechado vs anterior vs YoY ───────────
    const now = new Date();
    const lastClosed = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const prev = new Date(Date.UTC(lastClosed.getUTCFullYear(), lastClosed.getUTCMonth() - 1, 1));
    const yoy = new Date(Date.UTC(lastClosed.getUTCFullYear() - 1, lastClosed.getUTCMonth(), 1));
    const byKey = new Map(serie.map(p => [p.key, p]));
    const cur = byKey.get(monthKey(lastClosed)) ?? null;
    const ant = byKey.get(monthKey(prev)) ?? null;
    const ano = byKey.get(monthKey(yoy)) ?? null;

    const comparativos = {
      mesReferencia: cur?.label ?? null,
      inspecoes: {
        atual: cur?.inspecoes ?? 0,
        mom: cur && ant ? delta(cur.inspecoes, ant.inspecoes) : null,
        yoy: cur && ano ? delta(cur.inspecoes, ano.inspecoes) : null,
      },
      verificacoes: {
        atual: cur?.verificacoes ?? 0,
        mom: cur && ant ? delta(cur.verificacoes, ant.verificacoes) : null,
        yoy: cur && ano ? delta(cur.verificacoes, ano.verificacoes) : null,
      },
      taxaReprovacao: {
        atual: cur?.taxaReprovacao ?? 0,
        anterior: ant?.taxaReprovacao ?? null,
        anoAnterior: ano?.taxaReprovacao ?? null,
        mediaMovel: cur?.mediaMovel ?? null,
      },
    };

    // ── Ranking de obras (janela 90d, com tendência vs 90d anteriores) ─
    const obras = await sql`
      SELECT obra,
             COUNT(*) FILTER (WHERE data >= now() - interval '90 days')::int AS total_90d,
             COUNT(*) FILTER (WHERE resultado = 'Reprovado' AND data >= now() - interval '90 days')::int AS reprov_90d,
             COUNT(*) FILTER (WHERE data >= now() - interval '180 days' AND data < now() - interval '90 days')::int AS total_prev,
             COUNT(*) FILTER (WHERE resultado = 'Reprovado' AND data >= now() - interval '180 days' AND data < now() - interval '90 days')::int AS reprov_prev
      FROM construpoint_verificacoes
      WHERE obra IS NOT NULL AND obra <> ''
      GROUP BY obra
      HAVING COUNT(*) FILTER (WHERE data >= now() - interval '90 days') > 0
      ORDER BY 2 DESC
    `;
    const rankingObras = obras.map(o => {
      const taxa = pct(o.reprov_90d as number, o.total_90d as number);
      const taxaPrev = pct(o.reprov_prev as number, o.total_prev as number);
      return {
        obra: o.obra as string,
        verificacoes: o.total_90d as number,
        reprovadas: o.reprov_90d as number,
        taxaReprovacao: taxa,
        tendencia: (o.total_prev as number) > 0 ? Math.round((taxa - taxaPrev) * 10) / 10 : null,
      };
    });

    // ── Itens sistêmicos: verificações que reprovam em várias obras ───
    const sistemicos = await sql`
      SELECT verificacao, modelo,
             COUNT(*)::int AS reprovacoes,
             COUNT(DISTINCT obra)::int AS obras
      FROM construpoint_verificacoes
      WHERE resultado = 'Reprovado' AND data >= now() - interval '180 days'
        AND verificacao IS NOT NULL AND verificacao <> ''
      GROUP BY 1, 2
      ORDER BY reprovacoes DESC
      LIMIT 12
    `;

    // ── Soluções mais indicadas pelos inspetores por item reprovado ───
    const solucoes = await sql`
      SELECT verificacao, solucao, COUNT(*)::int AS n
      FROM construpoint_verificacoes
      WHERE resultado = 'Reprovado' AND solucao IS NOT NULL AND length(trim(solucao)) > 3
      GROUP BY 1, 2
      ORDER BY n DESC
      LIMIT 300
    `;
    const solucaoPorItem = new Map<string, string>();
    for (const s of solucoes) {
      const key = s.verificacao as string;
      if (key && !solucaoPorItem.has(key)) solucaoPorItem.set(key, s.solucao as string);
    }

    const itensSistemicos = sistemicos.map(s => ({
      verificacao: s.verificacao as string,
      modelo: s.modelo as string,
      reprovacoes: s.reprovacoes as number,
      obras: s.obras as number,
      solucaoRecomendada: solucaoPorItem.get(s.verificacao as string) ?? null,
    }));

    // ── Inspetores (180d) ─────────────────────────────────────────────
    const inspetores = await sql`
      SELECT inspetor,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE resultado = 'Reprovado')::int AS reprovadas
      FROM construpoint_verificacoes
      WHERE inspetor IS NOT NULL AND inspetor <> '' AND data >= now() - interval '180 days'
      GROUP BY 1 ORDER BY 2 DESC LIMIT 10
    `;
    const rankingInspetores = inspetores.map(i => ({
      inspetor: i.inspetor as string,
      verificacoes: i.total as number,
      reprovadas: i.reprovadas as number,
      taxaReprovacao: pct(i.reprovadas as number, i.total as number),
    }));

    // ── Inspeções pendentes de aprovação ──────────────────────────────
    const pendentes = await sql`
      SELECT COUNT(*)::int AS n
      FROM construpoint_inspecoes
      WHERE status ILIKE '%pendente%'
    `;
    const inspecoesPendentes = (pendentes[0]?.n as number) ?? 0;

    // ── Motor de alertas ──────────────────────────────────────────────
    const alertas: Alerta[] = [];
    const taxaGeral90 = pct(
      rankingObras.reduce((s, o) => s + o.reprovadas, 0),
      rankingObras.reduce((s, o) => s + o.verificacoes, 0),
    );

    for (const o of rankingObras) {
      if (o.verificacoes >= 30 && o.taxaReprovacao >= Math.max(5, taxaGeral90 * 2)) {
        alertas.push({
          severidade: 'critico',
          titulo: `Obra ${o.obra} com reprovação ${o.taxaReprovacao}% (média geral: ${taxaGeral90}%)`,
          detalhe: `${o.reprovadas} reprovações em ${o.verificacoes} verificações nos últimos 90 dias${o.tendencia != null ? `, tendência ${o.tendencia > 0 ? '+' : ''}${o.tendencia}pp vs trimestre anterior` : ''}.`,
          recomendacao: 'Priorizar reinspeção dos itens reprovados e reunião com o parceiro executor da obra.',
        });
      } else if (o.tendencia != null && o.tendencia >= 3 && o.verificacoes >= 30) {
        alertas.push({
          severidade: 'atencao',
          titulo: `Reprovação em alta na obra ${o.obra} (+${o.tendencia}pp no trimestre)`,
          detalhe: `Taxa atual ${o.taxaReprovacao}% contra ${Math.round((o.taxaReprovacao - o.tendencia) * 10) / 10}% no trimestre anterior.`,
          recomendacao: 'Investigar mudança de equipe, fornecedor ou etapa da obra que explique a piora.',
        });
      }
    }

    for (const item of itensSistemicos.slice(0, 5)) {
      if (item.obras >= 3 && item.reprovacoes >= 10) {
        alertas.push({
          severidade: 'alto',
          titulo: `Falha sistêmica: "${item.verificacao}" reprovada ${item.reprovacoes}× em ${item.obras} obras`,
          detalhe: `Item do modelo ${item.modelo} reprovando de forma recorrente nos últimos 180 dias — indica causa comum (material, processo ou treinamento), não problema pontual de obra.`,
          recomendacao: item.solucaoRecomendada
            ? `Solução mais indicada pelos inspetores em campo: "${item.solucaoRecomendada}"`
            : 'Levantar causa raiz com os inspetores e padronizar a correção nas obras afetadas.',
        });
      }
    }

    if (cur && cur.mediaMovel != null && cur.taxaReprovacao > cur.mediaMovel * 1.2 && cur.verificacoes >= 50) {
      alertas.push({
        severidade: 'atencao',
        titulo: `Taxa de reprovação de ${cur.label} acima da meta (média móvel)`,
        detalhe: `${cur.taxaReprovacao}% contra meta de ${cur.mediaMovel}% (média móvel 3 meses).`,
        recomendacao: 'Revisar as reprovações do mês por obra pra identificar a origem do desvio.',
      });
    }

    if (cur && serie.length >= 4) {
      const prev3 = serie.filter(p => p.key < cur.key).slice(-3);
      const mediaInsp = prev3.reduce((s, p) => s + p.inspecoes, 0) / Math.max(prev3.length, 1);
      if (mediaInsp >= 50 && cur.inspecoes < mediaInsp * 0.5) {
        alertas.push({
          severidade: 'atencao',
          titulo: `Volume de inspeções caiu em ${cur.label}`,
          detalhe: `${cur.inspecoes} inspeções contra média de ${Math.round(mediaInsp)} nos 3 meses anteriores — pode ser atraso de registro das fichas, não queda real.`,
          recomendacao: 'Confirmar com o time de campo se há fichas represadas sem lançamento no Construpoint.',
        });
      }
    }

    if (inspecoesPendentes >= 20) {
      alertas.push({
        severidade: 'info',
        titulo: `${inspecoesPendentes} inspeções pendentes de aprovação`,
        detalhe: 'Fichas enviadas a aprovação e ainda não aceitas acumulam e distorcem os indicadores do mês.',
        recomendacao: 'Reservar rotina semanal de aprovação das fichas pendentes.',
      });
    }

    const ordem = { critico: 0, alto: 1, atencao: 2, info: 3 } as const;
    alertas.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);

    return NextResponse.json({
      comparativos,
      serie,
      rankingObras: rankingObras.slice(0, 12),
      itensSistemicos,
      rankingInspetores,
      alertas,
      meta: { taxaGeral90, inspecoesPendentes, geradoEm: new Date().toISOString() },
    });
  } catch (error: unknown) {
    logger.error({ error }, '[API/construpoint/intelligence]');
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
