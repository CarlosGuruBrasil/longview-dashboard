'use client';

import React, { useState } from 'react';
import { RefreshCw, X, Filter, SlidersHorizontal } from 'lucide-react';
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
    const range = { start: '', end: '' };
    setLocalStart('');
    setLocalEnd('');
    clearFilters();
    refresh(false, range);
    setExpanded(false);
  }

  const inputCls = `
    bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5
    text-xs text-zinc-100 focus:outline-none focus:border-sky-500
    focus:ring-1 focus:ring-sky-500/40 transition-colors [color-scheme:dark]
    w-full sm:w-auto
  `;

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Top row: counts + mobile toggle + refresh */}
      <div className="flex items-center gap-2 w-full">
        {/* Counts */}
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-sm font-semibold text-zinc-100 truncate">
            {filteredLeads.length.toLocaleString('pt-BR')}{' '}
            <span className="font-normal text-zinc-400">leads</span>
            <span className="text-zinc-600 mx-1">·</span>
            <span className="text-zinc-400 font-normal">de {crmTotal.toLocaleString('pt-BR')} na base</span>
          </span>
          {updatedAt && (
            <span className="text-[11px] text-zinc-500 hidden sm:block">
              Atualizado em {formatUpdatedAt(updatedAt)}
            </span>
          )}
        </div>

        {/* Mobile: toggle filter panel */}
        <button
          onClick={() => setExpanded(v => !v)}
          className={`sm:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 ${
            hasFilter
              ? 'bg-sky-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
          }`}
        >
          <SlidersHorizontal size={13} />
          {hasFilter ? 'Filtrado' : 'Filtrar'}
        </button>

        {/* Refresh — always visible */}
        <button
          onClick={() => refresh(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs font-medium transition-colors active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Atualizar</span>
        </button>
      </div>

      {/* Desktop: always-visible filter row | Mobile: expandable */}
      <div className={`${expanded ? 'flex' : 'hidden'} sm:flex flex-wrap items-center gap-2`}>
        <label className="flex items-center gap-1.5 text-xs text-zinc-400 whitespace-nowrap flex-1 sm:flex-none">
          De:
          <input type="date" value={localStart} onChange={e => setLocalStart(e.target.value)} className={inputCls} />
        </label>

        <label className="flex items-center gap-1.5 text-xs text-zinc-400 whitespace-nowrap flex-1 sm:flex-none">
          Até:
          <input type="date" value={localEnd} onChange={e => setLocalEnd(e.target.value)} className={inputCls} />
        </label>

        <button
          onClick={handleFilter}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors active:scale-95"
        >
          <Filter size={12} />
          Filtrar
        </button>

        <button
          onClick={handleClear}
          disabled={!localStart && !localEnd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs font-medium transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <X size={12} />
          Limpar
        </button>
      </div>
    </div>
  );
}
