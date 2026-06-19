import type { Lead, StatusColor } from '../types';

export const CV_STAGE_ORDER = [
  'aguardando atendimento',
  'em atendimento sdr',
  'aguardando atendimento corretor',
  'sem conexão',
  'sem conexao',
  'em atendimento',
  'visita agendada',
  'visita realizada',
  'simulação',
  'simulacao',
  'com reserva',
  'com proposta',
  'venda realizada',
];

export function cvStageRank(name: string): number {
  const idx = CV_STAGE_ORDER.indexOf((name || '').toLowerCase().trim());
  return idx === -1 ? 999 : idx;
}

export function isSale(lead: Lead): boolean {
  if (!lead.situacao?.nome) return false;
  const s = lead.situacao.nome.toLowerCase().trim();
  return (
    s === 'venda realizada' ||
    s.includes('negócio ganho') ||
    s.includes('negocio ganho') ||
    s.includes('vendid') ||
    s.includes('venda real')
  );
}

export function isLoss(lead: Lead): boolean {
  if (lead.motivo_cancelamento?.nome) return true;
  if (!lead.situacao?.nome) return false;
  const s = lead.situacao.nome.toLowerCase();
  return (
    s.includes('perdido') ||
    s.includes('descartado') ||
    s.includes('inativo') ||
    s.includes('cancelado') ||
    s.includes('lixeira') ||
    s.includes('desist') ||
    s.includes('reprovado') ||
    s.includes('sem conexão') ||
    s.includes('sem conexao')
  );
}

export function isOpportunity(lead: Lead): boolean {
  if (isSale(lead) || isLoss(lead)) return false;
  if (
    (lead.qtde_simulacoes_associadas && lead.qtde_simulacoes_associadas > 0) ||
    (lead.qtde_reservas_associadas && lead.qtde_reservas_associadas > 0)
  ) return true;
  if (!lead.situacao?.nome) return false;
  const s = lead.situacao.nome.toLowerCase();
  return (
    s.includes('visita') ||
    s.includes('simula') ||
    s.includes('reserva') ||
    s.includes('proposta') ||
    s.includes('negocia') ||
    s.includes('apresenta') ||
    s.includes('crédito') ||
    s.includes('credito')
  );
}

export function getOrigin(lead: Lead): string {
  if (lead.midia_visita) return String(lead.midia_visita);
  if (lead.midia_principal) return String(lead.midia_principal);
  if (lead.origem) {
    return typeof lead.origem === 'object' && lead.origem.nome
      ? String(lead.origem.nome)
      : String(lead.origem);
  }
  return 'Desconhecido';
}

export function getLeadDate(lead: Lead): string {
  return lead.data_cad || lead.data_cadastro || lead.data_cadastramento || '';
}

export function getLeadValueNumber(lead: Lead): number {
  if (!lead.valor_negocio) return 0;
  const numStr = lead.valor_negocio
    .toString()
    .replace(/R\$\s*/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = parseFloat(numStr);
  return isNaN(num) ? 0 : num;
}

export function getStatusColor(lead: Lead | string): StatusColor {
  let name = '';
  let apiColor: string | null = null;

  if (typeof lead === 'object' && 'situacao' in lead) {
    name = lead.situacao?.nome ?? '';
    apiColor = lead.situacao?.cor ?? null;
  } else {
    name = String(lead);
  }

  if (apiColor && apiColor !== '' && apiColor !== '#' && apiColor !== 'null') {
    return { bg: apiColor, text: '#FFFFFF' };
  }

  const s = name.toLowerCase();
  if (s.includes('aguardando atendimento corretor')) return { bg: '#FFEA00', text: '#000000' };
  if (s === 'aguardando atendimento')               return { bg: '#FF0F47', text: '#FFFFFF' };
  if (s.includes('sdr'))                            return { bg: '#00E676', text: '#000000' };
  if (s === 'em atendimento')                       return { bg: '#FF8A00', text: '#FFFFFF' };
  if (s.includes('visita agendada'))                return { bg: '#00B0FF', text: '#FFFFFF' };
  if (s.includes('visita realizada'))               return { bg: '#00897B', text: '#FFFFFF' };
  if (s.includes('simula'))                         return { bg: '#FF5252', text: '#FFFFFF' };
  if (s.includes('reserva'))                        return { bg: '#2979FF', text: '#FFFFFF' };
  if (s === 'venda realizada' || s.includes('vendid') || s.includes('ganho'))
                                                    return { bg: '#FFFFFF', text: '#000000' };
  if (s.includes('perdid') || s === 'perdido')      return { bg: '#6B7280', text: '#FFFFFF' };
  if (s.includes('lançamento') || s.includes('lancamento')) return { bg: '#8B5CF6', text: '#FFFFFF' };
  if (s.includes('qualificad'))                     return { bg: '#F59E0B', text: '#000000' };
  if (s.includes('proposta'))                       return { bg: '#EC4899', text: '#FFFFFF' };
  if (s.includes('negociacao') || s.includes('negociação')) return { bg: '#F97316', text: '#FFFFFF' };
  return { bg: '#4B5563', text: '#E5E7EB' };
}

export function getLeadTags(lead: Lead): string[] {
  if (!lead.tags) return [];
  return lead.tags.map(t =>
    typeof t === 'string' ? t : (t.nome ?? '')
  ).filter(Boolean);
}

export function isLeadBolsao(lead: Lead): boolean {
  const tags = getLeadTags(lead);
  const hasBolsaoTag = tags.some(t => t.toLowerCase().includes('bolsão') || t.toLowerCase().includes('bolsao'));
  if (hasBolsaoTag) return true;
  if (lead.bolsao === true || lead.bolsao === 1 || lead.bolsao === 'true' || lead.bolsao === 'sim') return true;
  return false;
}

export function toISODate(raw: string | undefined | null): string {
  if (!raw) return '';
  const s = String(raw).trim().split(' ')[0].split('T')[0];
  if (s.includes('/')) {
    const [d, m, y] = s.split('/');
    return y && m && d ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : '';
  }
  return s;
}

export function groupLeadsByYearMonth(leads: Lead[]): Record<number, number[]> {
  const byYearMonth: Record<number, number[]> = {};
  leads.forEach(lead => {
    const raw = getLeadDate(lead);
    if (!raw) return;
    const iso = toISODate(raw);
    if (!iso) return;
    const parts = iso.split('-');
    if (parts.length < 3) return;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1; // 0-indexed
    if (isNaN(y) || isNaN(m) || m < 0 || m > 11) return;
    if (!byYearMonth[y]) byYearMonth[y] = Array(12).fill(0);
    byYearMonth[y][m]++;
  });
  return byYearMonth;
}
