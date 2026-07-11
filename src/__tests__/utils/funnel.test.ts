import { describe, it, expect } from 'vitest';
import type { Lead } from '@/app/marketing-vision/types';
import {
  funnelCounts,
  inFunnelStage,
  isActiveLead,
  EXCLUDED_STATUS,
  ATENDIMENTO_STATUS,
} from '@/app/marketing-vision/utils/funnel';

const lead = (status: string): Lead => ({ id: status, status } as unknown as Lead);

describe('funnelCounts', () => {
  const leads = [
    lead('Em Atendimento'),
    lead('Sem conexão'),
    lead('Visita Realizada'),
    lead('Com Reserva'),
    lead('Venda Realizada'),
    lead('Perdido'),
    lead('Lançamento Trindade'),
    lead('Novo'),
  ];

  it('exclui Perdido e Lançamentos da base ativa', () => {
    expect(funnelCounts(leads).ativos).toBe(6);
  });

  it('Sem conexão NÃO conta como atendimento', () => {
    expect(ATENDIMENTO_STATUS.has('Sem conexão')).toBe(false);
    expect(funnelCounts(leads).atendimento).toBe(4);
  });

  it('etapas são cumulativas e monotônicas', () => {
    const c = funnelCounts(leads);
    expect(c.ativos).toBeGreaterThanOrEqual(c.atendimento);
    expect(c.atendimento).toBeGreaterThanOrEqual(c.visita);
    expect(c.visita).toBeGreaterThanOrEqual(c.reserva);
    expect(c.reserva).toBeGreaterThanOrEqual(c.venda);
    expect(c.visita).toBe(3);
    expect(c.reserva).toBe(2);
    expect(c.venda).toBe(1);
  });

  it('inFunnelStage usa o mesmo predicado da contagem (clique = número exibido)', () => {
    const c = funnelCounts(leads);
    expect(leads.filter(l => inFunnelStage(l, 'atendimento')).length).toBe(c.atendimento);
    expect(leads.filter(l => inFunnelStage(l, 'visita')).length).toBe(c.visita);
    expect(leads.filter(l => inFunnelStage(l, 'reserva')).length).toBe(c.reserva);
    expect(leads.filter(l => inFunnelStage(l, 'venda')).length).toBe(c.venda);
  });

  it('lead excluído nunca entra em etapa nenhuma', () => {
    for (const status of EXCLUDED_STATUS) {
      expect(isActiveLead(lead(status))).toBe(false);
      expect(inFunnelStage(lead(status), 'atendimento')).toBe(false);
    }
  });
});
