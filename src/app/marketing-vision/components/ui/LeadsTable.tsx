'use client';

/* eslint-disable react-hooks/static-components */

import { useMemo, useState, useRef, useEffect } from 'react';
import type { Lead } from '../../types';
import type { DateRange } from '../../types';
import {
  getOrigin,
  getStatusColor,
  getLeadTags,
  isLeadBolsao,
  toISODate,
} from '../../utils/leads';
import { formatDate } from '../../utils/formatters';
import LeadDrawer from './LeadDrawer';

interface LeadsTableProps {
  leads: Lead[];
  page: number;
  limit: number;
  total: number;
  loading: boolean;
  onPageChange: (page: number, limit?: number, range?: DateRange, search?: string) => void;
  allLeadsForDropdowns: Lead[];
}

const MAX_ROWS = 200;

function unique(values: (string | undefined | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort();
}

const chip     = 'shrink-0 h-9 px-3 rounded-full text-[13px] font-medium transition-all [color-scheme:dark]';
const chipIdle = `${chip} border border-white/12 bg-white/[0.03] text-zinc-400 focus:outline-none focus:border-white/30`;
const chipActive = `${chip} bg-white/90 text-zinc-900 border-transparent`;

function renderIdleBadge(days: number) {
  if (days <= 0) return <span className="text-[10px] text-zinc-500">ativo</span>
  if (days <= 10) return <span className="text-[10px] text-zinc-400 font-medium">{days}d ativo</span>
  if (days <= 30) return <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20">⏱ {days}d parado</span>
  return <span className="text-[10px] text-red-400 font-bold bg-red-500/10 px-1.5 py-0.5 rounded-md border border-red-500/20 animate-pulse">⚠️ {days}d parado!</span>
}

export default function LeadsTable({
  leads,
  page,
  limit,
  total,
  loading,
  onPageChange,
  allLeadsForDropdowns,
}: LeadsTableProps) {
  // ── Local date range (independent from global filter) ───────────────────
  const [localStart, setLocalStart] = useState('');
  const [localEnd, setLocalEnd]     = useState('');
  const localRange = useMemo<DateRange>(() => ({ start: localStart, end: localEnd }), [localStart, localEnd]);

  // ── Debounced name search → triggers server-side fetch ───────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRange = useRef(localRange);
  useEffect(() => { latestRange.current = localRange; }, [localRange]);

  // ── Filter states ────────────────────────────────────────────────────────
  const [filterNome, setFilterNome]                   = useState('');
  const [filterDate, setFilterDate]                   = useState('');
  const [filterOrigem, setFilterOrigem]               = useState('');
  const [filterCorretor, setFilterCorretor]           = useState('');
  const [filterGestor, setFilterGestor]               = useState('');
  const [filterImobiliaria, setFilterImobiliaria]     = useState('');
  const [filterEmpreendimento, setFilterEmpreendimento] = useState('');
  const [filterEtapa, setFilterEtapa]                 = useState('');
  const [filterTag, setFilterTag]                     = useState('');
  const [filterBolsao, setFilterBolsao]               = useState('');

  // ── UI state ─────────────────────────────────────────────────────────────
  const [showAdvanced, setShowAdvanced]   = useState(false); // desktop expanded panel
  const [showBottomSheet, setShowBottomSheet] = useState(false); // mobile bottom sheet
  const [selected, setSelected] = useState<Lead | null>(null); // drawer de detalhes
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close bottom sheet on outside tap
  useEffect(() => {
    if (!showBottomSheet) return;
    const handler = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setShowBottomSheet(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showBottomSheet]);

  // Initial load with empty date range (independent from global filter)
  // and re-fetch when local date range changes
  useEffect(() => {
    onPageChange(1, limit, latestRange.current, filterNome || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStart, localEnd]);

  // Debounced name search triggers server fetch
  const handleNomeChange = (val: string) => {
    setFilterNome(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onPageChange(1, limit, latestRange.current, val || undefined);
    }, 400);
  };

  // ── Dropdown options ──────────────────────────────────────────────────────
  const options = useMemo(() => ({
    origens:         unique(allLeadsForDropdowns.map((l) => getOrigin(l))),
    corretores:      unique(allLeadsForDropdowns.map((l) => l.corretor?.nome)),
    gestores:        unique(allLeadsForDropdowns.map((l) => l.gestor?.nome)),
    imobiliarias:    unique(allLeadsForDropdowns.map((l) => l.imobiliaria?.nome)),
    empreendimentos: unique(allLeadsForDropdowns.flatMap((l) => l.empreendimento?.map((e) => e.nome) ?? [])),
    etapas:          unique(allLeadsForDropdowns.map((l) => l.situacao?.nome)),
    tags:            unique(allLeadsForDropdowns.flatMap((l) => getLeadTags(l))),
  }), [allLeadsForDropdowns]);

  // ── Filtering logic ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const nomeLower  = filterNome.toLowerCase();
    const dateFilter = filterDate.replace(/\D/g, '');

    return leads.filter((lead) => {
      if (nomeLower && !(lead.nome ?? '').toLowerCase().includes(nomeLower)) return false;

      if (dateFilter) {
        const iso = toISODate(lead.data_cad || lead.data_cadastro || lead.data_cadastramento);
        if (!iso) return false;
        const [yy, mm, dd] = iso.split('-');
        if (!dd || !mm || !yy) return false;
        if (!`${dd}/${mm}/${yy}`.includes(dateFilter)) return false;
      }

      if (filterOrigem        && getOrigin(lead) !== filterOrigem)                                          return false;
      if (filterCorretor      && lead.corretor?.nome !== filterCorretor)                                     return false;
      if (filterGestor        && lead.gestor?.nome !== filterGestor)                                         return false;
      if (filterImobiliaria   && lead.imobiliaria?.nome !== filterImobiliaria)                              return false;
      if (filterEmpreendimento && !(lead.empreendimento ?? []).some((e) => e.nome === filterEmpreendimento)) return false;
      if (filterEtapa         && lead.situacao?.nome !== filterEtapa)                                        return false;
      if (filterTag           && !getLeadTags(lead).includes(filterTag))                                     return false;
      if (filterBolsao) {
        const isBolsao = isLeadBolsao(lead);
        if (filterBolsao === 'sim' && !isBolsao) return false;
        if (filterBolsao === 'nao' && isBolsao)  return false;
      }

      return true;
    });
  }, [leads, filterNome, filterDate, filterOrigem, filterCorretor, filterGestor,
      filterImobiliaria, filterEmpreendimento, filterEtapa, filterTag, filterBolsao]);

  const displayed = filtered.slice(0, MAX_ROWS);

  function clearFilters() {
    setFilterNome('');
    setFilterDate('');
    setFilterOrigem('');
    setFilterCorretor('');
    setFilterGestor('');
    setFilterImobiliaria('');
    setFilterEmpreendimento('');
    setFilterEtapa('');
    setFilterTag('');
    setFilterBolsao('');
    setLocalStart('');
    setLocalEnd('');
    setShowAdvanced(false);
    setShowBottomSheet(false);
    onPageChange(1, limit, { start: '', end: '' }, undefined);
  }

  // ── Active filter counts ──────────────────────────────────────────────────
  const primaryActive   = [filterNome, filterEtapa, filterOrigem, filterCorretor].filter(Boolean).length;
  const advancedActive  = [filterDate, filterEmpreendimento, filterGestor, filterImobiliaria, filterTag, filterBolsao].filter(Boolean).length;
  const totalActive     = primaryActive + advancedActive;

  // ── Reusable select ───────────────────────────────────────────────────────
  const FilterSelect = ({
    value, setter, opts, label, fullWidth = false,
  }: {
    value: string;
    setter: (v: string) => void;
    opts: string[];
    label: string;
    fullWidth?: boolean;
  }) => (
    <select
      value={value}
      onChange={(e) => setter(e.target.value)}
      className={`${value ? chipActive : chipIdle} ${fullWidth ? 'w-full' : 'max-w-[160px]'}`}
    >
      <option value="">{label}</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  // ── Advanced filters content (shared by desktop panel + mobile sheet) ─────
  const AdvancedFilters = ({ layout }: { layout: 'panel' | 'sheet' }) => (
    <div className={layout === 'sheet'
      ? 'grid grid-cols-1 gap-3'
      : 'flex flex-wrap gap-2 pt-2 border-t border-white/8'
    }>
      <input
        type="text"
        placeholder="Data (dd/mm)..."
        value={filterDate}
        onChange={(e) => setFilterDate(e.target.value)}
        className={`${filterDate ? chipActive : chipIdle} ${layout === 'sheet' ? 'w-full' : 'w-28'} placeholder:text-zinc-600`}
      />
      <FilterSelect value={filterEmpreendimento} setter={setFilterEmpreendimento} opts={options.empreendimentos} label="Empreendimento" fullWidth={layout === 'sheet'} />
      <FilterSelect value={filterGestor}         setter={setFilterGestor}         opts={options.gestores}        label="Gestor"        fullWidth={layout === 'sheet'} />
      <FilterSelect value={filterImobiliaria}    setter={setFilterImobiliaria}    opts={options.imobiliarias}    label="Imobiliária"   fullWidth={layout === 'sheet'} />
      <FilterSelect value={filterTag}            setter={setFilterTag}            opts={options.tags}            label="Tag"           fullWidth={layout === 'sheet'} />
      <select
        value={filterBolsao}
        onChange={(e) => setFilterBolsao(e.target.value)}
        className={`${filterBolsao ? chipActive : chipIdle} ${layout === 'sheet' ? 'w-full' : ''}`}
      >
        <option value="">Bolsão</option>
        <option value="sim">Sim</option>
        <option value="nao">Não</option>
      </select>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">

      {/* ── MOBILE FILTER BAR ─────────────────────────────────────────── */}
      <div className="flex sm:hidden gap-2">
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={filterNome}
          onChange={(e) => handleNomeChange(e.target.value)}
          className={`${filterNome ? chipActive : chipIdle} flex-1 min-w-0 placeholder:text-zinc-600`}
        />
        <button
          onClick={() => setShowBottomSheet(true)}
          className={totalActive > 0 ? chipActive : chipIdle}
        >
          Filtros{totalActive > 0 ? ` (${totalActive})` : ''}
        </button>
        {totalActive > 0 && (
          <button onClick={clearFilters} className={`${chipIdle} !text-zinc-400 px-2.5`}>✕</button>
        )}
      </div>

      {/* ── DESKTOP FILTER BAR ────────────────────────────────────────── */}
      <div className="hidden sm:flex flex-col gap-2">
        {/* Row 0 — local date range (independent from global filter) */}
        <div className="flex gap-2 items-center flex-wrap text-xs text-zinc-500">
          <span className="text-[11px] font-semibold uppercase tracking-wider shrink-0">Período da lista:</span>
          <input
            type="date"
            value={localStart}
            onChange={(e) => setLocalStart(e.target.value)}
            className={`${localStart ? chipActive : chipIdle} w-36 placeholder:text-zinc-600`}
            placeholder="De..."
          />
          <input
            type="date"
            value={localEnd}
            onChange={(e) => setLocalEnd(e.target.value)}
            className={`${localEnd ? chipActive : chipIdle} w-36 placeholder:text-zinc-600`}
            placeholder="Até..."
          />
          {(localStart || localEnd) && (
            <button onClick={() => { setLocalStart(''); setLocalEnd(''); }} className={`${chipIdle} !text-zinc-400 px-2.5`}>
              ✕ Limpar data
            </button>
          )}
          <span className="text-[10px] text-zinc-600 ml-1">Sem data selecionada = todos os leads, mais recentes primeiro</span>
        </div>
        {/* Row 1 — primary filters */}
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="text"
            placeholder="Buscar por nome (todos os leads)..."
            value={filterNome}
            onChange={(e) => handleNomeChange(e.target.value)}
            className={`${filterNome ? chipActive : chipIdle} flex-1 min-w-[180px] placeholder:text-zinc-600`}
          />
          <FilterSelect value={filterEtapa}   setter={setFilterEtapa}   opts={options.etapas}    label="Etapa"   />
          <FilterSelect value={filterOrigem}  setter={setFilterOrigem}  opts={options.origens}   label="Origem"  />
          <FilterSelect value={filterCorretor} setter={setFilterCorretor} opts={options.corretores} label="Corretor" />

          {/* Mais filtros toggle */}
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className={advancedActive > 0 ? chipActive : chipIdle}
          >
            {showAdvanced ? '▲' : '▼'} Mais filtros
            {advancedActive > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] bg-black/20 font-bold">
                {advancedActive}
              </span>
            )}
          </button>

          {totalActive > 0 && (
            <button onClick={clearFilters} className={`${chipIdle} !text-zinc-400 px-2.5`}>
              ✕ Limpar
            </button>
          )}
        </div>

        {/* Row 2 — advanced filters (expandable) */}
        {showAdvanced && <AdvancedFilters layout="panel" />}
      </div>

      {/* ── MOBILE BOTTOM SHEET ───────────────────────────────────────── */}
      {showBottomSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:hidden" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div
            ref={sheetRef}
            className="rounded-t-2xl border-t border-white/10 px-5 pt-4 pb-8 flex flex-col gap-4"
            style={{ backgroundColor: 'var(--surface-elevated, #111)', maxHeight: '85vh', overflowY: 'auto' }}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-1" />

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Filtros</h3>
              {totalActive > 0 && (
                <button onClick={clearFilters} className="text-xs text-zinc-400 underline">
                  Limpar todos
                </button>
              )}
            </div>

            {/* All filters in sheet */}
            <div className="flex flex-col gap-3">
              <FilterSelect value={filterEtapa}            setter={setFilterEtapa}            opts={options.etapas}          label="Etapa"          fullWidth />
              <FilterSelect value={filterOrigem}           setter={setFilterOrigem}           opts={options.origens}         label="Origem"         fullWidth />
              <FilterSelect value={filterCorretor}         setter={setFilterCorretor}         opts={options.corretores}      label="Corretor"       fullWidth />
              <FilterSelect value={filterEmpreendimento}   setter={setFilterEmpreendimento}   opts={options.empreendimentos} label="Empreendimento" fullWidth />
              <FilterSelect value={filterGestor}           setter={setFilterGestor}           opts={options.gestores}        label="Gestor"         fullWidth />
              <FilterSelect value={filterImobiliaria}      setter={setFilterImobiliaria}      opts={options.imobiliarias}    label="Imobiliária"    fullWidth />
              <FilterSelect value={filterTag}              setter={setFilterTag}              opts={options.tags}            label="Tag"            fullWidth />
              <select
                value={filterBolsao}
                onChange={(e) => setFilterBolsao(e.target.value)}
                className={`${filterBolsao ? chipActive : chipIdle} w-full`}
              >
                <option value="">Bolsão</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
              <input
                type="text"
                placeholder="Data (dd/mm)..."
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className={`${filterDate ? chipActive : chipIdle} w-full placeholder:text-zinc-600`}
              />
            </div>

            <button
              onClick={() => setShowBottomSheet(false)}
              className="mt-2 w-full h-11 rounded-full bg-white text-zinc-900 text-sm font-semibold"
            >
              Ver {filtered.length} leads
            </button>
          </div>
        </div>
      )}

      {/* ── Count ────────────────────────────────────────────────────────── */}
      <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
        {filtered.length} leads{filtered.length > MAX_ROWS && ` (mostrando ${MAX_ROWS})`}
      </p>

      {/* ── MOBILE CARDS ─────────────────────────────────────────────────── */}
      <div className={`sm:hidden flex flex-col gap-2 transition-opacity ${loading ? 'opacity-40 pointer-events-none' : ''}`}>
        {displayed.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Nenhum lead encontrado.
          </p>
        ) : displayed.map((lead, idx) => {
          const id     = lead.idlead ?? lead.id;
          const sc     = getStatusColor(lead);
          const rawDate = lead.data_cad || lead.data_cadastro || lead.data_cadastramento;

          const hasComments = Array.isArray(lead.interacao) && lead.interacao.length > 0;
          const lastUpdate = lead.data_atualizacao || lead.data_cadastro || lead.data_cad || '';
          const daysIdle = lastUpdate ? Math.floor((Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24)) : 0;

          return (
            <div
              key={id ?? idx}
              onClick={() => setSelected(lead)}
              className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-1.5 cursor-pointer active:bg-white/10"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold truncate flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  {lead.nome || '-'}
                  {!hasComments && (
                    <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded px-1.5 py-0.5 shrink-0" title="Sem interações ou comentários do corretor">
                      💬 Sem coment.
                    </span>
                  )}
                </span>
                {lead.situacao?.nome && (
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: sc.bg, color: sc.text }}
                  >
                    {lead.situacao.nome}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span>{formatDate(toISODate(rawDate))}</span>
                <span>{getOrigin(lead)}</span>
                {lead.corretor?.nome && <span>{lead.corretor.nome}</span>}
                {lead.empreendimento?.[0]?.nome && <span>{lead.empreendimento[0].nome}</span>}
                {renderIdleBadge(daysIdle)}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── DESKTOP TABLE ────────────────────────────────────────────────── */}
      <div className={`hidden sm:block overflow-x-auto rounded-xl border border-white/10 transition-opacity ${loading ? 'opacity-40 pointer-events-none' : ''}`}>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              {['Nome', 'Tempo Parado', 'Cadastro', 'Origem', 'Etapa', 'Corretor', 'Gestor', 'Imobiliária', 'Empreendimento', 'Tags'].map((col) => (
                <th
                  key={col}
                  className="text-left px-3 py-2.5 font-semibold whitespace-nowrap"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map((lead, idx) => {
              const id     = lead.idlead ?? lead.id;
              const tags   = getLeadTags(lead);
              const sc     = getStatusColor(lead);
              const rawDate = lead.data_cad || lead.data_cadastro || lead.data_cadastramento;

               const hasComments = Array.isArray(lead.interacao) && lead.interacao.length > 0;
               const lastUpdate = lead.data_atualizacao || lead.data_cadastro || lead.data_cad || '';
               const daysIdle = lastUpdate ? Math.floor((Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24)) : 0;

               const RowContent = (
                <>
                  <td className="px-3 py-2 whitespace-nowrap font-medium max-w-[160px] truncate" style={{ color: 'var(--text-primary)' }}>
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{lead.nome || '-'}</span>
                      {!hasComments && (
                        <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded px-1.5 py-0.5 shrink-0" title="Sem interações ou comentários do corretor">
                          💬 Sem coment.
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {renderIdleBadge(daysIdle)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                    {formatDate(toISODate(rawDate))}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap max-w-[150px]" style={{ color: 'var(--text-secondary)' }}>
                    <div className="font-medium text-zinc-300 truncate" title={getOrigin(lead)}>{getOrigin(lead)}</div>
                    {lead.midia_principal && lead.midia_principal !== getOrigin(lead) && !/\{\{.*\}\}/.test(String(lead.midia_principal)) && (
                      <div className="text-[10px] text-zinc-500 truncate max-w-[140px]" title={String(lead.midia_principal)}>
                        Campanha: {String(lead.midia_principal)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {lead.situacao?.nome ? (
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ backgroundColor: sc.bg, color: sc.text }}
                      >
                        {lead.situacao.nome}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap max-w-[120px] truncate" style={{ color: 'var(--text-secondary)' }}>{lead.corretor?.nome || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap max-w-[120px] truncate" style={{ color: 'var(--text-secondary)' }}>{lead.gestor?.nome || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap max-w-[120px] truncate" style={{ color: 'var(--text-secondary)' }}>{lead.imobiliaria?.nome || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap max-w-[140px] truncate" style={{ color: 'var(--text-secondary)' }}>{lead.empreendimento?.[0]?.nome ?? '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="inline-block px-1.5 py-0.5 rounded text-[11px] bg-white/10" style={{ color: 'var(--text-secondary)' }}>
                          {tag}
                        </span>
                      ))}
                      {tags.length > 3 && (
                        <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>+{tags.length - 3}</span>
                      )}
                    </div>
                  </td>
                </>
              );

              return (
                <tr
                  key={id ?? idx}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => setSelected(lead)}
                >
                  {RowContent}
                </tr>
              );
            })}
            {displayed.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Nenhum lead encontrado com os filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── PAGINAÇÃO ── */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mt-2 p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md">
        <div className="text-xs text-zinc-400">
          Mostrando <span className="text-white font-semibold">{total > 0 ? (page - 1) * limit + 1 : 0}</span> a <span className="text-white font-semibold">{Math.min(page * limit, total)}</span> de <span className="text-white font-semibold">{total}</span> leads
        </div>

        <div className="flex gap-2 items-center">
          <button
            onClick={() => onPageChange(page - 1, limit, localRange, filterNome || undefined)}
            disabled={page === 1 || loading}
            className={`px-4 h-9 rounded-full text-xs font-semibold border border-white/12 transition-all ${
              page === 1 || loading
                ? 'opacity-40 cursor-not-allowed bg-transparent text-zinc-500'
                : 'bg-white/[0.03] text-white hover:bg-white/10 active:scale-95'
            }`}
          >
            Anterior
          </button>

          <span className="text-xs text-zinc-400 px-2">
            Página <span className="text-white font-semibold">{page}</span> de <span className="text-white font-semibold">{Math.ceil(total / limit) || 1}</span>
          </span>

          <button
            onClick={() => onPageChange(page + 1, limit, localRange, filterNome || undefined)}
            disabled={page * limit >= total || loading}
            className={`px-4 h-9 rounded-full text-xs font-semibold border border-white/12 transition-all ${
              page * limit >= total || loading
                ? 'opacity-40 cursor-not-allowed bg-transparent text-zinc-500'
                : 'bg-white/[0.03] text-white hover:bg-white/10 active:scale-95'
            }`}
          >
            Próximo
          </button>
        </div>
      </div>

      {/* ── Drawer de detalhes do lead ───────────────────────────────────── */}
      <LeadDrawer lead={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
