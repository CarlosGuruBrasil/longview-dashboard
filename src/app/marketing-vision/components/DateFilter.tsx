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

  const dateInput = [
    'h-9 flex-1 min-w-0 rounded-full px-3 text-[13px] font-medium',
    'border border-white/12 bg-white/[0.04] text-zinc-200',
    '[color-scheme:dark] focus:outline-none focus:border-white/30 transition-all',
  ].join(' ');

  const pill = 'no-tap h-9 px-4 rounded-full text-[13px] font-medium transition-all shrink-0';

  return (
    <div className="flex flex-col gap-2 w-full">

      {/* Linha 1: contagem + botão filtrar mobile + refresh */}
      <div className="flex items-center gap-2 w-full">
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <span className="text-[13px] font-semibold text-zinc-100 truncate">
            <span className="font-bold">{filteredLeads.length.toLocaleString('pt-BR')}</span>
            {' '}<span className="font-normal text-zinc-400">leads</span>
            <span className="text-zinc-600 mx-1.5">·</span>
            <span className="text-zinc-400">de {crmTotal.toLocaleString('pt-BR')}</span>
          </span>
          {updatedAt && (
            <span className="text-[11px] text-zinc-600 hidden sm:block truncate">
              {formatUpdatedAt(updatedAt)}
            </span>
          )}
        </div>

        {/* Mobile: toggle Filtrar */}
        <button
          onClick={() => setExpanded(v => !v)}
          className={`sm:hidden ${pill} flex items-center gap-1.5 ${
            hasFilter
              ? 'bg-sky-500/15 text-sky-400 border border-sky-500/25'
              : 'border border-white/12 bg-white/[0.04] text-zinc-400'
          }`}
        >
          <SlidersHorizontal size={14} />
          {hasFilter ? 'Ativo' : 'Filtrar'}
        </button>

        {/* Refresh */}
        <button
          onClick={() => refresh(true)}
          disabled={loading}
          className={`${pill} flex items-center gap-1.5 border border-white/12 bg-white/[0.04] text-zinc-400 hover:text-zinc-100 disabled:opacity-40 px-3`}
          title="Atualizar dados"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Atualizar</span>
        </button>
      </div>

      {/* Linha 2: inputs de data — DE + ATÉ em linha única */}
      <div className={`${expanded ? 'flex' : 'hidden'} sm:flex items-center gap-2`}>
        {/* DE */}
        <label className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-[12px] text-zinc-500 shrink-0 w-5 text-right">De</span>
          <input
            type="date"
            value={localStart}
            onChange={e => setLocalStart(e.target.value)}
            className={dateInput}
          />
        </label>

        {/* ATÉ */}
        <label className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-[12px] text-zinc-500 shrink-0 w-6 text-right">Até</span>
          <input
            type="date"
            value={localEnd}
            onChange={e => setLocalEnd(e.target.value)}
            className={dateInput}
          />
        </label>

        {/* Aplicar */}
        <button
          onClick={handleFilter}
          className={`${pill} bg-sky-500/15 text-sky-400 border border-sky-500/25 hover:bg-sky-500/25 px-3`}
        >
          OK
        </button>

        {/* Limpar */}
        {hasFilter && (
          <button
            onClick={handleClear}
            className={`${pill} border border-white/12 text-zinc-500 hover:text-zinc-200 px-3`}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
