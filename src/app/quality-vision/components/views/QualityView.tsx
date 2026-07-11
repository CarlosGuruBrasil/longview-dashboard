'use client'

import { useState, useEffect, useMemo } from 'react'
import LogoLoader from '@/components/ui/LogoLoader'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  ClipboardCheck, CheckCircle2, XCircle, AlertCircle,
  TrendingUp, RefreshCw, X, Users, Search, ChevronUp, ChevronDown,
} from 'lucide-react'
import logger from '@/lib/logger'
import InspecaoDetailModal from '../InspecaoDetailModal'

// ---------- tipos ----------
interface KpiData {
  totalInspections: number
  taxaAprovacao: number
  taxaReprovacao: number
  totalVerificacoes: number
  aprovadas: number
  reprovadas: number
  naoAplica: number
}

interface MonthlyPoint {
  label: string
  year: number
  month: number
  total: number
  aprovadas: number
  reprovadas: number
  naoAplica: number
}

interface UltimaInspecao {
  id: number
  code?: string
  modelo?: string
  obra?: string
  inspetor?: string
  status?: string
  statusId?: number
  data?: string
  disciplina?: string
}

interface InspetorStat {
  inspetor: string
  total: number
  aprovadas: number
  reprovadas: number
  taxaAprovacao: number
  taxa: number
  statusCounts: Record<string, number>
  projetos?: { obra: string; statusCounts: Record<string, number> }[]
}

interface FilterOptions {
  obras: string[]
  status: string[]
  inspetores: string[]
  disciplinas: string[]
}

interface QualityData {
  kpis: KpiData
  inspecoesPorObra: Record<string, { total: number; statusCounts: Record<string, number> }>
  inspecoesPorDisciplina: Record<string, { total: number; [key: string]: number }>
  statusBreakdown: Record<string, number>
  porInspetor: InspetorStat[]
  serieMensal: MonthlyPoint[]
  ultimasInspecoes: UltimaInspecao[]
  hasMoreInspecoes: boolean
  totalInspecoesFiltradas: number
  filterOptions: FilterOptions
  meta: { startDate: string; endDate: string }
}

interface Filters {
  obra: string
  status: string
  inspetor: string
  disciplina: string
}

type SortDir = 'asc' | 'desc'
interface SortState<K extends string> { key: K; dir: SortDir }

const EMPTY_FILTERS: Filters = { obra: '', status: '', inspetor: '', disciplina: '' }

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}
function isoMinusYears(years: number) {
  const d = new Date()
  d.setFullYear(d.getFullYear() - years)
  return d.toISOString().slice(0, 10)
}

// ---------- cores ----------
const TICK_COLOR  = '#71717A'

const OBRA_COLORS = [
  '#0EA5E9', // azul
  '#10B981', // verde
  '#F59E0B', // laranja
  '#8B5CF6', // roxo
  '#EC4899', // rosa
  '#14B8A6', // teal
  '#F43F5E', // rose
  '#6366F1', // indigo
]
const GRID_COLOR  = 'rgba(255,255,255,0.05)'
// Paleta cíclica pras disciplinas reais (0-TERRENO...9-IMPERMEABILIZAÇÕES + Sem classificação)
const DISCIPLINA_PALETTE = ['#0ea5e9', '#a855f7', '#f59e0b', '#f43f5e', '#10b981', '#eab308', '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#64748b']
function disciplinaColor(index: number) {
  return DISCIPLINA_PALETTE[index % DISCIPLINA_PALETTE.length]
}
const APROVADA_COLOR   = '#10b981'
const REPROVADA_COLOR  = '#f43f5e'
const NAOAPLICA_COLOR  = '#64748b'
// Status do pipeline de inspeção (workflow), não confundir com resultado (Aprovado/Reprovado) da verificação
const STATUS_COLORS: Record<string, string> = {
  'Aceito': '#10b981',
  'Agendado': '#0ea5e9',
  'Em Andamento': '#f59e0b',
  'Recusado': '#f43f5e',
  'Pendente Aprovação': '#a855f7',
  'Pendente Reinspeção': '#ec4899',
}

// ---------- utilitários ----------
function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 1000) / 10 : 0
}

function formatDate(d?: string) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function sortRows<T>(rows: T[], key: keyof T, dir: SortDir): T[] {
  return [...rows].sort((a, b) => {
    const av = a[key]; const bv = b[key]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'number' && typeof bv === 'number') return dir === 'asc' ? av - bv : bv - av
    return dir === 'asc'
      ? String(av).localeCompare(String(bv), 'pt-BR')
      : String(bv).localeCompare(String(av), 'pt-BR')
  })
}

// ---------- subcomponentes ----------
function GlassCard({ title, children, className = '' }: {
  title?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`rounded-xl border border-[#1E1E22] bg-[#121214]/60 p-5 ${className}`}>
      {title && <h3 className="text-sm font-semibold text-zinc-300 mb-4">{title}</h3>}
      {children}
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div className="rounded-xl border border-[#1E1E22] bg-[#121214]/60 p-4">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-zinc-500 leading-tight">{label}</p>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon size={14} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-zinc-100">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  )
}



function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-[#1E1E22] bg-[#121214] p-3 text-xs min-w-[140px]">
      <p className="text-zinc-300 font-semibold mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="mb-1">
          {p.name}: <strong className="text-zinc-100">{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

// Cabeçalho de coluna clicável — ordena a tabela por essa coluna
function SortTh<K extends string>({ label, sortKey, sort, onSort }: {
  label: string; sortKey: K; sort: SortState<K>; onSort: (key: K) => void
}) {
  const active = sort.key === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`text-left py-2 px-3 font-medium whitespace-nowrap cursor-pointer select-none transition-colors ${active ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (sort.dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
      </span>
    </th>
  )
}

// ---------- filtros ----------
function FilterBar({ filters, setFilters, options }: {
  filters: Filters
  setFilters: (f: Filters) => void
  options?: FilterOptions
}) {
  const hasFilters = !!filters.obra || !!filters.status || !!filters.inspetor || !!filters.disciplina
  const selectStyle = "h-9 px-3 text-[12px] rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 max-w-[190px] truncate cursor-pointer transition-all hover:bg-zinc-800/80 font-semibold"

  return (
    <div className="flex items-center flex-wrap gap-2.5 bg-white/[0.01] border border-white/5 p-3 rounded-2xl w-full">
      <select
        value={filters.obra}
        onChange={e => setFilters({ ...filters, obra: e.target.value })}
        className={selectStyle}
      >
        <option value="">Empreendimento: todos</option>
        {options?.obras.map(o => <option key={o} value={o}>{o}</option>)}
      </select>

      <select
        value={filters.disciplina}
        onChange={e => setFilters({ ...filters, disciplina: e.target.value })}
        className={selectStyle}
      >
        <option value="">Disciplina: todas</option>
        {options?.disciplinas.map(d => <option key={d} value={d}>{d}</option>)}
      </select>

      <select
        value={filters.status}
        onChange={e => setFilters({ ...filters, status: e.target.value })}
        className={selectStyle}
      >
        <option value="">Status: todos</option>
        {options?.status.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      <select
        value={filters.inspetor}
        onChange={e => setFilters({ ...filters, inspetor: e.target.value })}
        className={selectStyle}
      >
        <option value="">Inspetor: todos</option>
        {options?.inspetores.map(i => <option key={i} value={i}>{i}</option>)}
      </select>

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
  )
}

// ---------- main ----------
export default function QualityView() {
  const [startDate, setStartDate] = useState(isoMinusYears(1))
  const [endDate,   setEndDate]   = useState(todayIso())
  const [filters,   setFilters]   = useState<Filters>(EMPTY_FILTERS)
  const [data,      setData]      = useState<QualityData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [chartMode, setChartMode] = useState<'volume' | 'resultado'>('volume')
  const [codeSearch, setCodeSearch] = useState('')
  const [inspSearch, setInspSearch] = useState('')
  const [recentSort, setRecentSort] = useState<SortState<keyof UltimaInspecao>>({ key: 'data', dir: 'desc' })
  const [recentRows, setRecentRows] = useState<UltimaInspecao[]>([])
  const [hasMoreRecent, setHasMoreRecent] = useState(false)
  const [totalRecent, setTotalRecent] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedInspId, setSelectedInspId] = useState<number | null>(null)
  const [selectedInspetor, setSelectedInspetor] = useState<InspetorStat | null>(null)
  const [modalData, setModalData] = useState<QualityData | null>(null)
  const [modalLoading, setModalLoading] = useState(false)

  const queryString = useMemo(() => {
    const p = new URLSearchParams({ startDate, endDate })
    if (filters.obra) p.set('obra', filters.obra)
    if (filters.status) p.set('status', filters.status)
    if (filters.inspetor) p.set('inspetor', filters.inspetor)
    if (filters.disciplina) p.set('disciplina', filters.disciplina)
    if (codeSearch.trim()) p.set('code', codeSearch.trim())
    p.set('_t', Date.now().toString()) // Desabilita cache de fetch do navegador/Next
    return p.toString()
  }, [startDate, endDate, filters, codeSearch])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const r = await fetch(`/api/construpoint?${queryString}`, { cache: 'no-store' })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const d = await r.json() as QualityData
        setData({
          ...d,
          porInspetor: d.porInspetor.map(i => ({ ...i, taxa: i.taxaAprovacao }))
        })
        setRecentRows(d.ultimasInspecoes)
        setHasMoreRecent(d.hasMoreInspecoes)
        setTotalRecent(d.totalInspecoesFiltradas)
      } catch (e) {
        logger.error({ err: e }, '[QualityView] fetch dados Construpoint falhou');
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }
    const t = setTimeout(load, codeSearch ? 300 : 0) // debounce só na busca por código
    return () => clearTimeout(t)
  }, [queryString, codeSearch])

  async function loadMoreRecent() {
    setLoadingMore(true)
    try {
      const r = await fetch(`/api/construpoint?${queryString}&offset=${recentRows.length}`, { cache: 'no-store' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json() as QualityData
      setRecentRows(prev => [...prev, ...d.ultimasInspecoes])
      setHasMoreRecent(d.hasMoreInspecoes)
    } catch (e) {
      logger.error({ err: e }, '[QualityView] carregar mais inspeções falhou');
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    if (selectedInspetor) {
      setModalLoading(true)
      const p = new URLSearchParams({ startDate, endDate })
      if (filters.obra) p.set('obra', filters.obra)
      p.set('inspetor', selectedInspetor.inspetor)
      if (filters.disciplina) p.set('disciplina', filters.disciplina)
      
      fetch(`/api/construpoint?${p.toString()}`, { cache: 'no-store' })
        .then(r => r.json())
        .then(setModalData)
        .catch(e => console.error(e))
        .finally(() => setModalLoading(false))
    } else {
      setModalData(null)
    }
  }, [selectedInspetor, startDate, endDate, filters])

  const seriesObras = useMemo(() => {
    const keys = new Set<string>()
    data?.serieMensal.forEach(d => {
      Object.keys(d).forEach(k => {
        if (k.startsWith('obra_')) keys.add(k.replace('obra_', ''))
      })
    })
    return Array.from(keys)
  }, [data?.serieMensal])

  const disciplinaBarData = useMemo(() => {
    if (!data) return []
    return Object.entries(data.inspecoesPorDisciplina)
      .map(([key, value]) => ({ name: key, value: value.total }))
      .sort((a, b) => b.value - a.value)
  }, [data])

  const pieData = useMemo(() => {
    if (!data) return []
    const { aprovadas = 0, reprovadas = 0, naoAplica = 0 } = data.kpis || {}
    return [
      { name: 'Aprovadas',     value: aprovadas,  color: APROVADA_COLOR  },
      { name: 'Reprovadas',    value: reprovadas, color: REPROVADA_COLOR },
      { name: 'Não se aplica', value: naoAplica,  color: NAOAPLICA_COLOR },
    ].filter(d => d.value > 0)
  }, [data])

  const statusData = useMemo(() => {
    if (!data) return []
    const totalStatus = Object.values(data.statusBreakdown).reduce((s, n) => s + n, 0)
    return Object.entries(data.statusBreakdown)
      .map(([key, value]) => ({ name: key, value, pct: pct(value, totalStatus) }))
      .sort((a, b) => b.value - a.value)
  }, [data])

  const inspetoresData = useMemo(() => data?.porInspetor || [], [data])
  const filteredInspetores = useMemo(() => inspetoresData.filter(i => i.inspetor.toLowerCase().includes(inspSearch.toLowerCase())), [inspetoresData, inspSearch])

  const ultimasInspecoesSorted = useMemo(() => {
    return sortRows(recentRows, recentSort.key, recentSort.dir)
  }, [recentRows, recentSort])

  function toggleRecentSort(key: keyof UltimaInspecao) {
    setRecentSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-12" style={{ minHeight: '60vh' }}>
        <LogoLoader module="quality" text="Buscando dados Construpoint..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12" style={{ minHeight: '60vh' }}>
        <AlertCircle className="text-red-400" size={32} />
        <p className="text-sm text-zinc-300 font-medium">Erro ao buscar dados Construpoint</p>
        <p className="text-xs text-zinc-500">{error}</p>
        <button
          onClick={() => { setLoading(true); setError(null); fetch(`/api/construpoint?${queryString}`, { cache: 'no-store' }).then(r=>r.json()).then(setData).catch(e => { logger.error({ err: e }, '[QualityView] retry fetch falhou'); setError(e.message); }).finally(()=>setLoading(false)) }}
          className="mt-2 px-4 py-2 text-xs rounded-lg bg-[#121214]/60 border border-[#1E1E22] text-zinc-300 hover:bg-white/10 transition flex items-center gap-2"
        >
          <RefreshCw size={12} /> Tentar novamente
        </button>
      </div>
    )
  }

  if (!data) return null

  const { kpis, serieMensal, filterOptions } = data

  const safeKpis = {
    totalInspections: Number(kpis?.totalInspections || 0),
    taxaAprovacao: Number(kpis?.taxaAprovacao || 0),
    taxaReprovacao: Number(kpis?.taxaReprovacao || 0),
    totalVerificacoes: Number(kpis?.totalVerificacoes || 0),
    aprovadas: Number(kpis?.aprovadas || 0),
    reprovadas: Number(kpis?.reprovadas || 0),
    naoAplica: Number(kpis?.naoAplica || 0),
  }

  const totalVerifStr = safeKpis.totalVerificacoes.toLocaleString('pt-BR')

  const fvsMapeadas = safeKpis.totalInspections || 0;
  const fvsRealizadas = data?.statusBreakdown['Aceito'] || 0;
  const pctRealizada = fvsMapeadas > 0 ? ((fvsRealizadas / fvsMapeadas) * 100).toFixed(1) : '0.0';

  return (
    <div className="w-full space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">
      <div className="sticky top-0 z-20 bg-[#0d0d0f]/90 backdrop-blur-md pt-2 pb-4 -mt-2 flex flex-col lg:flex-row lg:items-center gap-3 border-b border-[#1E1E22]/50">
        <div className="flex items-center gap-2 rounded-xl border border-[#1E1E22] bg-[#121214]/60 px-3 py-2 shrink-0">
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
        <div className="flex-1 min-w-0">
          <FilterBar filters={filters} setFilters={setFilters} options={filterOptions} />
        </div>
      </div>

      <div className="relative min-h-[50vh]">
        {loading && data && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0d0d0f]/60 backdrop-blur-[2px] rounded-xl transition-all duration-300">
            <div className="relative w-12 h-12 mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-[#1E1E22]" />
              <div className="absolute inset-0 rounded-full border-2 border-t-emerald-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            </div>
            <p className="text-sm text-zinc-400 font-medium">Atualizando painel...</p>
          </div>
        )}

        <div className={`space-y-6 transition-opacity duration-300 ${loading && data ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          icon={CheckCircle2}
          label="FVS Realizadas"
          value={fvsRealizadas.toLocaleString('pt-BR')}
          sub="Inspeções com status 'Aceito'"
          color="#10b981"
        />
        <KpiCard
          icon={ClipboardCheck}
          label="FVS Mapeadas"
          value={fvsMapeadas.toLocaleString('pt-BR')}
          sub={`${formatDate(startDate)} – ${formatDate(endDate)}`}
          color="#0ea5e9"
        />
        <KpiCard
          icon={TrendingUp}
          label="% Realizada"
          value={`${pctRealizada.replace('.', ',')}%`}
          sub="Taxa de conclusão"
          color="#f59e0b"
        />
      </div>

      <GlassCard title="Status das Inspeções (pipeline operacional)">
        {statusData.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-zinc-600 text-sm">Sem inspeções no período</div>
        ) : (
          <div className="flex flex-wrap md:flex-nowrap gap-3 overflow-x-auto pb-1">
            {statusData.map(s => (
              <div key={s.name} className="flex-1 min-w-[130px] rounded-lg border border-[#1E1E22] bg-[#0d0d0f] p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLORS[s.name] ?? '#64748b' }} />
                  <span className="text-[10px] text-zinc-500 truncate">{s.name}</span>
                </div>
                <p className="text-lg font-bold text-zinc-100">{s.value.toLocaleString('pt-BR')}</p>
                <p className="text-[10px] text-zinc-600">{s.pct}%</p>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GlassCard title="Inspeções por Disciplina">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={disciplinaBarData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis dataKey="name" type="category" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} width={250} interval={0} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Inspeções" radius={[0, 4, 4, 0]}>
                {disciplinaBarData.map((entry, i) => (
                  <Cell key={i} fill={disciplinaColor(i)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard title="Resultado das Verificações">
          {pieData.length > 0 ? (
            <div className="flex flex-col justify-center h-full gap-4 py-4">
              <div className="w-full h-8 rounded-full overflow-hidden flex bg-[#1E1E22]">
                {pieData.map(d => (
                  <div
                    key={d.name}
                    style={{
                      width: `${pct(d.value, safeKpis.totalVerificacoes)}%`,
                      backgroundColor: d.color
                    }}
                    className="h-full hover:brightness-110 transition-all cursor-pointer"
                    title={`${d.name}: ${d.value} (${pct(d.value, safeKpis.totalVerificacoes)}%)`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
                {pieData.map(d => (
                  <div key={d.name} className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-[11px] text-zinc-400">{d.name}</span>
                    </div>
                    <div className="flex items-baseline gap-2 pl-4">
                      <p className="text-xl font-bold text-zinc-100">{d.value.toLocaleString('pt-BR')}</p>
                      <p className="text-[10px] text-zinc-500 font-medium">{pct(d.value, safeKpis.totalVerificacoes)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">Sem dados de verificações</div>
          )}
        </GlassCard>
      </div>

      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-zinc-300">
            Série Histórica — Inspeções por Mês
            <span className="ml-2 text-zinc-500 font-normal">
              {filters.obra ? `(${filters.obra})` : '(Todos os empreendimentos)'}
            </span>
          </h3>
          <div className="flex gap-1 rounded-lg border border-[#1E1E22] bg-[#18181B] p-0.5">
            {(['volume', 'resultado'] as const).map(m => (
              <button
                key={m}
                onClick={() => setChartMode(m)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  chartMode === m ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {m === 'volume' ? 'Volume' : 'Resultado'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={serieMensal} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorAprovadas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={APROVADA_COLOR} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={APROVADA_COLOR} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorReprovadas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={REPROVADA_COLOR} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={REPROVADA_COLOR} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="label" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip 
                  cursor={{ stroke: '#3f3f46', strokeDasharray: '4 4' }}
                  contentStyle={{ backgroundColor: '#18181B', borderColor: '#27272A', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  itemStyle={{ fontSize: '13px', fontWeight: 500 }}
                  labelStyle={{ marginBottom: 4, color: '#A1A1AA' }}
                  formatter={(value: any, name: any) => {
                    if (typeof name === 'string' && name.startsWith('obra_')) {
                      return [value, name.replace('obra_', '')]
                    }
                    if (name === 'total') return [value, 'Total Inspeções']
                    return [value, name]
                  }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#A1A1AA', paddingTop: 10 }} />
            {chartMode === 'volume' ? (
                  seriesObras.length === 1 ? (
                    <Area
                      type="monotone"
                      dataKey={`obra_${seriesObras[0]}`}
                      name={seriesObras[0]}
                      stroke="#0EA5E9"
                      fillOpacity={1}
                      fill="url(#colorTotal)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#0EA5E9', strokeWidth: 2 }}
                      activeDot={{ r: 5, stroke: '#18181B', strokeWidth: 2 }}
                    />
                  ) : (
                    seriesObras.map((obra, i) => (
                      <Area
                        key={obra}
                        type="monotone"
                        dataKey={`obra_${obra}`}
                        name={obra}
                        stackId="1"
                        stroke={OBRA_COLORS[i % OBRA_COLORS.length]}
                        fill={OBRA_COLORS[i % OBRA_COLORS.length]}
                        fillOpacity={0.3}
                        strokeWidth={2}
                        activeDot={{ r: 5, stroke: '#18181B', strokeWidth: 2 }}
                      />
                    ))
                  )
                ) : (
              <>
                <Area type="monotone" dataKey="aprovadas"  name="Aprovadas"     stroke={APROVADA_COLOR}  strokeWidth={2} fillOpacity={1} fill="url(#colorAprovadas)" />
                <Area type="monotone" dataKey="reprovadas" name="Reprovadas"     stroke={REPROVADA_COLOR} strokeWidth={2} fillOpacity={1} fill="url(#colorReprovadas)" />
                <Line type="monotone" dataKey="naoAplica"  name="Não se aplica" stroke={NAOAPLICA_COLOR}  strokeWidth={2} dot={false} />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </GlassCard>

      {/* Por Inspetor — Grid de Cards */}
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h3 className="text-sm font-semibold text-zinc-300">
            Por Inspetor <span className="text-zinc-500 font-normal ml-2">{inspetoresData.length} inspetores no período</span>
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
            <input
              type="text"
              placeholder="Buscar inspetor..."
              value={inspSearch}
              onChange={e => setInspSearch(e.target.value)}
              className="bg-[#121214]/60 border border-[#1E1E22] rounded-lg pl-9 pr-4 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-500 transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredInspetores.map((insp) => {
            const isExcellent = insp.taxa >= 95
            const isWarning = insp.taxa >= 80 && insp.taxa < 95
            const colorClass = isExcellent ? 'text-emerald-400' : isWarning ? 'text-amber-400' : 'text-rose-400'
            const strokeColor = isExcellent ? '#34d399' : isWarning ? '#fbbf24' : '#fb7185'
            const offset = 125.6 - (125.6 * insp.taxa) / 100

            return (
              <div 
                key={insp.inspetor} 
                onClick={() => setSelectedInspetor(insp)}
                className="bg-[#121214] border border-[#1E1E22] hover:border-[#3f3f46] hover:bg-[#18181b] rounded-xl p-4 cursor-pointer transition-all flex flex-col"
              >
                <div className="flex items-start justify-between">
                  <h4 className="font-semibold text-zinc-200 text-sm line-clamp-2" title={insp.inspetor}>
                    {insp.inspetor}
                  </h4>
                </div>
                <div className="mt-3 mb-1">
                  <span className="text-zinc-500 font-semibold text-[10px] uppercase tracking-wider">Status Geral</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {Object.entries(insp.statusCounts || {}).sort((a,b)=>b[1]-a[1]).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-1 bg-[#1C1C1E] border border-[#27272A] px-1.5 py-0.5 rounded text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] || '#71717A' }} />
                      <span className="text-zinc-400">{status}:</span>
                      <span className="font-bold text-zinc-300">{count}</span>
                    </div>
                  ))}
                  {Object.keys(insp.statusCounts || {}).length === 0 && <span className="text-[10px] text-zinc-600">Sem status</span>}
                </div>

                {insp.projetos && insp.projetos.length > 0 && (
                  <div className="mt-1 mb-3 flex flex-col gap-1.5">
                    {insp.projetos.map(proj => (
                      <div key={proj.obra} className="flex flex-col gap-1.5 border-t border-[#1C1C1E] pt-2 mt-1">
                        <span className="text-zinc-300 font-medium text-xs">{proj.obra}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(proj.statusCounts).sort((a,b)=>b[1]-a[1]).map(([status, count]) => (
                            <div key={status} className="flex items-center gap-1 bg-[#1C1C1E] border border-[#27272A] px-1.5 py-0.5 rounded text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] || '#71717A' }} />
                              <span className="text-zinc-400">{status}:</span>
                              <span className="font-bold text-zinc-300">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex items-end justify-between mt-auto pt-2 border-t border-[#1C1C1E]">
                  <div>
                    <p className="text-xs text-zinc-500 mb-0.5">Total de Verificações</p>
                    <p className="text-lg font-medium text-zinc-300">{insp.total}</p>
                  </div>
                  <div className="relative w-12 h-12 flex items-center justify-center flex-col group">
                    <svg className="w-12 h-12 transform -rotate-90 absolute">
                      <circle cx="24" cy="24" r="20" stroke="#27272A" strokeWidth="4" fill="none" />
                      <circle 
                        cx="24" cy="24" r="20" 
                        stroke={strokeColor} 
                        strokeWidth="4" 
                        fill="none" 
                        strokeDasharray="125.6" 
                        strokeDashoffset={offset} 
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <span className={`absolute text-[10px] font-bold ${colorClass}`}>
                      {Math.round(insp.taxa)}%
                    </span>
                    <div className="absolute bottom-full right-0 mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-48 p-2 bg-zinc-800/95 backdrop-blur-sm border border-zinc-700/50 rounded-lg shadow-xl text-[10px] text-zinc-300 z-50 text-center leading-tight">
                      <strong>Taxa de Entrega:</strong><br/>
                      Proporção de inspeções "Aceitas" sobre o total de inspeções vinculadas.
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {filteredInspetores.length === 0 && (
            <div className="col-span-full py-8 text-center text-zinc-500 text-sm">
              Nenhum inspetor encontrado.
            </div>
          )}
        </div>
      </GlassCard>

      {/* Últimas inspeções */}
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold text-zinc-300">Inspeções Recentes</h3>
            <span className="text-[11px] text-zinc-500">
              Mostrando {recentRows.length.toLocaleString('pt-BR')} de {totalRecent.toLocaleString('pt-BR')} inspeções no período e filtros selecionados
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#1E1E22] bg-[#18181B] px-2.5 h-8">
            <Search size={12} className="text-zinc-600" />
            <input
              value={codeSearch}
              onChange={e => setCodeSearch(e.target.value)}
              placeholder="Buscar código…"
              className="bg-transparent text-xs text-zinc-300 outline-none placeholder:text-zinc-600 w-40 font-mono"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1C1C1E]">
                <SortTh label="Código" sortKey="code" sort={recentSort} onSort={toggleRecentSort} />
                <SortTh label="Modelo" sortKey="modelo" sort={recentSort} onSort={toggleRecentSort} />
                <SortTh label="Disciplina" sortKey="disciplina" sort={recentSort} onSort={toggleRecentSort} />
                <SortTh label="Obra" sortKey="obra" sort={recentSort} onSort={toggleRecentSort} />
                <SortTh label="Inspetor" sortKey="inspetor" sort={recentSort} onSort={toggleRecentSort} />
                <SortTh label="Data" sortKey="data" sort={recentSort} onSort={toggleRecentSort} />
                <SortTh label="Status" sortKey="status" sort={recentSort} onSort={toggleRecentSort} />
              </tr>
            </thead>
            <tbody>
              {ultimasInspecoesSorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-600">Sem inspeções no período</td>
                </tr>
              ) : (
                ultimasInspecoesSorted.map((insp, i) => (
                  <tr
                    key={i}
                    onClick={() => setSelectedInspId(insp.id)}
                    className="border-b border-[#1C1C1E] hover:bg-[#17171A] transition cursor-pointer"
                  >
                    <td className="py-2.5 px-3 text-zinc-400 font-mono">{insp.code ?? '-'}</td>
                    <td className="py-2.5 px-3 text-zinc-300">{insp.modelo ?? '-'}</td>
                    <td className="py-2.5 px-3 text-zinc-300 truncate max-w-[150px]">{insp.disciplina ?? 'Sem classificação'}</td>
                    <td className="py-2.5 px-3 text-zinc-400 truncate max-w-[160px]">{insp.obra ?? '-'}</td>
                    <td className="py-2.5 px-3 text-zinc-400">{insp.inspetor ?? '-'}</td>
                    <td className="py-2.5 px-3 text-zinc-400 whitespace-nowrap">{formatDate(insp.data)}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className="px-2 py-0.5 rounded-full border text-[10px] font-medium"
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
        {hasMoreRecent && (
          <div className="flex justify-center mt-4">
            <button
              onClick={loadMoreRecent}
              disabled={loadingMore}
              className="px-4 py-2 text-xs rounded-lg bg-[#121214]/60 border border-[#1E1E22] text-zinc-300 hover:bg-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMore ? 'Carregando…' : 'Carregar mais'}
            </button>
          </div>
        )}
      </GlassCard>

      {/* Modal de Detalhes do Inspetor */}
      {selectedInspetor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#18181B] border border-[#27272A] rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
            <button 
              onClick={() => setSelectedInspetor(null)} 
              className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-200 bg-[#121214] hover:bg-[#27272A] rounded-full transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            
            <h2 className="text-xl font-bold text-zinc-100 pr-8">{selectedInspetor.inspetor}</h2>
            <p className="text-sm text-zinc-500 mt-1">Desempenho no período selecionado</p>
            
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-[#121214] border border-[#1E1E22] p-3 rounded-xl flex flex-col items-center justify-center">
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Itens Aprovados</p>
                <p className="text-xl font-semibold text-emerald-400 mt-1">{selectedInspetor.aprovadas}</p>
              </div>
              <div className="bg-[#121214] border border-[#1E1E22] p-3 rounded-xl flex flex-col items-center justify-center">
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Itens Reprovados</p>
                <p className="text-xl font-semibold text-rose-400 mt-1">{selectedInspetor.reprovadas}</p>
              </div>
            </div>

            <div className="mt-4 bg-[#121214] border border-[#1E1E22] p-4 rounded-xl">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-zinc-400">Total de Verificações</span>
                <span className="font-semibold text-zinc-200">{selectedInspetor.total}</span>
              </div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-zinc-400">Taxa de Aprovação</span>
                <span className={`font-semibold ${selectedInspetor.taxa >= 95 ? 'text-emerald-400' : selectedInspetor.taxa >= 80 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {selectedInspetor.taxa.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full bg-[#1C1C1E] rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${selectedInspetor.taxa >= 95 ? 'bg-emerald-500' : selectedInspetor.taxa >= 80 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                  style={{ width: `${selectedInspetor.taxa}%` }} 
                />
              </div>
            </div>

            {/* Dados detalhados vinculados carregados via API */}
            <div className="mt-6 border-t border-[#27272A] pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-200">Detalhamento de Inspeções</h3>
                {modalData && (
                  <span className="text-zinc-500 text-xs">
                    {Object.values(modalData.inspecoesPorObra).reduce((a, b) => a + b.total, 0)} Inspeções Totais
                  </span>
                )}
              </div>
              
              {modalLoading ? (
                <div className="flex justify-center items-center py-8">
                  <RefreshCw className="animate-spin text-zinc-500" size={24} />
                </div>
              ) : modalData ? (
                <div className="space-y-6 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar">
                  

                  {/* Obras atuantes */}
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-3 font-semibold">Top Empreendimentos</p>
                    <div className="space-y-4">
                      {Object.entries(modalData.inspecoesPorObra).sort((a,b)=>b[1].total-a[1].total).slice(0, 5).map(([obra, data], i, arr) => {
                        const max = arr[0]?.[1].total || 1;
                        const pct = (data.total / max) * 100;
                        return (
                          <div key={obra} className="relative">
                            <div className="flex justify-between items-end mb-1.5">
                              <span className="text-xs font-medium text-zinc-300 truncate max-w-[200px]">{obra}</span>
                              <span className="text-xs font-mono text-zinc-400">{data.total}</span>
                            </div>
                            <div className="h-2 w-full bg-[#1C1C1E] rounded-full overflow-hidden flex">
                              {Object.entries(data.statusCounts).sort((a,b)=>b[1]-a[1]).map(([status, count]) => (
                                <div 
                                  key={status} 
                                  className="h-full" 
                                  style={{ 
                                    width: `${(count / data.total) * pct}%`, 
                                    backgroundColor: STATUS_COLORS[status] || '#71717A' 
                                  }} 
                                  title={`${status}: ${count}`}
                                />
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                              {Object.entries(data.statusCounts).sort((a,b)=>b[1]-a[1]).map(([status, count]) => (
                                <div key={status} className="flex items-center gap-1 text-[10px]">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] || '#71717A' }} />
                                  <span className="text-zinc-500">{status}:</span>
                                  <span className="text-zinc-300">{count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                      {Object.keys(modalData.inspecoesPorObra).length === 0 && <span className="text-xs text-zinc-600">Nenhum dado</span>}
                    </div>
                  </div>

                  {/* Disciplinas com barras de progresso horizontais */}
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-3 font-semibold">Top Disciplinas</p>
                    <div className="space-y-3">
                      {Object.entries(modalData.inspecoesPorDisciplina).sort((a,b)=>b[1].total-a[1].total).slice(0, 5).map(([disc, count], i, arr) => {
                        const pct = Math.max(15, (count.total / Math.max(...Object.values(modalData.inspecoesPorDisciplina).map(x=>x.total))) * 100);
                        return (
                          <div key={disc} className="relative">
                            <div className="flex justify-between items-end mb-1">
                              <span className="text-xs font-medium text-zinc-300 truncate max-w-[200px]">{disc}</span>
                              <div className="text-xs text-zinc-300 w-8 text-right font-medium">{count.total}</div>
                            </div>
                            <div className="h-1.5 w-full bg-[#1C1C1E] rounded-full overflow-hidden">
                              <div className="h-full bg-[#0EA5E9] rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                      {Object.keys(modalData.inspecoesPorDisciplina).length === 0 && <span className="text-xs text-zinc-600">Nenhum dado</span>}
                    </div>
                  </div>

                  {/* Últimas Inspeções Removidas a Pedido */}

                </div>
              ) : null}
            </div>
            
            <button 
              onClick={() => {
                setFilters({ ...filters, inspetor: selectedInspetor.inspetor })
                window.scrollTo({ top: 0, behavior: 'smooth' })
                setSelectedInspetor(null)
              }}
              className="w-full mt-4 bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-medium py-2.5 rounded-xl transition shadow-lg shadow-[#0EA5E9]/20 text-sm"
            >
              Aplicar como filtro principal
            </button>
          </div>
        </div>
      )}

      <InspecaoDetailModal id={selectedInspId} onClose={() => setSelectedInspId(null)} />
        </div>
      </div>
    </div>
  )
}
