'use client';
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { Lead, MetaData, EstoqueData, MetaLeadForm, MetaPageInfo, DateRange, ActiveView } from '../types';
import { toISODate, getLeadDate } from '../utils/leads';

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
  metaValidation: { orphanedLeads: any[]; totalMetaLeads: number; error: string | null } | null;

  // filtered
  filteredLeads: Lead[];

  // filters
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  clearFilters: () => void;

  // navigation
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;

  // refresh
  refresh: (force?: boolean, rangeOverride?: DateRange) => Promise<void>;
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
    metaValidation?: { orphanedLeads: any[]; totalMetaLeads: number; error: string | null } | null;
  };
}

const DEFAULT_DATE: DateRange = { start: '', end: '' };

export function DataProvider({ children, initialData }: DataProviderProps) {
  const [allLeads, setAllLeads] = useState<Lead[]>(initialData?.leads ?? []);
  const [metaData, setMetaData] = useState<MetaData | null>(initialData?.meta ?? null);
  const [estoque, setEstoque] = useState<EstoqueData>(initialData?.estoque ?? {});
  const [leadForms, setLeadForms] = useState<MetaLeadForm[]>(initialData?.leadForms ?? []);
  const [metaPage, setMetaPage] = useState<MetaPageInfo | null>(initialData?.page ?? null);
  const [metaValidation, setMetaValidation] = useState<{ orphanedLeads: any[]; totalMetaLeads: number; error: string | null } | null>(initialData?.metaValidation ?? null);
  const [crmTotal, setCrmTotal] = useState(initialData?.crmTotal ?? 0);
  const [updatedAt, setUpdatedAt] = useState(initialData?.updatedAt ?? '');
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE);
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');

  const filteredLeads = useMemo(() => {
    if (!dateRange.start && !dateRange.end) return allLeads;
    return allLeads.filter(lead => {
      const d = toISODate(getLeadDate(lead));
      if (!d) return false;
      if (dateRange.start && d < dateRange.start) return false;
      if (dateRange.end && d > dateRange.end) return false;
      return true;
    });
  }, [allLeads, dateRange]);

  const clearFilters = useCallback(() => setDateRange(DEFAULT_DATE), []);

  // Auto-fetch se SSR não trouxe leads (Postgres vazio, cold start, falha de conexão…)
  // Não depende de !initialData: SSR pode retornar initialData com leads [] se
  // a tabela ainda está vazia (ex: primeiro deploy antes do sync rodar).
  useEffect(() => {
    if (allLeads.length === 0) {
      refresh();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async (force = false, rangeOverride?: DateRange) => {
    setLoading(true);
    try {
      const r = rangeOverride ?? dateRange;
      const params = new URLSearchParams();
      if (force) params.set('refresh', 'true');
      if (r.start) params.set('start', r.start);
      if (r.end) params.set('end', r.end);
      const qs = params.toString();
      const url = `/api/data${qs ? '?' + qs : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const leads = data.leads?.leads ?? data.leads ?? [];
      setAllLeads(Array.isArray(leads) ? leads : []);
      setCrmTotal(data.leads?.crmTotal ?? leads.length);
      setMetaData(data.meta ?? null);
      setEstoque(data.estoque ?? {});
      setLeadForms(data.leadForms ?? []);
      setMetaPage(data.page ?? null);
      setMetaValidation(data.metaValidation ?? null);
      setUpdatedAt(data.updatedAt ?? new Date().toISOString());
    } catch (e) {
      console.error('[DataContext] refresh error:', e);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  return (
    <DataContext.Provider value={{
      allLeads, metaData, estoque, leadForms, metaPage,
      crmTotal, updatedAt, loading, metaValidation,
      filteredLeads,
      dateRange, setDateRange, clearFilters,
      activeView, setActiveView,
      refresh,
    }}>
      {children}
    </DataContext.Provider>
  );
}
