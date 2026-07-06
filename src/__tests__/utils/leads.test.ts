import { describe, it, expect } from 'vitest';
import type { Lead } from '@/app/marketing-vision/types';
import {
  isSale,
  isLoss,
  isOpportunity,
  getOrigin,
  getLeadSource,
  getLeadDate,
  getLeadValueNumber,
  getReservaValueNumber,
  getStatusColor,
  getLeadTags,
  isLeadBolsao,
  toISODate,
  groupLeadsByYearMonth,
  cvStageRank,
  CV_STAGE_ORDER,
} from '@/app/marketing-vision/utils/leads';

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return { ...overrides };
}

describe('cvStageRank', () => {
  it('returns index for known stages', () => {
    expect(cvStageRank('venda realizada')).toBe(CV_STAGE_ORDER.indexOf('venda realizada'));
    expect(cvStageRank('aguardando atendimento')).toBe(CV_STAGE_ORDER.indexOf('aguardando atendimento'));
  });

  it('is case-insensitive', () => {
    expect(cvStageRank('Venda Realizada')).toBe(CV_STAGE_ORDER.indexOf('venda realizada'));
  });

  it('returns 999 for unknown stage', () => {
    expect(cvStageRank('unknown stage')).toBe(999);
  });
});

describe('isSale', () => {
  it('returns true for "venda realizada"', () => {
    expect(isSale(makeLead({ situacao: { nome: 'venda realizada' } }))).toBe(true);
  });

  it('returns true for "negócio ganho"', () => {
    expect(isSale(makeLead({ situacao: { nome: 'Negócio Ganho' } }))).toBe(true);
  });

  it('returns true for strings containing "vendid"', () => {
    expect(isSale(makeLead({ situacao: { nome: 'Vendido' } }))).toBe(true);
  });

  it('returns false for non-sale status', () => {
    expect(isSale(makeLead({ situacao: { nome: 'em atendimento' } }))).toBe(false);
  });

  it('returns false when situacao is missing', () => {
    expect(isSale(makeLead({}))).toBe(false);
  });
});

describe('isLoss', () => {
  it('returns true if motivo_cancelamento exists', () => {
    expect(isLoss(makeLead({ motivo_cancelamento: { nome: 'Desistiu' } }))).toBe(true);
  });

  it('returns true for "perdido" status', () => {
    expect(isLoss(makeLead({ situacao: { nome: 'Perdido' } }))).toBe(true);
  });

  it('returns true for "cancelado" status', () => {
    expect(isLoss(makeLead({ situacao: { nome: 'Cancelado' } }))).toBe(true);
  });

  it('returns false for "sem conexão" (not a loss)', () => {
    expect(isLoss(makeLead({ situacao: { nome: 'Sem Conexão' } }))).toBe(false);
  });

  it('returns false for active status', () => {
    expect(isLoss(makeLead({ situacao: { nome: 'em atendimento' } }))).toBe(false);
  });
});

describe('isOpportunity', () => {
  it('returns false if lead is a sale', () => {
    expect(isOpportunity(makeLead({ situacao: { nome: 'venda realizada' } }))).toBe(false);
  });

  it('returns false if lead is a loss', () => {
    expect(isOpportunity(makeLead({ situacao: { nome: 'perdido' } }))).toBe(false);
  });

  it('returns true if qtde_simulacoes_associadas > 0', () => {
    expect(isOpportunity(makeLead({ qtde_simulacoes_associadas: 2 }))).toBe(true);
  });

  it('returns true if situacao includes "visita"', () => {
    expect(isOpportunity(makeLead({ situacao: { nome: 'Visita Agendada' } }))).toBe(true);
  });

  it('returns false for "aguardando atendimento"', () => {
    expect(isOpportunity(makeLead({ situacao: { nome: 'aguardando atendimento' } }))).toBe(false);
  });
});

describe('getOrigin', () => {
  it('returns midia_visita when available and not template', () => {
    expect(getOrigin(makeLead({ midia_visita: 'Facebook' }))).toBe('Facebook');
  });

  it('falls back to midia_principal', () => {
    expect(getOrigin(makeLead({ midia_principal: 'Instagram' }))).toBe('Instagram');
  });

  it('falls back to origem string', () => {
    expect(getOrigin(makeLead({ origem: 'Painel' }))).toBe('Painel');
  });

  it('extracts nome from origem object', () => {
    expect(getOrigin(makeLead({ origem: { nome: 'Site' } }))).toBe('Site');
  });

  it('returns "Desconhecido" when no origin found', () => {
    expect(getOrigin(makeLead({}))).toBe('Desconhecido');
  });

  it('skips template variables like {{adset.name}}', () => {
    expect(getOrigin(makeLead({ midia_visita: '{{adset.name}}', midia_principal: 'Instagram' }))).toBe('Instagram');
  });
});

describe('getLeadSource', () => {
  it('identifies manual lead from "painel" channel', () => {
    const lead = makeLead({ origem: 'Painel', autor_ultima_alteracao: 'carlos@lv.com' });
    const src = getLeadSource(lead);
    expect(src.type).toBe('manual');
    expect(src.by).toBe('carlos@lv.com');
  });

  it('identifies integration lead', () => {
    const lead = makeLead({ origem: 'Facebook' });
    const src = getLeadSource(lead);
    expect(src.type).toBe('integração');
  });

  it('detects broken media (template var)', () => {
    const lead = makeLead({ midia_principal: '{{campaign.name}}' });
    expect(getLeadSource(lead).mediaBroken).toBe(true);
  });
});

describe('getLeadDate', () => {
  it('returns data_venda for sold leads', () => {
    expect(getLeadDate(makeLead({ situacao: { nome: 'venda realizada' }, data_venda: '2026-07-01', data_cad: '2026-06-01' }))).toBe('2026-07-01');
  });

  it('returns data_cad for non-sale leads', () => {
    expect(getLeadDate(makeLead({ data_cad: '2026-06-01' }))).toBe('2026-06-01');
  });

  it('falls through data_cadastro, data_cadastramento', () => {
    expect(getLeadDate(makeLead({ data_cadastro: '2026-05-01' }))).toBe('2026-05-01');
    expect(getLeadDate(makeLead({ data_cadastramento: '2026-04-01' }))).toBe('2026-04-01');
  });

  it('returns empty string when no date', () => {
    expect(getLeadDate(makeLead({}))).toBe('');
  });
});

describe('getLeadValueNumber', () => {
  it('uses valor_venda for sold leads', () => {
    expect(getLeadValueNumber(makeLead({ situacao: { nome: 'venda realizada' }, valor_venda: 500000 }))).toBe(500000);
  });

  it('uses valor_negocio for non-sold leads', () => {
    expect(getLeadValueNumber(makeLead({ valor_negocio: '300.000,00' }))).toBe(300000);
  });

  it('handles Brazilian currency format with R$', () => {
    expect(getLeadValueNumber(makeLead({ valor_negocio: 'R$ 500,00' }))).toBe(500);
  });

  it('handles American decimal format', () => {
    expect(getLeadValueNumber(makeLead({ valor_negocio: '793518.00' }))).toBe(793518);
  });

  it('returns 0 when value is empty', () => {
    expect(getLeadValueNumber(makeLead({}))).toBe(0);
  });
});

describe('getReservaValueNumber', () => {
  it('parses valor_venda', () => {
    expect(getReservaValueNumber(makeLead({ valor_venda: '500.000,00' }))).toBe(500000);
  });

  it('returns 0 when missing', () => {
    expect(getReservaValueNumber(makeLead({}))).toBe(0);
  });
});

describe('getStatusColor', () => {
  it('uses API color when provided', () => {
    const result = getStatusColor(makeLead({ situacao: { nome: 'Custom', cor: '#FF0000' } }));
    expect(result.bg).toBe('#FF0000');
    expect(result.text).toBe('#FFFFFF');
  });

  it('returns predefined color for known status', () => {
    expect(getStatusColor('aguardando atendimento corretor').bg).toBe('#FFEA00');
    expect(getStatusColor('venda realizada').bg).toBe('#FFFFFF');
    expect(getStatusColor('perdido').bg).toBe('#6B7280');
  });

  it('returns default color for unknown status', () => {
    const result = getStatusColor('some random status');
    expect(result.bg).toBe('#4B5563');
  });

  it('accepts lead object', () => {
    expect(getStatusColor(makeLead({ situacao: { nome: 'em atendimento' } })).bg).toBe('#FF8A00');
  });
});

describe('getLeadTags', () => {
  it('extracts string tags', () => {
    expect(getLeadTags(makeLead({ tags: ['tag1', 'tag2'] }))).toEqual(['tag1', 'tag2']);
  });

  it('extracts nome from object tags', () => {
    expect(getLeadTags(makeLead({ tags: [{ nome: 'Tag A' }, { nome: 'Tag B' }] }))).toEqual(['Tag A', 'Tag B']);
  });

  it('filters out empty tags', () => {
    expect(getLeadTags(makeLead({ tags: ['a', '', { nome: '' }] }))).toEqual(['a']);
  });

  it('returns empty array when no tags', () => {
    expect(getLeadTags(makeLead({}))).toEqual([]);
  });
});

describe('isLeadBolsao', () => {
  it('detects bolsão by tag', () => {
    expect(isLeadBolsao(makeLead({ tags: ['bolsão exclusivo'] }))).toBe(true);
    expect(isLeadBolsao(makeLead({ tags: ['BOLSAO'] }))).toBe(true);
  });

  it('detects bolsão by field', () => {
    expect(isLeadBolsao(makeLead({ bolsao: true }))).toBe(true);
    expect(isLeadBolsao(makeLead({ bolsao: 1 }))).toBe(true);
    expect(isLeadBolsao(makeLead({ bolsao: 'true' }))).toBe(true);
    expect(isLeadBolsao(makeLead({ bolsao: 'sim' }))).toBe(true);
  });

  it('returns false when not bolsão', () => {
    expect(isLeadBolsao(makeLead({ bolsao: false }))).toBe(false);
    expect(isLeadBolsao(makeLead({}))).toBe(false);
  });
});

describe('toISODate', () => {
  it('passes through ISO date', () => {
    expect(toISODate('2026-07-05')).toBe('2026-07-05');
  });

  it('converts Brazilian date', () => {
    expect(toISODate('05/07/2026')).toBe('2026-07-05');
  });

  it('strips time portion', () => {
    expect(toISODate('2026-07-05T10:30:00')).toBe('2026-07-05');
  });

  it('returns empty for null/undefined', () => {
    expect(toISODate(null)).toBe('');
    expect(toISODate(undefined)).toBe('');
  });
});

describe('groupLeadsByYearMonth', () => {
  it('groups leads by year and month', () => {
    const leads = [
      makeLead({ data_cad: '2026-06-01' }),
      makeLead({ data_cad: '2026-06-15' }),
      makeLead({ data_cad: '2026-07-01' }),
    ];
    const result = groupLeadsByYearMonth(leads);
    expect(result[2026]?.[5]).toBe(2); // June is index 5
    expect(result[2026]?.[6]).toBe(1); // July is index 6
  });

  it('handles empty array', () => {
    expect(groupLeadsByYearMonth([])).toEqual({});
  });

  it('skips leads without valid date', () => {
    const leads = [makeLead({})];
    expect(groupLeadsByYearMonth(leads)).toEqual({});
  });
});
