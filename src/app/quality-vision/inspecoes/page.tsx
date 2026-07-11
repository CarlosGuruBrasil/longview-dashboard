'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, Calendar, X, Search, ChevronUp, ChevronDown } from 'lucide-react'
import logger from '@/lib/logger'
import InspecaoDetailModal from '../components/InspecaoDetailModal'

interface UltimaInspecao {
  id: number
  code?: string
  modelo?: string
  obra?: string
  inspetor?: string
  status?: string
  data?: string
}

interface FilterOptions {
  obras: string[]
  status: string[]
  inspetores: string[]
  disciplinas: string[]
}

interface Filters {
  obra: string
  status: string
  inspetor: string
  disciplina: string
}

type SortDir = 'asc' | 'desc'
interface SortState { key: keyof UltimaInspecao; dir: SortDir }

const EMPTY_FILTERS: Filters = { obra: '', status: '', inspetor: '', disciplina: '' }

const STATUS_COLORS: Record<string, string> = {
  'Aceito': '#10b981',
  'Agendado': '#0ea5e9',
  'Em Andamento': '#f59e0b',
  'Recusado': '#f43f5e',
  'Pendente Aprovação': '#a855f7',
  'Pendente Reinspeção': '#ec4899',
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(d?: string) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function sortRows(rows: UltimaInspecao[], key: keyof UltimaInspecao, dir: SortDir): UltimaInspecao[] {
  return [...rows].sort((a, b) => {
    const av = a[key]; const bv = b[key]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    return dir === 'asc'
      ? String(av).localeCompare(String(bv), 'pt-BR')
      : String(bv).localeCompare(String(av), 'pt-BR')
  })
}

function SortTh({ label, sortKey, sort, onSort }: {
  label: string; sortKey: keyof UltimaInspecao; sort: SortState; onSort: (key: keyof UltimaInspecao) => void
}) {
  const active = sort.key === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`text-left py-3 px-4 font-medium whitespace-nowrap cursor-pointer select-none transition-colors ${active ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (sort.dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
      </span>
    </th>
  )
}

function InspecoesContent() {
  const searchParams = useSearchParams()
  const attention = searchParams.get('attention') ?? ''
  // Sem filtro de data por padrão — mostra o total real da base. O usuário restringe manualmente
  // pelos seletores quando quiser (essa é a tela de auditoria/lista completa, não um dashboard
  // de período fixo como o Dashboard e os Relatórios).
  const [startDate, setStartDate] = useState('')
  const [endDate,   setEndDate]   = useState('')
  const [filters,   setFilters]   = useState<Filters>(EMPTY_FILTERS)
  const [codeSearch, setCodeSearch] = useState('')
  const [inspecoes, setInspecoes] = useState<UltimaInspecao[]>([])
  const [filterOptions, setFilterOptions] = useState<FilterOptions>()
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [sort, setSort] = useState<SortState>({ key: 'data', dir: 'desc' })
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedInspId, setSelectedInspId] = useState<number | null>(null)

  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    if (startDate) p.set('startDate', startDate)
    if (endDate) p.set('endDate', endDate)
    if (filters.obra) p.set('obra', filters.obra)
    if (filters.status) p.set('status', filters.status)
    if (filters.inspetor) p.set('inspetor', filters.inspetor)
    if (filters.disciplina) p.set('disciplina', filters.disciplina)
    if (codeSearch.trim()) p.set('code', codeSearch.trim())
    if (attention) p.set('attention', attention)
    return p.toString()
  }, [startDate, endDate, filters, codeSearch, attention])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const r = await fetch(`/api/construpoint?${queryString}`)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const d = await r.json()
        setInspecoes(d.ultimasInspecoes || [])
        setHasMore(!!d.hasMoreInspecoes)
        setTotal(d.totalInspecoesFiltradas ?? 0)
        setFilterOptions(d.filterOptions)
      } catch (e) {
        logger.error({ err: e }, '[inspecoes] fetch dados falhou');
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }
    const t = setTimeout(load, codeSearch ? 300 : 0)
    return () => clearTimeout(t)
  }, [queryString, codeSearch])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const r = await fetch(`/api/construpoint?${queryString}&offset=${inspecoes.length}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      setInspecoes(prev => [...prev, ...(d.ultimasInspecoes || [])])
      setHasMore(!!d.hasMoreInspecoes)
    } catch (e) {
      logger.error({ err: e }, '[inspecoes] carregar mais falhou');
    } finally {
      setLoadingMore(false)
    }
  }

  const inspecoesSorted = useMemo(() => sortRows(inspecoes, sort.key, sort.dir), [inspecoes, sort])

  function toggleSort(key: keyof UltimaInspecao) {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
  }

  const hasFilters = !!filters.obra || !!filters.status || !!filters.inspetor || !!filters.disciplina
  const selectStyle = "h-9 px-3 text-[12px] rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 max-w-[190px] truncate cursor-pointer transition-all hover:bg-zinc-800/80 font-semibold"
  // Nas telas de atenção a lista já vem travada num subconjunto de status (Recusado/Pendente Reinspeção,
  // ou Agendado) — oferecer os outros no dropdown só levaria a combinações que sempre dão 0 resultado.
  const statusOptions = attention === 'nonconformity'
    ? ['Recusado', 'Pendente Reinspeção']
    : attention === 'overdue'
      ? ['Agendado']
      : filterOptions?.status ?? []

  return (
    <div className="w-full space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">
      {attention && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {attention === 'nonconformity'
            ? 'Atenção: inspeções recusadas ou aguardando reinspeção.'
            : 'Atenção: inspeções que continuam agendadas mais de 7 dias após a data prevista.'}
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-[#1E1E22] bg-[#121214]/60 px-3 py-2 shrink-0">
          <Calendar size={14} className="text-zinc-500" />
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">De</span>
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={e => setStartDate(e.target.value)}
            className="bg-transparent text-xs text-zinc-300 outline-none [color-scheme:dark]"
          />
          <span className="text-zinc-600 text-xs">–</span>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Até</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={todayIso()}
            onChange={e => setEndDate(e.target.value)}
            className="bg-transparent text-xs text-zinc-300 outline-none [color-scheme:dark]"
          />
        </div>

        <div className="flex-1 flex items-center flex-wrap gap-2.5 bg-white/[0.01] border border-white/5 p-3 rounded-2xl min-w-0">
          <select value={filters.obra} onChange={e => setFilters({ ...filters, obra: e.target.value })} className={selectStyle}>
            <option value="">Empreendimento: todos</option>
            {filterOptions?.obras.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={filters.disciplina} onChange={e => setFilters({ ...filters, disciplina: e.target.value })} className={selectStyle}>
            <option value="">Disciplina: todas</option>
            {filterOptions?.disciplinas.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className={selectStyle}>
            <option value="">Status: todos</option>
            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.inspetor} onChange={e => setFilters({ ...filters, inspetor: e.target.value })} className={selectStyle}>
            <option value="">Inspetor: todos</option>
            {filterOptions?.inspetores.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900 px-3 h-9">
            <Search size={12} className="text-zinc-600" />
            <input
              value={codeSearch}
              onChange={e => setCodeSearch(e.target.value)}
              placeholder="Buscar código…"
              className="bg-transparent text-xs text-zinc-300 outline-none placeholder:text-zinc-600 w-32 font-mono"
            />
          </div>
          {hasFilters && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="flex items-center gap-1.5 px-3.5 h-9 rounded-xl text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors font-bold border border-red-500/10"
            >
              <X size={12} />
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 p-12" style={{ minHeight: '60vh' }}>
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-[#1E1E22]" />
            <div className="absolute inset-0 rounded-full border-2 border-t-emerald-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
          <p className="text-sm text-zinc-400">Buscando dados de inspeções…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 p-12" style={{ minHeight: '60vh' }}>
          <AlertCircle className="text-red-400" size={32} />
          <p className="text-sm text-zinc-300 font-medium">Erro ao buscar dados</p>
          <p className="text-xs text-zinc-500">{error}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#1E1E22] bg-[#121214]/60 p-5">
          <p className="text-[11px] text-zinc-500 mb-3">
            Mostrando {inspecoes.length.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')}{' '}
            {attention === 'nonconformity'
              ? 'não conformidades (recusadas ou pendentes de reinspeção)'
              : attention === 'overdue'
                ? 'inspeções agendadas em atraso'
                : startDate || endDate
                  ? 'inspeções no período e filtros selecionados'
                  : 'inspeções no total (com os filtros aplicados)'}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1C1C1E]">
                  <SortTh label="Código" sortKey="code" sort={sort} onSort={toggleSort} />
                  <SortTh label="Modelo" sortKey="modelo" sort={sort} onSort={toggleSort} />
                  <SortTh label="Obra" sortKey="obra" sort={sort} onSort={toggleSort} />
                  <SortTh label="Inspetor" sortKey="inspetor" sort={sort} onSort={toggleSort} />
                  <SortTh label="Data" sortKey="data" sort={sort} onSort={toggleSort} />
                  <SortTh label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {inspecoesSorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-600">Sem inspeções no período selecionado.</td>
                  </tr>
                ) : (
                  inspecoesSorted.map((insp, i) => (
                    <tr
                      key={i}
                      onClick={() => setSelectedInspId(insp.id)}
                      className="border-b border-[#1C1C1E] hover:bg-[#17171A] transition cursor-pointer"
                    >
                      <td className="py-3 px-4 text-zinc-300 font-mono text-xs">{insp.code ?? '-'}</td>
                      <td className="py-3 px-4 text-zinc-200">{insp.modelo ?? '-'}</td>
                      <td className="py-3 px-4 text-zinc-400">{insp.obra ?? '-'}</td>
                      <td className="py-3 px-4 text-emerald-400/80 text-xs">{insp.inspetor ?? '-'}</td>
                      <td className="py-3 px-4 text-zinc-400 whitespace-nowrap text-xs">{formatDate(insp.data)}</td>
                      <td className="py-3 px-4">
                        <span
                          className="px-2.5 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-wider"
                          style={{
                            borderColor: `${STATUS_COLORS[insp.status ?? ''] ?? '#3f3f46'}40`,
                            background: `${STATUS_COLORS[insp.status ?? ''] ?? '#3f3f46'}15`,
                            color: STATUS_COLORS[insp.status ?? ''] ?? '#a1a1aa',
                          }}
                        >
                          {insp.status ?? '-'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="flex justify-center mt-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 text-xs rounded-lg bg-[#121214]/60 border border-[#1E1E22] text-zinc-300 hover:bg-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? 'Carregando…' : 'Carregar mais'}
              </button>
            </div>
          )}
        </div>
      )}
      <InspecaoDetailModal id={selectedInspId} onClose={() => setSelectedInspId(null)} />
    </div>
  )
}

export default function InspecoesPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center gap-4 p-12" style={{ minHeight: '60vh' }}>
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-[#1E1E22]" />
          <div className="absolute inset-0 rounded-full border-2 border-t-emerald-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        </div>
      </div>
    }>
      <InspecoesContent />
    </Suspense>
  )
}
