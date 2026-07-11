'use client';
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { Lead, MetaData, EstoqueData, MetaLeadForm, MetaPageInfo, DateRange, ActiveView, LeadSituacao, LeadSummary } from '../types';
import { toISODate, getOrigin } from '../utils/leads';
import { inFunnelStage, type FunnelStage } from '../utils/funnel';
import logger from '@/lib/logger'


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

interface DataContextValue {
  // raw data
  allLeads: Lead[];
  metaData: MetaData | null;
  estoque: EstoqueData;
  leadForms: MetaLeadForm[];
  metaPage: MetaPageInfo | null;
  crmTotal: number;
  updatedAt: string;
  loading: boolean;
  dataError: string | null;
  metaValidation: { orphanedLeads: unknown[]; totalMetaLeads: number; error: string | null } | null;

  /** Dados pré-agregados pelo servidor (payload leve). Disponível logo no mount.
   *  Use para cards de KPI e gráficos do dashboard. `null` enquanto carrega. */
  leadSummary: LeadSummary | null;

  // detailed leads paginated
  detailedLeads: Lead[];
  detailedPage: number;
  detailedLimit: number;
  detailedTotal: number;
  detailedLoading: boolean;
  fetchDetailedLeads: (page: number, limit?: number, rangeOverride?: DateRange, search?: string) => Promise<void>;

  // filtered
  filteredLeads: Lead[];

  // filters
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  leadFilters: LeadFilters;
  setLeadFilters: (filters: LeadFilters) => void;
  clearFilters: () => void;

  // navigation
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;

  // refresh
  refresh: (force?: boolean, rangeOverride?: DateRange, options?: { validateMeta?: boolean }) => Promise<void>;
  updateLeadInMemory: (leadId: string | number, fields: Partial<Lead>) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}

interface DataProviderProps {
  children: React.ReactNode;
  initialData?: {
    leads: Lead[];
    crmTotal: number;
    meta: MetaData;
    estoque: EstoqueData;
    leadForms: MetaLeadForm[];
    page: MetaPageInfo | null;
    updatedAt: string;
    metaValidation?: { orphanedLeads: unknown[]; totalMetaLeads: number; error: string | null } | null;
  };
}

const DEFAULT_DATE: DateRange = { start: '', end: '' };

function defaultRange(): DateRange {
  return DEFAULT_DATE;
}

export function DataProvider({ children, initialData }: DataProviderProps) {
  const [allLeads, setAllLeads] = useState<Lead[]>(initialData?.leads ?? []);
  const [metaData, setMetaData] = useState<MetaData | null>(initialData?.meta ?? null);
  const [estoque, setEstoque] = useState<EstoqueData>(initialData?.estoque ?? { empreendimentos: [], resumo: [], unidades: [] });
  const [leadForms, setLeadForms] = useState<MetaLeadForm[]>(initialData?.leadForms ?? []);
  const [metaPage, setMetaPage] = useState<MetaPageInfo | null>(initialData?.page ?? null);
  const [metaValidation, setMetaValidation] = useState<{ orphanedLeads: unknown[]; totalMetaLeads: number; error: string | null } | null>(initialData?.metaValidation ?? null);
  const [crmTotal, setCrmTotal] = useState(initialData?.crmTotal ?? 0);
  const [updatedAt, setUpdatedAt] = useState(initialData?.updatedAt ?? '');
  const [loading, setLoading] = useState(!initialData);
  const [dataError, setDataError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange());
  const [leadFilters, setLeadFilters] = useState<LeadFilters>({});
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');

  // Lead summary (dados agregados — payload leve do servidor)
  const [leadSummary, setLeadSummary] = useState<LeadSummary | null>(null);

  // Detailed leads pagination states
  const [detailedLeads, setDetailedLeads] = useState<Lead[]>([]);
  const [detailedPage, setDetailedPage] = useState(1);
  const [detailedLimit, setDetailedLimit] = useState(50);
  const [detailedTotal, setDetailedTotal] = useState(0);
  const [detailedLoading, setDetailedLoading] = useState(false);

  const filteredLeads = useMemo(() => {
    let result = allLeads;

    // Date filter: local filters override global filters
    const start = leadFilters.startDate || dateRange.start;
    const end = leadFilters.endDate || dateRange.end;
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

    // Lead filters
    if (leadFilters.origem) {
      const filterVal = leadFilters.origem.toLowerCase();
      result = result.filter(lead => {
        const origin = getOrigin(lead);
        return origin.toLowerCase().includes(filterVal);
      });
    }
    if (leadFilters.situacao) {
      const filterVal = leadFilters.situacao;
      result = result.filter(lead => {
        const sit = lead.situacao as LeadSituacao | undefined;
        return sit?.nome?.toLowerCase() === filterVal.toLowerCase();
      });
    }
    if (leadFilters.funnelStage) {
      const stage = leadFilters.funnelStage;
      result = result.filter(lead => inFunnelStage(lead, stage));
    }
    if (leadFilters.empreendimento) {
      const filterVal = leadFilters.empreendimento.toLowerCase();
      result = result.filter(lead => {
        const emp = lead.empreendimento;
        return Array.isArray(emp)
          ? emp.some(e => (e.nome || '').toLowerCase().includes(filterVal))
          : (emp as { nome?: string } | undefined)?.nome?.toLowerCase().includes(filterVal);
      });
    }
    if (leadFilters.corretor) {
      const filterVal = leadFilters.corretor.toLowerCase();
      result = result.filter(lead => {
        const name = String(lead.corretor?.nome || '').toLowerCase();
        return name === filterVal;
      });
    }
    if (leadFilters.imobiliaria) {
      const filterVal = leadFilters.imobiliaria.toLowerCase();
      result = result.filter(lead => {
        const name = String(lead.imobiliaria?.nome || '').toLowerCase();
        return name === filterVal;
      });
    }
    if (leadFilters.gestor) {
      const filterVal = leadFilters.gestor.toLowerCase();
      result = result.filter(lead => {
        const name = String(lead.gestor?.nome || (lead.raw as any)?.gestor?.nome || '').toLowerCase();
        return name === filterVal;
      });
    }

    return result;
  }, [allLeads, dateRange, leadFilters]);

  const fetchDetailedLeads = useCallback(async (page: number, limit = 50, rangeOverride?: DateRange, search?: string) => {
    setDetailedLoading(true);
    try {
      const r = rangeOverride ?? dateRange;
      const params = new URLSearchParams();
      params.set('detailed', 'true');
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (r.start) params.set('start', r.start);
      if (r.end) params.set('end', r.end);
      if (search) params.set('search', search);
      const url = `/api/data?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const leads = data.leads?.leads ?? data.leads ?? [];
      setDetailedLeads(Array.isArray(leads) ? leads : []);
      setDetailedTotal(data.leads?.crmTotal ?? leads.length);
      setDetailedPage(page);
      setDetailedLimit(limit);
    } catch (e) {
      logger.error({ e }, '[DataContext] fetchDetailedLeads error:');
    } finally {
      setDetailedLoading(false);
    }
  }, [dateRange]);

  const refresh = useCallback(async (force = false, rangeOverride?: DateRange, options?: { validateMeta?: boolean }) => {
    setLoading(true);
    try {
      const r = rangeOverride ?? dateRange;
      const params = new URLSearchParams();
      if (force) params.set('refresh', 'true');
      if (r.start) params.set('start', r.start);
      if (r.end) params.set('end', r.end);
      if (options?.validateMeta) params.set('validateMeta', 'true');
      const qs = params.toString();
      const url = `/api/data${qs ? '?' + qs : ''}`;

      // Busca dados principais + leadSummary em paralelo (sem bloquear um no outro)
      const aggParams = new URLSearchParams({ aggregate: 'true' });
      if (r.start) aggParams.set('start', r.start);
      if (r.end)   aggParams.set('end', r.end);

      const [res, aggRes] = await Promise.allSettled([
        fetch(url),
        fetch(`/api/data?${aggParams.toString()}`),
      ]);

      if (res.status !== 'fulfilled' || !res.value.ok)
        throw new Error(`HTTP ${res.status === 'fulfilled' ? res.value.status : 'network error'}`);

      const data = await res.value.json();
      const leads = data.leads?.leads ?? data.leads ?? [];
      setAllLeads(Array.isArray(leads) ? leads : []);
      setCrmTotal(data.leads?.crmTotal ?? leads.length);
      setMetaData(data.meta ?? null);
      setEstoque(data.estoque ?? { empreendimentos: [], resumo: [], unidades: [] });
      setLeadForms(data.leadForms ?? []);
      setMetaPage(data.page ?? null);
      setMetaValidation(data.metaValidation ?? null);
      setUpdatedAt(data.updatedAt ?? new Date().toISOString());
      setDataError(null);

      // Popula leadSummary se o aggregate retornou OK (não bloqueia o fluxo principal)
      if (aggRes.status === 'fulfilled' && aggRes.value.ok) {
        const aggData = await aggRes.value.json();
        if (aggData.leadSummary) setLeadSummary(aggData.leadSummary);
      }

      // Auto trigger detailed fetch on refresh to match dates
      await fetchDetailedLeads(1, detailedLimit, r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar dados';
      logger.error({ msg }, '[DataContext] refresh error:');
      setDataError(msg);
    } finally {
      setLoading(false);
    }
  }, [dateRange, detailedLimit, fetchDetailedLeads]);

  const clearFilters = useCallback(() => {
    setDateRange(DEFAULT_DATE);
    setLeadFilters({});
  }, []);

  /**
   * Busca dados agregados (< 5 KB) explicitamente — útil para atualizar
   * apenas o leadSummary sem fazer o refresh completo de leads.
   * O mount inicial continua usando refresh() para garantir que o Meta
   * seja buscado ao vivo quando o cache estiver stale.
   */
  const fetchAggregate = useCallback(async (rangeOverride?: DateRange) => {
    try {
      const r = rangeOverride ?? dateRange;
      const params = new URLSearchParams({ aggregate: 'true' });
      if (r.start) params.set('start', r.start);
      if (r.end)   params.set('end', r.end);
      const res = await fetch(`/api/data?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.leadSummary) setLeadSummary(data.leadSummary);
    } catch (e) {
      logger.warn({ e }, '[DataContext] fetchAggregate error:');
    }
  }, [dateRange]);

  const updateLeadInMemory = useCallback((leadId: string | number, fields: Partial<Lead>) => {
    setAllLeads(prev => prev.map(l => {
      const currentId = l.idlead ?? l.id;
      if (String(currentId) === String(leadId)) {
        return { ...l, ...fields };
      }
      return l;
    }));
    setDetailedLeads(prev => prev.map(l => {
      const currentId = l.idlead ?? l.id;
      if (String(currentId) === String(leadId)) {
        return { ...l, ...fields };
      }
      return l;
    }));
  }, []);

  // Initial load — comportamento original mantido (refresh ao vivo garante Meta atualizado).
  // leadSummary é populado em paralelo dentro do refresh().
  useEffect(() => {
    let active = true;
    const id = window.setTimeout(async () => {
      if (allLeads.length === 0) {
        await refresh(); // refresh já chama fetchAggregate em paralelo internamente
      } else if (active) {
        await fetchDetailedLeads(1, detailedLimit);
      }
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DataContext.Provider value={{
      allLeads, metaData, estoque, leadForms, metaPage,
      crmTotal, updatedAt, loading, dataError, metaValidation,
      leadSummary,
      detailedLeads, detailedPage, detailedLimit, detailedTotal, detailedLoading, fetchDetailedLeads,
      filteredLeads,
      dateRange, setDateRange, leadFilters, setLeadFilters, clearFilters,
      activeView, setActiveView,
      refresh,
      updateLeadInMemory,
    }}>
      {children}
    </DataContext.Provider>
  );
}
