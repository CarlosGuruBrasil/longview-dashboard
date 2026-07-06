'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { AlertCircle, Calendar } from 'lucide-react'
import logger from '@/lib/logger'

// ---------- tipos ----------
interface MonthlyPoint {
  label: string
  year: number
  month: number
  total: number
  aprovadas: number
  reprovadas: number
  naoAplica: number
}

interface QualityData {
  inspecoesPorTipo: Record<string, number>
  serieMensal: MonthlyPoint[]
  kpis: {
    aprovadas: number
    reprovadas: number
    naoAplica: number
  }
}

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

function GlassCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1E1E22] bg-[#121214]/60 p-5">
      {title && <h3 className="text-sm font-semibold text-zinc-300 mb-4">{title}</h3>}
      {children}
    </div>
  )
}

type TooltipPayload = { name?: string; value?: number | string; color?: string }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
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

export default function RelatoriosPage() {
  const currentYear = new Date().getFullYear()
  const [startYear, setStartYear] = useState(currentYear - 1)
  const [endYear,   setEndYear]   = useState(currentYear)
  const [data,      setData]      = useState<QualityData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const r = await fetch(`/api/construpoint?startYear=${startYear}&endYear=${endYear}`)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const d = await r.json() as QualityData
        setData(d)
      } catch (e) {
        logger.error({ err: e }, '[relatorios] fetch dados Construpoint falhou');
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [startYear, endYear])

  const tipoBarData = useMemo(() => {
    if (!data) return []
    return Object.entries(data.inspecoesPorTipo)
      .map(([key, value]) => ({ name: key, value }))
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

  return (
    <div className="w-full space-y-6 p-4 md:p-6 lg:px-6 lg:py-4">
      <div className="flex justify-end">
        <div className="flex items-center gap-2 rounded-xl border border-[#1E1E22] bg-[#121214]/60 px-4 py-2">
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
          <span className="text-zinc-600 text-xs">-</span>
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

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 p-12" style={{ minHeight: '60vh' }}>
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-t-emerald-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
          <p className="text-sm text-zinc-400">Gerando relatórios…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 p-12" style={{ minHeight: '60vh' }}>
          <AlertCircle className="text-red-400" size={32} />
          <p className="text-sm text-zinc-300 font-medium">Erro ao carregar dados</p>
          <p className="text-xs text-zinc-500">{error}</p>
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <GlassCard title="Evolução de Verificações">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.serieMensal} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                <XAxis dataKey="label" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 20 }} formatter={v => <span style={{ color: '#a1a1aa' }}>{v}</span>} />
                <Line type="monotone" dataKey="aprovadas"  name="Aprovadas"     stroke={APROVADA_COLOR}  strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="reprovadas" name="Reprovadas"     stroke={REPROVADA_COLOR} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="naoAplica"  name="Não se aplica" stroke={NAOAPLICA_COLOR}  strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </GlassCard>

          <GlassCard title="Inspeções por Categoria">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tipoBarData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
                <XAxis type="number" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Inspeções" radius={[0, 4, 4, 0]} barSize={24}>
                  {tipoBarData.map((entry, i) => (
                    <Cell key={i} fill={COLORS_TIPO[entry.name as keyof typeof COLORS_TIPO] ?? '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>

          <div className="xl:col-span-2">
            <GlassCard title="Análise Proporcional de Resultados">
              {pieData.length > 0 ? (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-12 py-8">
                  <div style={{ width: 240, height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={100}
                          dataKey="value"
                          paddingAngle={3}
                        >
                          {pieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v) => [`${Number(v).toLocaleString('pt-BR')} itens`, '']}
                          contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-6 bg-[#121214]/60 border border-[#1E1E22] rounded-xl p-6 min-w-[240px]">
                    {pieData.map(d => (
                      <div key={d.name}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                          <span className="text-sm font-medium text-zinc-300">{d.name}</span>
                        </div>
                        <p className="text-2xl font-bold text-zinc-100 pl-5">{d.value.toLocaleString('pt-BR')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">Sem dados de verificações</div>
              )}
            </GlassCard>
          </div>
        </div>
      ) : null}
    </div>
  )
}
