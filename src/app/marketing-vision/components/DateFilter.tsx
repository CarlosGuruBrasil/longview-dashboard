'use client';

import React, { useState } from 'react';
import { RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useData } from '../context/DataContext';

function formatUpdatedAt(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export default function DateFilter() {
  const { dateRange, setDateRange, clearFilters, loading, refresh, filteredLeads, crmTotal, updatedAt } = useData();
  const [localStart, setLocalStart] = useState(dateRange.start);
  const [localEnd, setLocalEnd]     = useState(dateRange.end);
  const [expanded, setExpanded]     = useState(false);

  const hasFilter = !!(localStart || localEnd);

  function handleFilter() {
    const range = { start: localStart, end: localEnd };
    setDateRange(range);
    refresh(false, range);
    setExpanded(false);
  }

  function handleClear() {
    setLocalStart(''); setLocalEnd('');
    clearFilters();
    refresh(false, { start: '', end: '' });
    setExpanded(false);
  }

  // Adidas-style pill base
  const chip = 'no-tap shrink-0 h-9 px-4 rounded-full text-[13px] font-medium transition-all';
  const dateInput = `${chip} border border-white/12 bg-white/[0.03] text-zinc-100 [color-scheme:dark] focus:outline-none focus:border-white/30 w-full sm:w-auto`;

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Linha principal: contagem + toggle mobile + refresh */}
      <div className="flex items-center gap-2 w-full">
        {/* Contagem */}
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[13px] font-semibold text-zinc-100 truncate">
            {filteredLeads.length.toLocaleString('pt-BR')} <span className="font-normal text-zinc-400">leads</span>
            <span className="text-zinc-600 mx-1.5">·</span>
            <span className="text-zinc-400 font-normal">de {crmTotal.toLocaleString('pt-BR')}</span>
          </span>
          {updatedAt && (
            <span className="text-[11px] text-zinc-500 hidden sm:block">{formatUpdatedAt(updatedAt)}</span>
          )}
        </div>

        {/* Mobile: pill toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className={`sm:hidden no-tap flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-medium shrink-0 transition-all ${
            hasFilter
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/25'
              : 'border border-white/12 bg-white/[0.03] text-zinc-400'
          }`}
        >
          <SlidersHorizontal size={14} />
          {hasFilter ? 'Filtrado' : 'Filtrar'}
        </button>

        {/* Refresh */}
        <button
          onClick={() => refresh(true)}
          disabled={loading}
          className={`no-tap flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full text-[13px] font-medium shrink-0 border border-white/12 bg-white/[0.03] text-zinc-400 hover:text-zinc-100 transition-all disabled:opacity-40`}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Atualizar</span>
        </button>
      </div>

      {/* Filtros de data: expansível no mobile, sempre visível no desktop */}
      <div className={`${expanded ? 'flex' : 'hidden'} sm:flex items-center gap-2 flex-wrap`}>
        <label className="flex items-center gap-2 text-[13px] text-zinc-400 flex-1 sm:flex-none">
          De
          <input type="date" value={localStart} onChange={e => setLocalStart(e.target.value)} className={dateInput} />
        </label>

        <label className="flex items-center gap-2 text-[13px] text-zinc-400 flex-1 sm:flex-none">
          Até
          <input type="date" value={localEnd} onChange={e => setLocalEnd(e.target.value)} className={dateInput} />
        </label>

        <button
          onClick={handleFilter}
          className={`no-tap ${chip} bg-sky-500/15 text-sky-400 border border-sky-500/25 hover:bg-sky-500/25`}
        >
          Aplicar
        </button>

        {hasFilter && (
          <button onClick={handleClear} className={`no-tap ${chip} border border-white/12 text-zinc-500 hover:text-zinc-200`}>
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}
