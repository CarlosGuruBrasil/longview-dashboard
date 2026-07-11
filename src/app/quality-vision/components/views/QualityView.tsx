'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
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
}

interface InspetorStat {
  inspetor: string
  total: number
  aprovadas: number
  reprovadas: number
  taxaAprovacao: number
}

interface FilterOptions {
  obras: string[]
  status: string[]
  inspetores: string[]
  disciplinas: string[]
}

interface QualityData {
  kpis: KpiData
  inspecoesPorDisciplina: Record<string, number>
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
const TICK_COLOR  = '#71717a'
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

// Gauge simples em SVG
function Gauge({ value, max = 100, color = '#10b981' }: { value: number; max?: number; color?: string }) {
  const pctVal = Math.min(value / max, 1)
  const r = 36
  const cx = 50; const cy = 50
  const startAngle = -210 * (Math.PI / 180)
  const endAngle   = 30  * (Math.PI / 180)
  const totalAngle = endAngle - startAngle
  const fillAngle  = startAngle + totalAngle * pctVal

  const arc = (angle: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  })

  const trackStart = arc(startAngle)
  const trackEnd   = arc(endAngle)
  const fillEnd    = arc(fillAngle)

  const trackPath = `M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 1 1 ${trackEnd.x} ${trackEnd.y}`
  const fillPath  = pctVal > 0
    ? `M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 ${pctVal > 0.5 ? 1 : 0} 1 ${fillEnd.x} ${fillEnd.y}`
    : ''

  return (
    <svg viewBox="0 0 100 80" className="w-28 h-20 mx-auto">
      <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinecap="round" />
      {fillPath && (
        <path d={fillPath} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />
      )}
      <text x="50" y="58" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
        {value.toFixed(1)}%
      </text>
    </svg>
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
  const [inspetorSearch, setInspetorSearch] = useState('')
  const [inspSort, setInspSort] = useState<SortState<keyof InspetorStat>>({ key: 'total', dir: 'desc' })
  const [recentSort, setRecentSort] = useState<SortState<keyof UltimaInspecao>>({ key: 'data', dir: 'desc' })
  const [recentRows, setRecentRows] = useState<UltimaInspecao[]>([])
  const [hasMoreRecent, setHasMoreRecent] = useState(false)
  const [totalRecent, setTotalRecent] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedInspId, setSelectedInspId] = useState<number | null>(null)

  const queryString = useMemo(() => {
    const p = new URLSearchParams({ startDate, endDate })
    if (filters.obra) p.set('obra', filters.obra)
    if (filters.status) p.set('status', filters.status)
    if (filters.inspetor) p.set('inspetor', filters.inspetor)
    if (filters.disciplina) p.set('disciplina', filters.disciplina)
    if (codeSearch.trim()) p.set('code', codeSearch.trim())
    return p.toString()
  }, [startDate, endDate, filters, codeSearch])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const r = await fetch(`/api/construpoint?${queryString}`)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const d = await r.json() as QualityData
        setData(d)
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
      const r = await fetch(`/api/construpoint?${queryString}&offset=${recentRows.length}`)
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

  // Dados para gráfico de barras por disciplina
  const disciplinaBarData = useMemo(() => {
    if (!data) return []
    return Object.entries(data.inspecoesPorDisciplina)
      .map(([key, value]) => ({ name: key, value }))
      .sort((a, b) => b.value - a.value)
  }, [data])

  // Dados para pie de resultado
  const pieData = useMemo(() => {
    if (!data) return []
    const { aprovadas = 0, reprovadas = 0, naoAplica = 0 } = data.kpis || {}
    return [
      { name: 'Aprovadas',     value: aprovadas,  color: APROVADA_COLOR  },
      { name: 'Reprovadas',    value: reprovadas, color: REPROVADA_COLOR },
      { name: 'Não se aplica', value: naoAplica,  color: NAOAPLICA_COLOR },
    ].filter(d => d.value > 0)
  }, [data])

  // Status das inspeções (pipeline operacional)
  const statusData = useMemo(() => {
    if (!data) return []
    const totalStatus = Object.values(data.statusBreakdown).reduce((s, n) => s + n, 0)
    return Object.entries(data.statusBreakdown)
      .map(([key, value]) => ({ name: key, value, pct: pct(value, totalStatus) }))
      .sort((a, b) => b.value - a.value)
  }, [data])

  const porInspetorSorted = useMemo(() => {
    if (!data) return []
    const filtered = inspetorSearch.trim()
      ? data.porInspetor.filter(i => i.inspetor.toLowerCase().includes(inspetorSearch.trim().toLowerCase()))
      : data.porInspetor
    return sortRows(filtered, inspSort.key, inspSort.dir)
  }, [data, inspetorSearch, inspSort])

  const ultimasInspecoesSorted = useMemo(() => {
    return sortRows(recentRows, recentSort.key, recentSort.dir)
  }, [recentRows, recentSort])

  function toggleInspSort(key: keyof InspetorStat) {
    setInspSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
  }
  function toggleRecentSort(key: keyof UltimaInspecao) {
    setRecentSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12" style={{ minHeight: '60vh' }}>
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-[#1E1E22]" />
          <div className="absolute inset-0 rounded-full border-2 border-t-emerald-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        </div>
        <p className="text-sm text-zinc-400">Buscando dados Construpoint…</p>
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
          onClick={() => { setLoading(true); setError(null); fetch(`/api/construpoint?${queryString}`).then(r=>r.json()).then(setData).catch(e => { logger.error({ err: e }, '[QualityView] retry fetch falhou'); setError(e.message); }).finally(()=>setLoading(false)) }}
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

  return (
    <div className="w-full space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
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

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={ClipboardCheck}
          label="Total de Inspeções"
          value={safeKpis.totalInspections.toLocaleString('pt-BR')}
          sub={`${formatDate(startDate)} – ${formatDate(endDate)}`}
          color="#0ea5e9"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Taxa de Aprovação"
          value={`${safeKpis.taxaAprovacao}%`}
          sub={`${safeKpis.aprovadas.toLocaleString('pt-BR')} aprovadas de ${totalVerifStr}`}
          color="#10b981"
        />
        <KpiCard
          icon={XCircle}
          label="Taxa de Reprovação"
          value={`${safeKpis.taxaReprovacao}%`}
          sub={`${safeKpis.reprovadas.toLocaleString('pt-BR')} reprovadas`}
          color="#f43f5e"
        />
        <KpiCard
          icon={TrendingUp}
          label="Verificações Totais"
          value={totalVerifStr}
          sub={`${safeKpis.naoAplica.toLocaleString('pt-BR')} não se aplica`}
          color="#a855f7"
        />
      </div>

      {/* Gauges de aprovação */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <GlassCard className="flex flex-col items-center">
          <p className="text-xs text-zinc-500 mb-2">Aprovação Geral</p>
          <Gauge value={safeKpis.taxaAprovacao} color="#10b981" />
          <p className="text-[11px] text-zinc-600 mt-1">{safeKpis.aprovadas} aprovadas</p>
        </GlassCard>
        <GlassCard className="flex flex-col items-center">
          <p className="text-xs text-zinc-500 mb-2">Reprovação</p>
          <Gauge value={safeKpis.taxaReprovacao} color="#f43f5e" />
          <p className="text-[11px] text-zinc-600 mt-1">{safeKpis.reprovadas} reprovadas</p>
        </GlassCard>
        <GlassCard className="flex flex-col items-center col-span-2 sm:col-span-1">
          <p className="text-xs text-zinc-500 mb-2">Não se Aplica</p>
          <Gauge
            value={pct(safeKpis.naoAplica, safeKpis.totalVerificacoes)}
            color="#64748b"
          />
          <p className="text-[11px] text-zinc-600 mt-1">{safeKpis.naoAplica} itens</p>
        </GlassCard>
      </div>

      {/* Status do pipeline de inspeção — "está tudo bem?" */}
      <GlassCard title="Status das Inspeções (pipeline operacional)">
        {statusData.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-zinc-600 text-sm">Sem inspeções no período</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {statusData.map(s => (
              <div key={s.name} className="rounded-lg border border-[#1E1E22] bg-[#0d0d0f] p-3">
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

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Inspeções por disciplina */}
        <GlassCard title="Inspeções por Disciplina">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={disciplinaBarData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis dataKey="name" type="category" tick={{ fill: TICK_COLOR, fontSize: 10 }} axisLine={false} tickLine={false} width={150} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Inspeções" radius={[0, 4, 4, 0]}>
                {disciplinaBarData.map((entry, i) => (
                  <Cell key={i} fill={disciplinaColor(i)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Resultado (pie) */}
        <GlassCard title="Resultado das Verificações">
          {pieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => [`${Number(v).toLocaleString('pt-BR')}`, '']}
                    contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-3 pr-4">
                {pieData.map(d => (
                  <div key={d.name}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-[11px] text-zinc-400">{d.name}</span>
                    </div>
                    <p className="text-base font-bold text-zinc-100 pl-4">{d.value.toLocaleString('pt-BR')}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">Sem dados de verificações</div>
          )}
        </GlassCard>
      </div>

      {/* Série histórica mensal */}
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-zinc-300">Série Histórica — Inspeções por Mês</h3>
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
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={serieMensal} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="label" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: TICK_COLOR }} formatter={v => <span style={{ color: '#a1a1aa' }}>{v}</span>} />
            {chartMode === 'volume' ? (
              <Line type="monotone" dataKey="total" name="Inspeções" stroke="#0ea5e9" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            ) : (
              <>
                <Line type="monotone" dataKey="aprovadas"  name="Aprovadas"     stroke={APROVADA_COLOR}  strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="reprovadas" name="Reprovadas"     stroke={REPROVADA_COLOR} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="naoAplica"  name="Não se aplica" stroke={NAOAPLICA_COLOR}  strokeWidth={2} dot={false} />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </GlassCard>

      {/* Por inspetor — o que cada um está tratando */}
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold text-zinc-300">Por Inspetor</h3>
            <span className="text-[11px] text-zinc-500">
              {porInspetorSorted.length.toLocaleString('pt-BR')} inspetores — sem paginação, mostra todos
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#1E1E22] bg-[#18181B] px-2.5 h-8">
            <Search size={12} className="text-zinc-600" />
            <input
              value={inspetorSearch}
              onChange={e => setInspetorSearch(e.target.value)}
              placeholder="Buscar inspetor…"
              className="bg-transparent text-xs text-zinc-300 outline-none placeholder:text-zinc-600 w-40"
            />
          </div>
        </div>
        {porInspetorSorted.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-zinc-600 text-sm">Nenhum inspetor encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1C1C1E]">
                  <SortTh label="Inspetor" sortKey="inspetor" sort={inspSort} onSort={toggleInspSort} />
                  <SortTh label="Verificações" sortKey="total" sort={inspSort} onSort={toggleInspSort} />
                  <SortTh label="Aprovadas" sortKey="aprovadas" sort={inspSort} onSort={toggleInspSort} />
                  <SortTh label="Reprovadas" sortKey="reprovadas" sort={inspSort} onSort={toggleInspSort} />
                  <SortTh label="Taxa de Aprovação" sortKey="taxaAprovacao" sort={inspSort} onSort={toggleInspSort} />
                </tr>
              </thead>
              <tbody>
                {porInspetorSorted.map(insp => (
                  <tr key={insp.inspetor} className="border-b border-[#1C1C1E] hover:bg-[#17171A] transition">
                    <td className="py-2.5 px-3 text-zinc-200 font-medium flex items-center gap-2">
                      <Users size={12} className="text-zinc-600" />
                      {insp.inspetor}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400">{insp.total.toLocaleString('pt-BR')}</td>
                    <td className="py-2.5 px-3 text-emerald-400">{insp.aprovadas.toLocaleString('pt-BR')}</td>
                    <td className="py-2.5 px-3 text-red-400">{insp.reprovadas.toLocaleString('pt-BR')}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-[#1E1E22] overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${insp.taxaAprovacao}%` }} />
                        </div>
                        <span className="text-zinc-300 font-semibold">{insp.taxaAprovacao}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

      <InspecaoDetailModal id={selectedInspId} onClose={() => setSelectedInspId(null)} />
    </div>
  )
}
