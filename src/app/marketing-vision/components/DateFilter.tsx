'use client';

import React, { useState } from 'react';
import { RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useData } from '../context/DataContext';

export default function DateFilter() {
  const { dateRange, setDateRange, clearFilters, loading, refresh, filteredLeads, crmTotal } = useData();
  const [localStart, setLocalStart] = useState(dateRange.start);
  const [localEnd, setLocalEnd]     = useState(dateRange.end);
  const [expanded, setExpanded]     = useState(false);   // mobile only

  const hasFilter = !!(localStart || localEnd);

  function handleFilter() {
    const range = { start: localStart, end: localEnd };
    setDateRange(range); refresh(false, range); setExpanded(false);
  }
  function handleClear() {
    setLocalStart(''); setLocalEnd('');
    clearFilters(); refresh(false, { start: '', end: '' }); setExpanded(false);
  }

  const pill = 'no-tap shrink-0 h-8 px-3 rounded-full text-[13px] font-medium transition-all';
  const dateInput = [
    'h-8 rounded-full px-3 text-[13px] font-medium',
    'border border-white/12 bg-white/[0.04] text-zinc-200',
    '[color-scheme:dark] focus:outline-none focus:border-white/30 transition-all w-[130px]',
  ].join(' ');

  return (
    <>
      {/* ── DESKTOP: tudo em uma única linha ─────────────────────── */}
      <div className="hidden md:flex items-center gap-2">
        {/* De */}
        <input type="date" value={localStart} onChange={e => setLocalStart(e.target.value)} className={dateInput} />
        {/* Até */}
        <input type="date" value={localEnd}   onChange={e => setLocalEnd(e.target.value)}   className={dateInput} />

        {/* OK */}
        <button onClick={handleFilter} className={`${pill} bg-orange-500/15 text-orange-300 border border-orange-400/25 hover:bg-orange-500/25`}>
          Filtrar
        </button>

        {/* Limpar */}
        {hasFilter && (
          <button onClick={handleClear} className={`${pill} border border-white/12 text-zinc-500 hover:text-zinc-200`}>✕</button>
        )}

        {/* Separador */}
        <div className="w-px h-5 bg-white/10 shrink-0" />

        {/* Atualizar */}
        <button
          onClick={() => refresh(true)}
          disabled={loading}
          className={`${pill} flex items-center gap-1.5 border border-white/12 bg-white/[0.04] text-zinc-400 hover:text-zinc-100 disabled:opacity-40`}
          title="Atualizar dados"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* ── MOBILE: compacto com expansão ────────────────────────── */}
      <div className="md:hidden flex flex-col gap-2 w-full">
        {/* Linha 1: contagem + toggle + refresh */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[13px] font-semibold text-zinc-100 truncate">
              <span className="font-bold">{filteredLeads.length.toLocaleString('pt-BR')}</span>
              {' '}<span className="font-normal text-zinc-400">leads</span>
              <span className="text-zinc-600 mx-1">·</span>
              <span className="text-zinc-400">de {crmTotal.toLocaleString('pt-BR')}</span>
            </span>
          </div>

          <button
            onClick={() => setExpanded(v => !v)}
            className={`no-tap ${pill} flex items-center gap-1.5 ${
              hasFilter
                ? 'bg-orange-500/15 text-orange-300 border border-orange-400/25'
                : 'border border-white/12 bg-white/[0.04] text-zinc-400'
            }`}
          >
            <SlidersHorizontal size={13} />
            {hasFilter ? 'Ativo' : 'Filtrar'}
          </button>

          <button
            onClick={() => refresh(true)}
            disabled={loading}
            className={`no-tap ${pill} flex items-center gap-1.5 border border-white/12 bg-white/[0.04] text-zinc-400 disabled:opacity-40 px-2.5`}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Linha 2: inputs (colapsável) */}
        {expanded && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-[12px] text-zinc-500 shrink-0">De</span>
              <input type="date" value={localStart} onChange={e => setLocalStart(e.target.value)}
                className="h-9 flex-1 min-w-0 rounded-full px-3 text-[13px] border border-white/12 bg-white/[0.04] text-zinc-200 [color-scheme:dark] focus:outline-none" />
            </label>
            <label className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-[12px] text-zinc-500 shrink-0">Até</span>
              <input type="date" value={localEnd} onChange={e => setLocalEnd(e.target.value)}
                className="h-9 flex-1 min-w-0 rounded-full px-3 text-[13px] border border-white/12 bg-white/[0.04] text-zinc-200 [color-scheme:dark] focus:outline-none" />
            </label>
            <button onClick={handleFilter} className="no-tap h-9 px-3 rounded-full text-[13px] bg-orange-500/15 text-orange-300 border border-orange-400/25 shrink-0">OK</button>
            {hasFilter && <button onClick={handleClear} className="no-tap h-9 px-3 rounded-full text-[13px] border border-white/12 text-zinc-500 shrink-0">✕</button>}
          </div>
        )}
      </div>
    </>
  );
}
