import { describe, it, expect } from 'vitest';
import type { Lead } from '@/app/marketing-vision/types';
import {
  getLeadStage,
  calculateNewLeadsRate,
  calculateAttendanceRate,
  calculateSchedulingRate,
  calculateVisitRate,
  calculateMetricsByPeriod,
  isComProposta,
  calculateProposalVsSales,
  calculateCostPerLead,
} from '@/app/marketing-vision/utils/metrics';

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return { ...overrides };
}

describe('getLeadStage', () => {
  it('returns "none" when situacao is missing', () => {
    expect(getLeadStage(makeLead({}))).toBe('none');
  });

  it('returns "visited" for sales', () => {
    expect(getLeadStage(makeLead({ situacao: { nome: 'venda realizada' } }))).toBe('visited');
  });

  it('returns "visited" for simulação', () => {
    expect(getLeadStage(makeLead({ situacao: { nome: 'Simulação' } }))).toBe('visited');
  });

  it('returns "visited" for com reserva', () => {
    expect(getLeadStage(makeLead({ situacao: { nome: 'Com Reserva' } }))).toBe('visited');
  });

  it('returns "visited" for com proposta', () => {
    expect(getLeadStage(makeLead({ situacao: { nome: 'Com Proposta' } }))).toBe('visited');
  });

  it('returns "visited" for visita realizada', () => {
    expect(getLeadStage(makeLead({ situacao: { nome: 'Visita Realizada' } }))).toBe('visited');
  });

  it('returns "scheduled" for visita agendada', () => {
    expect(getLeadStage(makeLead({ situacao: { nome: 'Visita Agendada' } }))).toBe('scheduled');
  });

  it('returns "attended" for em atendimento', () => {
    expect(getLeadStage(makeLead({ situacao: { nome: 'Em Atendimento' } }))).toBe('attended');
  });

  it('returns "attended" for aguardando atendimento', () => {
    expect(getLeadStage(makeLead({ situacao: { nome: 'Aguardando Atendimento' } }))).toBe('attended');
  });

  it('returns "new" for fresh leads', () => {
    expect(getLeadStage(makeLead({ situacao: { nome: 'Novo' } }))).toBe('new');
  });
});

describe('calculateNewLeadsRate', () => {
  it('returns ratio of current to previous month', () => {
    const leads = [
      makeLead({ data_cad: '2026-06-01' }),
      makeLead({ data_cad: '2026-06-15' }),
      makeLead({ data_cad: '2026-07-01' }),
    ];
    const result = calculateNewLeadsRate(leads);
    expect(result.numerator).toBe(1);
    expect(result.denominator).toBe(2);
    expect(result.rate).toBe(0.5);
  });

  it('returns 1 when only one month', () => {
    const leads = [makeLead({ data_cad: '2026-07-01' })];
    const result = calculateNewLeadsRate(leads);
    expect(result.rate).toBe(1);
  });

  it('returns 1 when no leads', () => {
    const result = calculateNewLeadsRate([]);
    expect(result.rate).toBe(1);
  });
});

describe('calculateAttendanceRate', () => {
  it('calculates attended / total', () => {
    const leads = [
      makeLead({ situacao: { nome: 'Novo' } }),
      makeLead({ situacao: { nome: 'Em Atendimento' } }),
      makeLead({ situacao: { nome: 'Visita Agendada' } }),
    ];
    const result = calculateAttendanceRate(leads);
    expect(result.numerator).toBe(2);
    expect(result.denominator).toBe(3);
    expect(result.rate).toBeCloseTo(0.666, 2);
  });

  it('returns 0 when no leads', () => {
    const result = calculateAttendanceRate([]);
    expect(result.rate).toBe(0);
  });
});

describe('calculateSchedulingRate', () => {
  it('calculates scheduled / attended', () => {
    const leads = [
      makeLead({ situacao: { nome: 'Em Atendimento' } }),
      makeLead({ situacao: { nome: 'Visita Agendada' } }),
    ];
    const result = calculateSchedulingRate(leads);
    expect(result.numerator).toBe(1);
    expect(result.denominator).toBe(2);
    expect(result.rate).toBe(0.5);
  });

  it('returns 0 when no attended leads', () => {
    const result = calculateSchedulingRate([]);
    expect(result.rate).toBe(0);
  });
});

describe('calculateVisitRate', () => {
  it('calculates visited / scheduled', () => {
    const leads = [
      makeLead({ situacao: { nome: 'Visita Agendada' } }),
      makeLead({ situacao: { nome: 'Visita Realizada' } }),
    ];
    const result = calculateVisitRate(leads);
    expect(result.numerator).toBe(1);
    expect(result.denominator).toBe(2);
    expect(result.rate).toBe(0.5);
  });

  it('returns 0 when no scheduled leads', () => {
    const result = calculateVisitRate([]);
    expect(result.rate).toBe(0);
  });
});

describe('isComProposta', () => {
  it('returns true for "Com Proposta"', () => {
    expect(isComProposta(makeLead({ situacao: { nome: 'Com Proposta' } }))).toBe(true);
  });

  it('returns true for "Proposta"', () => {
    expect(isComProposta(makeLead({ situacao: { nome: 'Proposta' } }))).toBe(true);
  });

  it('returns false for other status', () => {
    expect(isComProposta(makeLead({ situacao: { nome: 'Em Atendimento' } }))).toBe(false);
  });
});

describe('calculateMetricsByPeriod', () => {
  const leads = [
    makeLead({ data_cad: '2026-01-05', situacao: { nome: 'Novo' } }),
    makeLead({ data_cad: '2026-01-15', situacao: { nome: 'Em Atendimento' } }),
    makeLead({ data_cad: '2026-02-01', situacao: { nome: 'Venda Realizada' } }),
    makeLead({ data_cad: '2026-02-10', situacao: { nome: 'Novo' } }),
    makeLead({ data_cad: '2026-02-20', situacao: { nome: 'Visita Agendada' } }),
  ];

  it('groups by month', () => {
    const result = calculateMetricsByPeriod(leads, 'month');
    expect(result).toHaveLength(2);
    expect(result[0].period).toBe('2026-01');
    expect(result[0].totalLeads).toBe(2);
    expect(result[1].period).toBe('2026-02');
    expect(result[1].totalLeads).toBe(3);
  });

  it('calculates newLeadsRate between periods', () => {
    const result = calculateMetricsByPeriod(leads, 'month');
    expect(result[1].newLeadsRate).toBe(1.5); // Feb(3) / Jan(2)
  });

  it('includes salesCount and proposalCount', () => {
    const result = calculateMetricsByPeriod(leads, 'month');
    expect(result[1].salesCount).toBe(1);
  });
});

describe('calculateProposalVsSales', () => {
  it('returns counts for current and previous month', () => {
    const leads = [
      makeLead({ data_cad: '2026-06-01', situacao: { nome: 'Com Proposta' } }),
      makeLead({ data_cad: '2026-06-15', situacao: { nome: 'Venda Realizada' } }),
      makeLead({ data_cad: '2026-07-01', situacao: { nome: 'Com Proposta' } }),
      makeLead({ data_cad: '2026-07-10', situacao: { nome: 'Com Proposta' } }),
      makeLead({ data_cad: '2026-07-20', situacao: { nome: 'Venda Realizada' } }),
    ];
    const result = calculateProposalVsSales(leads);
    expect(result.comPropostaCount).toBe(2);
    expect(result.comPropostaPrevMonth).toBe(1);
    expect(result.vendasCount).toBe(1);
    expect(result.vendasPrevMonth).toBe(1);
    expect(result.comPropostaMeta).toBe(3);
    expect(result.vendaRealizadaMeta).toBe(1);
  });

  it('handles empty leads', () => {
    const result = calculateProposalVsSales([]);
    expect(result.comPropostaCount).toBe(0);
    expect(result.vendasCount).toBe(0);
  });
});

describe('calculateCostPerLead', () => {
  it('divides spend by lead count', () => {
    const leads = [makeLead({}), makeLead({}), makeLead({})];
    const result = calculateCostPerLead(leads, 1500);
    expect(result.totalLeads).toBe(3);
    expect(result.totalSpend).toBe(1500);
    expect(result.cpl).toBe(500);
  });

  it('returns 0 when no leads', () => {
    const result = calculateCostPerLead([], 1000);
    expect(result.cpl).toBe(0);
  });
});
