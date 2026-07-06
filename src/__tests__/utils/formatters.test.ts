import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCurrencyFull,
  formatDate,
  formatNumber,
  parseLeadValue,
  toDateInputValue,
  MONTHS_PT,
  CHART_PALETTE,
} from '@/app/marketing-vision/utils/formatters';

describe('formatCurrency', () => {
  it('formats millions (>= 1_000_000)', () => {
    expect(formatCurrency(2_500_000)).toBe('R$ 2,5M');
    expect(formatCurrency(1_000_000)).toBe('R$ 1,0M');
  });

  it('formats thousands (>= 1_000)', () => {
    expect(formatCurrency(1_500)).toBe('R$ 1,5K');
    expect(formatCurrency(500_000)).toBe('R$ 500K');
  });

  it('formats regular values', () => {
    expect(formatCurrency(999)).toBe('R$\u00a0999,00');
    expect(formatCurrency(0)).toBe('R$ 0,00');
  });

  it('returns zero for NaN', () => {
    expect(formatCurrency(NaN)).toBe('R$ 0,00');
  });
});

describe('formatCurrencyFull', () => {
  it('formats with exact Brazilian currency', () => {
    expect(formatCurrencyFull(1500.5)).toBe('R$\u00a01.500,50');
    expect(formatCurrencyFull(0)).toBe('R$\u00a00,00');
  });
});

describe('formatDate', () => {
  it('converts ISO to Brazilian format', () => {
    expect(formatDate('2026-07-05')).toBe('05/07/2026');
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
  });

  it('handles datetime strings', () => {
    expect(formatDate('2026-07-05T10:30:00')).toBe('05/07/2026');
  });

  it('returns "-" for empty/null/undefined', () => {
    expect(formatDate('')).toBe('-');
    expect(formatDate(null)).toBe('-');
    expect(formatDate(undefined)).toBe('-');
  });
});

describe('formatNumber', () => {
  it('formats with pt-BR locale', () => {
    expect(formatNumber(1000)).toBe('1.000');
    expect(formatNumber(5000000)).toBe('5.000.000');
  });
});

describe('parseLeadValue', () => {
  it('parses Brazilian format with vírgula', () => {
    expect(parseLeadValue('1.234,56')).toBe(1234.56);
  });

  it('parses American format with ponto', () => {
    expect(parseLeadValue('793518.00')).toBe(793518);
  });

  it('returns number as-is', () => {
    expect(parseLeadValue(50000)).toBe(50000);
  });

  it('returns 0 for empty/null/undefined', () => {
    expect(parseLeadValue('')).toBe(0);
    expect(parseLeadValue(null)).toBe(0);
    expect(parseLeadValue(undefined)).toBe(0);
  });

  it('handles R$ prefix', () => {
    expect(parseLeadValue('R$ 1.500,00')).toBe(1500);
  });
});

describe('toDateInputValue', () => {
  it('returns YYYY-MM-DD from Date', () => {
    const d = new Date('2026-07-05T12:00:00');
    expect(toDateInputValue(d)).toBe('2026-07-05');
  });
});

describe('constants', () => {
  it('exports MONTHS_PT with 12 months', () => {
    expect(MONTHS_PT).toHaveLength(12);
    expect(MONTHS_PT[0]).toBe('Jan');
  });

  it('exports CHART_PALETTE with colors', () => {
    expect(CHART_PALETTE).toHaveLength(8);
    expect(CHART_PALETTE[0]).toBe('#0ea5e9');
  });
});
