export function formatCurrency(value: number): string {
  if (isNaN(value) || value === 0) return 'R$ 0,00';
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  }
  if (value >= 1_000) {
    return `R$ ${(value / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}K`;
  }
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatCurrencyFull(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(raw: string | undefined | null): string {
  if (!raw) return '-';
  const s = String(raw).split(' ')[0].split('T')[0];
  const parts = s.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return raw;
}

export function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR');
}

export function parseLeadValue(val: string | number | undefined | null): number {
  if (!val) return 0;
  const numStr = String(val)
    .replace(/R\$\s*/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = parseFloat(numStr);
  return isNaN(num) ? 0 : num;
}

export function toDateInputValue(date: Date): string {
  return date.toISOString().split('T')[0];
}

export const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const CHART_PALETTE = ['#0ea5e9', '#a855f7', '#f59e0b', '#10b981', '#f43f5e', '#64748b', '#06b6d4', '#ec4899'];
