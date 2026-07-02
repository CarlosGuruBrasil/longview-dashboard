'use client';
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { Lead, MetaData, EstoqueData, MetaLeadForm, MetaPageInfo, DateRange, ActiveView, LeadSituacao } from '../types';
import { toISODate, getOrigin } from '../utils/leads';

export interface LeadFilters {
  origem?: string;
  situacao?: string;
  empreendimento?: string;
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

  // detailed leads paginated
  detailedLeads: Lead[];
  detailedPage: number;
  detailedLimit: number;
  detailedTotal: number;
  detailedLoading: boolean;
  fetchDetailedLeads: (page: number, limit?: number, rangeOverride?: DateRange) => Promise<void>;

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

/** Mês atual até hoje (MTD), em ISO local (YYYY-MM-DD) para não dar erro de fuso. */
function monthToDate(): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return { start: `${y}-${m}-01`, end: `${y}-${m}-${d}` };
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
  const [dateRange, setDateRange] = useState<DateRange>(monthToDate());
  const [leadFilters, setLeadFilters] = useState<LeadFilters>({});
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');

  // Detailed leads pagination states
  const [detailedLeads, setDetailedLeads] = useState<Lead[]>([]);
  const [detailedPage, setDetailedPage] = useState(1);
  const [detailedLimit, setDetailedLimit] = useState(50);
  const [detailedTotal, setDetailedTotal] = useState(0);
  const [detailedLoading, setDetailedLoading] = useState(false);

  const filteredLeads = useMemo(() => {
    let result = allLeads;

    // Date filter
    if (dateRange.start || dateRange.end) {
      result = result.filter(lead => {
        const raw = lead.data_cad || lead.data_cadastro || lead.data_cadastramento;
        if (!raw) return false;
        const d = toISODate(raw);
        if (!d) return false;
        if (dateRange.start && d < dateRange.start) return false;
        if (dateRange.end && d > dateRange.end) return false;
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
    if (leadFilters.empreendimento) {
      const filterVal = leadFilters.empreendimento.toLowerCase();
      result = result.filter(lead => {
        const emp = lead.empreendimento;
        return Array.isArray(emp)
          ? emp.some(e => (e.nome || '').toLowerCase().includes(filterVal))
          : (emp as { nome?: string } | undefined)?.nome?.toLowerCase().includes(filterVal);
      });
    }

    return result;
  }, [allLeads, dateRange, leadFilters]);

  const fetchDetailedLeads = useCallback(async (page: number, limit = 50, rangeOverride?: DateRange) => {
    setDetailedLoading(true);
    try {
      const r = rangeOverride ?? dateRange;
      const params = new URLSearchParams();
      params.set('detailed', 'true');
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (r.start) params.set('start', r.start);
      if (r.end) params.set('end', r.end);
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
      console.error('[DataContext] fetchDetailedLeads error:', e);
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
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
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

      // Auto trigger detailed fetch on refresh to match dates
      await fetchDetailedLeads(1, detailedLimit, r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar dados';
      console.error('[DataContext] refresh error:', msg);
      setDataError(msg);
    } finally {
      setLoading(false);
    }
  }, [dateRange, detailedLimit, fetchDetailedLeads]);

  const clearFilters = useCallback(() => {
    setDateRange(DEFAULT_DATE);
    setLeadFilters({});
  }, []);

  // Initial load — fetches data once on mount
  useEffect(() => {
    let active = true;
    const id = window.setTimeout(async () => {
      if (allLeads.length === 0) {
        await refresh(); // refresh already awaits fetchDetailedLeads internally
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
      detailedLeads, detailedPage, detailedLimit, detailedTotal, detailedLoading, fetchDetailedLeads,
      filteredLeads,
      dateRange, setDateRange, leadFilters, setLeadFilters, clearFilters,
      activeView, setActiveView,
      refresh,
    }}>
      {children}
    </DataContext.Provider>
  );
}
