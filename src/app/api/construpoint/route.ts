import { NextResponse } from 'next/server';
import {
  getInspectionsByRange,
  getVerifications,
  MODEL_TYPES,
  type ModelTypeKey,
  type InspecaoPorRange,
  type Verificacao,
} from '@/lib/construpoint';

export const runtime = 'nodejs';
// Cache de 30 minutos (inspeções não mudam em tempo real)
export const revalidate = 1800;

const MONTHS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function getYearMonth(dateStr: string | undefined): { year: number; month: number } | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() };
}

interface MonthlyPoint {
  label: string;
  year: number;
  month: number;
  total: number;
  aprovadas: number;
  reprovadas: number;
  naoAplica: number;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startYear = parseInt(searchParams.get('startYear') ?? String(new Date().getFullYear() - 1));
  const endYear   = parseInt(searchParams.get('endYear')   ?? String(new Date().getFullYear()));

  // Buscar inspeções para todos os tipos de ficha em paralelo
  const modelKeys = Object.keys(MODEL_TYPES) as ModelTypeKey[];

  const [inspectionResults, verificationResults] = await Promise.allSettled([
    // Inspeções por range — volume por tipo
    Promise.all(
      modelKeys.map(async key => {
        try {
          const res = await getInspectionsByRange({
            StartYear: startYear,
            EndYear: endYear,
            ModelType: MODEL_TYPES[key],
            OnlyActiveWorks: true,
            PageSize: 1000,
          });
          return { key, items: res.Items ?? [] };
        } catch {
          return { key, items: [] as InspecaoPorRange[] };
        }
      })
    ),
    // Verificações — resultado aprovado/reprovado
    Promise.all(
      modelKeys.map(async key => {
        const today = new Date();
        const begin = `${startYear}-01-01`;
        const end   = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        try {
          const items = await getVerifications({
            BeginDate: begin,
            EndDate:   end,
            ModelTypeId: MODEL_TYPES[key],
            HistoricoCompleto: false,
            CamposPersonalizados: false,
          });
          return { key, items: items ?? [] };
        } catch {
          return { key, items: [] as Verificacao[] };
        }
      })
    ),
  ]);

  // --- Processar inspeções ---
  const inspecoesPorTipo: Record<string, number> = {};
  const inspecoesPorMes: Record<string, MonthlyPoint> = {};
  const allInspections: InspecaoPorRange[] = [];

  if (inspectionResults.status === 'fulfilled') {
    for (const { key, items } of inspectionResults.value) {
      inspecoesPorTipo[key] = (inspecoesPorTipo[key] ?? 0) + items.length;
      allInspections.push(...items);

      for (const insp of items) {
        const ym = getYearMonth(insp.ScheduleDate ?? insp.CreateDate);
        if (!ym) continue;
        const mk = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
        if (!inspecoesPorMes[mk]) {
          inspecoesPorMes[mk] = {
            label: `${MONTHS_PT[ym.month]}/${String(ym.year).slice(2)}`,
            year: ym.year, month: ym.month,
            total: 0, aprovadas: 0, reprovadas: 0, naoAplica: 0,
          };
        }
        inspecoesPorMes[mk].total++;
      }
    }
  }

  // --- Processar verificações ---
  const verificacoesPorResultado = { aprovadas: 0, reprovadas: 0, naoAplica: 0 };

  if (verificationResults.status === 'fulfilled') {
    for (const { items } of verificationResults.value) {
      for (const v of items) {
        if (v.Resultado === 'Aprovado')           verificacoesPorResultado.aprovadas++;
        else if (v.Resultado === 'Reprovado')      verificacoesPorResultado.reprovadas++;
        else if (v.Resultado === 'Não se aplica')  verificacoesPorResultado.naoAplica++;

        // Enriquecer série mensal com resultado das verificações
        // (usa Verificacao date field como proxy)
        const ym = getYearMonth(v.Verificacao);
        if (ym) {
          const mk = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
          if (inspecoesPorMes[mk]) {
            if (v.Resultado === 'Aprovado')           inspecoesPorMes[mk].aprovadas++;
            else if (v.Resultado === 'Reprovado')      inspecoesPorMes[mk].reprovadas++;
            else if (v.Resultado === 'Não se aplica')  inspecoesPorMes[mk].naoAplica++;
          }
        }
      }
    }
  }

  // Série mensal ordenada
  const serieMensal = Object.entries(inspecoesPorMes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);

  // KPIs gerais
  const totalInspections = Object.values(inspecoesPorTipo).reduce((s, n) => s + n, 0);
  const totalVerif = verificacoesPorResultado.aprovadas + verificacoesPorResultado.reprovadas + verificacoesPorResultado.naoAplica;
  const taxaAprovacao = totalVerif > 0
    ? Math.round((verificacoesPorResultado.aprovadas / totalVerif) * 1000) / 10
    : 0;
  const taxaReprovacao = totalVerif > 0
    ? Math.round((verificacoesPorResultado.reprovadas / totalVerif) * 1000) / 10
    : 0;

  // Últimas 20 inspeções (mais recentes)
  const ultimasInspecoes = allInspections
    .filter(i => i.ScheduleDate ?? i.CreateDate)
    .sort((a, b) => {
      const da = new Date(a.ScheduleDate ?? a.CreateDate ?? '').getTime();
      const db = new Date(b.ScheduleDate ?? b.CreateDate ?? '').getTime();
      return db - da;
    })
    .slice(0, 20)
    .map(i => ({
      id: i.Id,
      code: i.Code,
      modelo: i.Model?.Name,
      obra: i.Work?.Name,
      inspetor: i.Inspector?.Name,
      status: i.Status?.Name,
      statusId: i.StatusId,
      data: i.ScheduleDate ?? i.CreateDate,
      nota: i.WeightedGrade,
    }));

  return NextResponse.json({
    kpis: {
      totalInspections,
      taxaAprovacao,
      taxaReprovacao,
      totalVerificacoes: totalVerif,
      aprovadas: verificacoesPorResultado.aprovadas,
      reprovadas: verificacoesPorResultado.reprovadas,
      naoAplica: verificacoesPorResultado.naoAplica,
    },
    inspecoesPorTipo,
    serieMensal,
    ultimasInspecoes,
    meta: { startYear, endYear },
  });
}
