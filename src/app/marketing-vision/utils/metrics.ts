import type { Lead } from '../types';
import { toISODate, getLeadDate, isSale } from './leads';

/**
 * Identifies which conversion funnel stage a lead is at.
 *
 * CV CRM stage order (source: CV_STAGE_ORDER in leads.ts):
 *   aguardando atendimento → em atendimento (SDR/corretor) → visita agendada
 *   → visita realizada → simulação → com reserva → com proposta → venda realizada
 *
 * Leads at ADVANCED stages (post-visita) count as 'visited' so they are
 * correctly included in attendance, scheduling, and visit rates.
 */
export function getLeadStage(lead: Lead): 'new' | 'attended' | 'scheduled' | 'visited' | 'none' {
  if (!lead.situacao?.nome) return 'none';
  const s = lead.situacao.nome.toLowerCase().trim();

  // ── Estágios pós-visita (simulação, reserva, proposta, venda) ─────────────
  // Um lead nesses estágios passou por todo o funil — conta como 'visited'
  if (
    isSale(lead) ||                     // venda realizada / negócio ganho
    s.includes('com proposta') ||
    s === 'proposta' ||
    s.includes('com reserva') ||
    s.includes('reserva') ||
    s.includes('simula')               // simulação / simulacao
  ) return 'visited';

  // ── Visita realizada ──────────────────────────────────────────────────────
  if (s.includes('visita realizada') || s.includes('visita realizado')) return 'visited';

  // ── Visita agendada ───────────────────────────────────────────────────────
  if (s.includes('visita agendada') || s.includes('visita agendado')) return 'scheduled';

  // ── Em atendimento (SDR, corretor, aguardando) ────────────────────────────
  if (
    s.includes('em atendimento') ||
    s.includes('atendimento sdr') ||
    s.includes('atendimento corretor') ||
    s.includes('aguardando atendimento')
  ) return 'attended';

  return 'new';
}

/**
 * Calculates conversion rates for the funnel
 * Returns { rate, numerator, denominator } for each metric
 */
export interface ConversionMetric {
  rate: number; // decimal (e.g., 1.15 = 115%)
  numerator: number;
  denominator: number;
}

/**
 * Taxa de Novos Leads = (Leads mês atual / Leads mês anterior)
 * Input: array of leads filtered by date range
 * Output: rate comparing current month to previous month
 */
export function calculateNewLeadsRate(leads: Lead[]): ConversionMetric {
  // Group by month
  const monthMap = new Map<string, number>();

  leads.forEach(lead => {
    const raw = getLeadDate(lead);
    if (!raw) return;

    const iso = toISODate(raw);
    if (!iso) return;

    const parts = iso.split('-');
    if (parts.length < 3) return;

    const year = parts[0];
    const month = parts[1];
    const key = `${year}-${month}`;

    monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
  });

  const months = Array.from(monthMap.keys()).sort();

  if (months.length < 2) {
    // If only 1 month or less, can't compute rate
    const currentMonthLeads = months[0] ? monthMap.get(months[0]) ?? 0 : 0;
    return { rate: 1, numerator: currentMonthLeads, denominator: currentMonthLeads || 1 };
  }

  const currentMonth = months[months.length - 1];
  const previousMonth = months[months.length - 2];

  const currentCount = monthMap.get(currentMonth) ?? 0;
  const previousCount = monthMap.get(previousMonth) ?? 0;

  const rate = previousCount > 0 ? currentCount / previousCount : 1;
  return { rate, numerator: currentCount, denominator: previousCount || 1 };
}

/**
 * Taxa de Atendimento = (Atendimentos / Total Leads)
 * Attended leads / All leads in date range
 */
export function calculateAttendanceRate(leads: Lead[]): ConversionMetric {
  const attended = leads.filter(l => {
    const stage = getLeadStage(l);
    return ['attended', 'scheduled', 'visited'].includes(stage);
  });
  const rate = leads.length > 0 ? attended.length / leads.length : 0;
  return { rate, numerator: attended.length, denominator: leads.length };
}

/**
 * Taxa de Agendamento = (Scheduled / Attended)
 * Leads with scheduled visit / leads that were attended
 */
export function calculateSchedulingRate(leads: Lead[]): ConversionMetric {
  const attended = leads.filter(l => {
    const stage = getLeadStage(l);
    return ['attended', 'scheduled', 'visited'].includes(stage);
  });

  const scheduled = leads.filter(l => {
    const stage = getLeadStage(l);
    return ['scheduled', 'visited'].includes(stage);
  });

  const rate = attended.length > 0 ? scheduled.length / attended.length : 0;
  return { rate, numerator: scheduled.length, denominator: attended.length };
}

/**
 * Taxa de Visitas = (Visited / Scheduled)
 * Leads with visit realized / leads with visit scheduled
 */
export function calculateVisitRate(leads: Lead[]): ConversionMetric {
  const scheduled = leads.filter(l => {
    const stage = getLeadStage(l);
    return ['scheduled', 'visited'].includes(stage);
  });

  const visited = leads.filter(l => getLeadStage(l) === 'visited');

  const rate = scheduled.length > 0 ? visited.length / scheduled.length : 0;
  return { rate, numerator: visited.length, denominator: scheduled.length };
}

/**
 * Aggregates metrics by month/trimestre/year for historical view
 */
export interface PeriodMetrics {
  period: string; // e.g., "2026-01", "2026-Q1", "2026"
  // Rates (decimal — 0.85 = 85%)
  newLeadsRate: number;
  attendanceRate: number;
  schedulingRate: number;
  visitRate: number;
  // Raw counts (dado bruto)
  totalLeads: number;     // total de leads no período
  attendedCount: number;  // leads em atendimento ou além
  scheduledCount: number; // leads com visita agendada ou além
  visitedCount: number;   // leads com visita realizada
  proposalCount: number;  // leads com proposta
  salesCount: number;     // leads com venda realizada
}

export function calculateMetricsByPeriod(
  leads: Lead[],
  granularity: 'month' | 'trimestre' | 'year'
): PeriodMetrics[] {
  const periodMap = new Map<string, Lead[]>();

  // Group leads by period granularity
  leads.forEach(lead => {
    const raw = getLeadDate(lead);
    if (!raw) return;
    const iso = toISODate(raw);
    if (!iso) return;

    const [year, month] = iso.split('-');
    let period: string;

    if (granularity === 'month') {
      period = `${year}-${month}`;
    } else if (granularity === 'trimestre') {
      const m = parseInt(month, 10);
      const q = Math.ceil(m / 3);
      period = `${year}-Q${q}`;
    } else {
      period = year;
    }

    if (!periodMap.has(period)) {
      periodMap.set(period, []);
    }
    periodMap.get(period)!.push(lead);
  });

  return Array.from(periodMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, periodLeads]) => {
      const newLeads = calculateNewLeadsRate(periodLeads);
      const attendance = calculateAttendanceRate(periodLeads);
      const scheduling = calculateSchedulingRate(periodLeads);
      const visit = calculateVisitRate(periodLeads);
      const total = periodLeads.length;

      const attendedCount = attendance.numerator;
      const scheduledCount = scheduling.numerator;
      const visitedCount = visit.numerator;

      // proposalCount: apenas leads em estágio "Com Proposta" (situacao.nome)
      // Simulações (qtde_simulacoes_associadas) são cálculos financeiros, não propostas comerciais
      const proposalCount = periodLeads.filter(l => isComProposta(l)).length;

      // salesCount: usa isSale() de leads.ts (cobre 'venda realizada', 'negócio
      // ganho', 'vendid', 'venda real') para manter consistência com o restante do app
      const salesCount = periodLeads.filter(l => isSale(l)).length;

      return {
        period,
        newLeadsRate: newLeads.rate,
        attendanceRate: attendance.rate,
        schedulingRate: scheduling.rate,
        visitRate: visit.rate,
        totalLeads: total,
        attendedCount,
        scheduledCount,
        visitedCount,
        proposalCount,
        salesCount,
      };
    });
}

/**
 * Identifies if lead is in "com proposta" stage
 */
export function isComProposta(lead: Lead): boolean {
  if (!lead.situacao?.nome) return false;
  const s = lead.situacao.nome.toLowerCase().trim();
  return s.includes('com proposta') || s === 'proposta';
}

/**
 * Calculates "Com Proposta vs Vendas Realizadas" metrics for current and previous month
 */
export interface ProposalVsSalesMetric {
  comPropostaCount: number;
  comPropostaPrevMonth: number;
  comPropostaMeta: number; // 3 per month
  vendasCount: number;
  vendasPrevMonth: number;
  vendaRealizadaMeta: number; // 1 per month
}

export function calculateProposalVsSales(leads: Lead[]): ProposalVsSalesMetric {
  // Group by month
  const monthMap = new Map<string, Lead[]>();

  leads.forEach(lead => {
    const raw = getLeadDate(lead);
    if (!raw) return;

    const iso = toISODate(raw);
    if (!iso) return;

    const parts = iso.split('-');
    if (parts.length < 3) return;

    const year = parts[0];
    const month = parts[1];
    const key = `${year}-${month}`;

    if (!monthMap.has(key)) {
      monthMap.set(key, []);
    }
    monthMap.get(key)!.push(lead);
  });

  const months = Array.from(monthMap.keys()).sort();
  const currentMonth = months.length > 0 ? months[months.length - 1] : '';
  const previousMonth = months.length > 1 ? months[months.length - 2] : '';

  const currentMonthLeads = monthMap.get(currentMonth) ?? [];
  const previousMonthLeads = monthMap.get(previousMonth) ?? [];

  // Apenas "Com Proposta" (situacao) — simulações são cálculos financeiros, não propostas comerciais
  const comPropostaCount = currentMonthLeads.filter(l => isComProposta(l)).length;
  const comPropostaPrevMonth = previousMonthLeads.filter(l => isComProposta(l)).length;

  const vendasCount = currentMonthLeads.filter(l => {
    const s = l.situacao?.nome?.toLowerCase() ?? '';
    return s === 'venda realizada' || s.includes('negócio ganho') || s.includes('negocio ganho');
  }).length;

  const vendasPrevMonth = previousMonthLeads.filter(l => {
    const s = l.situacao?.nome?.toLowerCase() ?? '';
    return s === 'venda realizada' || s.includes('negócio ganho') || s.includes('negocio ganho');
  }).length;

  return {
    comPropostaCount,
    comPropostaPrevMonth,
    comPropostaMeta: 3,
    vendasCount,
    vendasPrevMonth,
    vendaRealizadaMeta: 1,
  };
}

/**
 * Calculates cost per lead: total Meta spend / total new leads in period
 */
export interface CostPerLeadMetric {
  totalLeads: number;
  totalSpend: number;
  cpl: number; // cost per lead in R$
}

export function calculateCostPerLead(leads: Lead[], metaSpend: number): CostPerLeadMetric {
  const totalLeads = leads.length;
  const cpl = totalLeads > 0 ? metaSpend / totalLeads : 0;
  return {
    totalLeads,
    totalSpend: metaSpend,
    cpl,
  };
}
