import type { Lead } from '../types'

/**
 * Fonte única das etapas do funil de leads (marketing).
 * Conta pelo campo `leads.status` (confiável, vem direto do banco).
 *
 * Semântica: funil de LEADS — "Venda Realizada" = leads convertidos no CRM.
 * Unidades vendidas (investidor compra N unidades) é métrica do Sales Vision
 * via cv_vendas — são números diferentes por definição.
 */
// ponytail: etapas hardcoded espelhando a tabela funil_etapas; mover para a
// tabela (coluna etapa_funil) se o CV CRM ganhar status novos com frequência.

/** Status fora do pipeline ativo (não são etapas de progresso) */
export const EXCLUDED_STATUS = new Set([
  'Perdido',
  'Lançamento Sul da Ilha',
  'Lançamento Trindade',
])

/** Atendimento iniciado ou além. "Sem conexão" fica de fora: contato tentado
 *  sem sucesso não é atendimento — inflava a etapa em ~350 leads. */
export const ATENDIMENTO_STATUS = new Set([
  'Em Atendimento',
  'Em Atendimento SDR',
  'Carteira Corretor',
  'Visita Agendada',
  'Visita Realizada',
  'Com Reserva',
  'Venda Realizada',
])

export const VISITA_STATUS = new Set([
  'Visita Agendada',
  'Visita Realizada',
  'Com Reserva',
  'Venda Realizada',
])

export const RESERVA_STATUS = new Set([
  'Com Reserva',
  'Venda Realizada',
])

export type FunnelStage = 'atendimento' | 'visita' | 'reserva' | 'venda'

const STAGE_SETS: Record<Exclude<FunnelStage, 'venda'>, Set<string>> = {
  atendimento: ATENDIMENTO_STATUS,
  visita: VISITA_STATUS,
  reserva: RESERVA_STATUS,
}

export function isActiveLead(l: Lead): boolean {
  return !EXCLUDED_STATUS.has(l.status ?? '')
}

/** Predicado cumulativo: lead está na etapa OU além dela.
 *  Usado tanto para CONTAR quanto para FILTRAR ao clicar — mesmos números. */
export function inFunnelStage(l: Lead, stage: FunnelStage): boolean {
  if (!isActiveLead(l)) return false
  if (stage === 'venda') return l.status === 'Venda Realizada'
  return STAGE_SETS[stage].has(l.status ?? '')
}

export interface FunnelCounts {
  ativos: number
  atendimento: number
  visita: number
  reserva: number
  venda: number
}

export function funnelCounts(leads: Lead[]): FunnelCounts {
  const active = leads.filter(isActiveLead)
  return {
    ativos: active.length,
    atendimento: active.filter(l => inFunnelStage(l, 'atendimento')).length,
    visita: active.filter(l => inFunnelStage(l, 'visita')).length,
    reserva: active.filter(l => inFunnelStage(l, 'reserva')).length,
    venda: active.filter(l => inFunnelStage(l, 'venda')).length,
  }
}
