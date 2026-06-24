'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  ClipboardCheck, CheckCircle2, XCircle, AlertCircle,
  TrendingUp, RefreshCw, Calendar,
} from 'lucide-react'

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
  nota?: number
}

interface QualidadeData {
  kpis: KpiData
  inspecoesPorTipo: Record<string, number>
  serieMensal: MonthlyPoint[]
  ultimasInspecoes: UltimaInspecao[]
  meta: { startYear: number; endYear: number }
}

// ---------- cores ----------
const TICK_COLOR  = '#71717a'
const GRID_COLOR  = 'rgba(255,255,255,0.05)'
const COLORS_TIPO = {
  FVS: '#0ea5e9',
  FVM: '#a855f7',
  CHK: '#f59e0b',
  SEG: '#f43f5e',
  MA:  '#10b981',
  EDU: '#64748b',
}
const APROVADA_COLOR   = '#10b981'
const REPROVADA_COLOR  = '#f43f5e'
const NAOAPLICA_COLOR  = '#64748b'

// ---------- utilitários ----------
function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 10) / 10 : 0
}

function formatDate(d?: string) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function statusColor(nota?: number) {
  if (nota == null) return 'text-zinc-500'
  if (nota >= 80) return 'text-emerald-400'
  if (nota >= 60) return 'text-amber-400'
  return 'text-red-400'
}

// ---------- subcomponentes ----------
function GlassCard({ title, children, className = '' }: {
  title?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur p-5 ${className}`}>
      {title && <h3 className="text-sm font-semibold text-zinc-300 mb-4">{title}</h3>}
      {children}
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur p-4">
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
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs min-w-[140px]">
      <p className="text-zinc-300 font-semibold mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="mb-1">
          {p.name}: <strong className="text-zinc-100">{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

// ---------- main ----------
export default function QualidadeView() {
  const currentYear = new Date().getFullYear()
  const [startYear, setStartYear] = useState(currentYear - 1)
  const [endYear,   setEndYear]   = useState(currentYear)
  const [data,      setData]      = useState<QualidadeData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [chartMode, setChartMode] = useState<'volume' | 'resultado'>('volume')

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/construpoint?startYear=${startYear}&endYear=${endYear}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d: QualidadeData) => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [startYear, endYear])

  // Dados para gráfico de barras por tipo de ficha
  const tipoBarData = useMemo(() => {
    if (!data) return []
    return Object.entries(data.inspecoesPorTipo)
      .map(([key, value]) => ({ name: key, value }))
      .sort((a, b) => b.value - a.value)
  }, [data])

  // Dados para pie de resultado
  const pieData = useMemo(() => {
    if (!data) return []
    const { aprovadas, reprovadas, naoAplica } = data.kpis
    return [
      { name: 'Aprovadas',     value: aprovadas,  color: APROVADA_COLOR  },
      { name: 'Reprovadas',    value: reprovadas, color: REPROVADA_COLOR },
      { name: 'Não se aplica', value: naoAplica,  color: NAOAPLICA_COLOR },
    ].filter(d => d.value > 0)
  }, [data])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12" style={{ minHeight: '60vh' }}>
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
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
          onClick={() => { setLoading(true); setError(null); fetch(`/api/construpoint?startYear=${startYear}&endYear=${endYear}`).then(r=>r.json()).then(setData).catch(e=>setError(e.message)).finally(()=>setLoading(false)) }}
          className="mt-2 px-4 py-2 text-xs rounded-lg bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 transition flex items-center gap-2"
        >
          <RefreshCw size={12} /> Tentar novamente
        </button>
      </div>
    )
  }

  if (!data) return null

  const { kpis, serieMensal, ultimasInspecoes } = data
  const totalVerifStr = kpis.totalVerificacoes.toLocaleString('pt-BR')

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-100">Quality Vision</h1>
          <p className="text-xs text-zinc-500">Construpoint — Inspeções e Verificações</p>
        </div>
        {/* Filtro de período */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
          <Calendar size={14} className="text-zinc-500" />
          <select
            value={startYear}
            onChange={e => setStartYear(Number(e.target.value))}
            className="bg-transparent text-xs text-zinc-300 outline-none"
          >
            {[currentYear - 2, currentYear - 1, currentYear].map(y => (
              <option key={y} value={y} className="bg-zinc-900">{y}</option>
            ))}
          </select>
          <span className="text-zinc-600 text-xs">→</span>
          <select
            value={endYear}
            onChange={e => setEndYear(Number(e.target.value))}
            className="bg-transparent text-xs text-zinc-300 outline-none"
          >
            {[currentYear - 1, currentYear].map(y => (
              <option key={y} value={y} className="bg-zinc-900">{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={ClipboardCheck}
          label="Total de Inspeções"
          value={kpis.totalInspections.toLocaleString('pt-BR')}
          sub={`${startYear}–${endYear}`}
          color="#0ea5e9"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Taxa de Aprovação"
          value={`${kpis.taxaAprovacao}%`}
          sub={`${kpis.aprovadas.toLocaleString('pt-BR')} aprovadas de ${totalVerifStr}`}
          color="#10b981"
        />
        <KpiCard
          icon={XCircle}
          label="Taxa de Reprovação"
          value={`${kpis.taxaReprovacao}%`}
          sub={`${kpis.reprovadas.toLocaleString('pt-BR')} reprovadas`}
          color="#f43f5e"
        />
        <KpiCard
          icon={TrendingUp}
          label="Verificações Totais"
          value={totalVerifStr}
          sub={`${kpis.naoAplica.toLocaleString('pt-BR')} não se aplica`}
          color="#a855f7"
        />
      </div>

      {/* Gauges de aprovação */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <GlassCard className="flex flex-col items-center">
          <p className="text-xs text-zinc-500 mb-2">Aprovação Geral</p>
          <Gauge value={kpis.taxaAprovacao} color="#10b981" />
          <p className="text-[11px] text-zinc-600 mt-1">{kpis.aprovadas} aprovadas</p>
        </GlassCard>
        <GlassCard className="flex flex-col items-center">
          <p className="text-xs text-zinc-500 mb-2">Reprovação</p>
          <Gauge value={kpis.taxaReprovacao} color="#f43f5e" />
          <p className="text-[11px] text-zinc-600 mt-1">{kpis.reprovadas} reprovadas</p>
        </GlassCard>
        <GlassCard className="flex flex-col items-center col-span-2 sm:col-span-1">
          <p className="text-xs text-zinc-500 mb-2">Não se Aplica</p>
          <Gauge
            value={pct(kpis.naoAplica, kpis.totalVerificacoes)}
            color="#64748b"
          />
          <p className="text-[11px] text-zinc-600 mt-1">{kpis.naoAplica} itens</p>
        </GlassCard>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Inspeções por tipo de ficha */}
        <GlassCard title="Inspeções por Tipo de Ficha">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={tipoBarData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="name" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Inspeções" radius={[4, 4, 0, 0]}>
                {tipoBarData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={COLORS_TIPO[entry.name as keyof typeof COLORS_TIPO] ?? '#64748b'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Legenda de tipos */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-white/5">
            {Object.entries(COLORS_TIPO).map(([k, c]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
                <span className="text-[10px] text-zinc-500">{k}</span>
              </div>
            ))}
          </div>
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
          <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
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

      {/* Últimas inspeções */}
      <GlassCard title="Inspeções Recentes">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.07]">
                {['Código', 'Modelo', 'Obra', 'Inspetor', 'Data', 'Status', 'Nota'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-zinc-500 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ultimasInspecoes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-600">Sem inspeções no período</td>
                </tr>
              ) : (
                ultimasInspecoes.map((insp, i) => (
                  <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition">
                    <td className="py-2.5 px-3 text-zinc-400 font-mono">{insp.code ?? '-'}</td>
                    <td className="py-2.5 px-3 text-zinc-300">{insp.modelo ?? '-'}</td>
                    <td className="py-2.5 px-3 text-zinc-400 truncate max-w-[160px]">{insp.obra ?? '-'}</td>
                    <td className="py-2.5 px-3 text-zinc-400">{insp.inspetor ?? '-'}</td>
                    <td className="py-2.5 px-3 text-zinc-400 whitespace-nowrap">{formatDate(insp.data)}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-zinc-400">
                        {insp.status ?? '-'}
                      </span>
                    </td>
                    <td className={`py-2.5 px-3 font-semibold ${statusColor(insp.nota)}`}>
                      {insp.nota != null ? `${insp.nota.toFixed(1)}%` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}
