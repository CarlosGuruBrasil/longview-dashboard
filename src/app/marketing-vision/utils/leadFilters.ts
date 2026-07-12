import type { Lead, DateRange, LeadSituacao } from '../types';
import { toISODate, getOrigin } from './leads';
import { inFunnelStage, type FunnelStage } from './funnel';

export interface LeadFilters {
  origem?: string;
  situacao?: string;
  /** Etapa cumulativa do funil — usa o MESMO predicado da contagem (utils/funnel.ts) */
  funnelStage?: FunnelStage;
  empreendimento?: string;
  corretor?: string;
  imobiliaria?: string;
  gestor?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Aplica os filtros globais de leads sobre uma lista. Fonte única do predicado —
 * usada pelo DataContext (filteredLeads) e pelo FilterBar (opções em cascata:
 * cada dropdown lista só valores possíveis dado o resto dos filtros ativos).
 */
export function applyLeadFilters(leads: Lead[], filters: LeadFilters, dateRange?: DateRange): Lead[] {
  let result = leads;

  // Date filter: local filters override global filters
  const start = filters.startDate || dateRange?.start;
  const end = filters.endDate || dateRange?.end;
  if (start || end) {
    result = result.filter(lead => {
      const raw = lead.data_cad || lead.data_cadastro || lead.data_cadastramento;
      if (!raw) return false;
      const d = toISODate(raw);
      if (!d) return false;
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }

  if (filters.origem) {
    const filterVal = filters.origem.toLowerCase();
    result = result.filter(lead => {
      if (getOrigin(lead).toLowerCase().includes(filterVal)) return true;
      const raw = lead.raw || {};
      const camp1 = String(raw.campanha || '').toLowerCase();
      const camp2 = String(raw.utm_campaign || '').toLowerCase();
      const campId = String(raw.utm_campaign_id || raw.idcampanha || '').toLowerCase();
      return camp1.includes(filterVal) || camp2.includes(filterVal) || campId.includes(filterVal);
    });
  }
  if (filters.situacao) {
    const filterVal = filters.situacao.toLowerCase();
    result = result.filter(lead => {
      const sit = lead.situacao as LeadSituacao | undefined;
      return sit?.nome?.toLowerCase() === filterVal;
    });
  }
  if (filters.funnelStage) {
    const stage = filters.funnelStage;
    result = result.filter(lead => inFunnelStage(lead, stage));
  }
  if (filters.empreendimento) {
    const filterVal = filters.empreendimento.toLowerCase();
    result = result.filter(lead => {
      const emp = lead.empreendimento;
      return Array.isArray(emp)
        ? emp.some(e => (e.nome || '').toLowerCase().includes(filterVal))
        : (emp as { nome?: string } | undefined)?.nome?.toLowerCase().includes(filterVal);
    });
  }
  if (filters.corretor) {
    const filterVal = filters.corretor.toLowerCase();
    result = result.filter(lead => String(lead.corretor?.nome || '').toLowerCase() === filterVal);
  }
  if (filters.imobiliaria) {
    const filterVal = filters.imobiliaria.toLowerCase();
    result = result.filter(lead => String(lead.imobiliaria?.nome || '').toLowerCase() === filterVal);
  }
  if (filters.gestor) {
    const filterVal = filters.gestor.toLowerCase();
    result = result.filter(lead => {
      const rawGestor = (lead.raw as { gestor?: { nome?: unknown } } | undefined)?.gestor;
      const rawName = rawGestor && typeof rawGestor === 'object' ? rawGestor.nome : undefined;
      const name = String(lead.gestor?.nome || (typeof rawName === 'string' ? rawName : '') || '').toLowerCase();
      return name === filterVal;
    });
  }

  return result;
}
