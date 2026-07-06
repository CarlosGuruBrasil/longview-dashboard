'use client'

import { useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts'
import type { Lead } from '../../types'
import { calculateMetricsByPeriod, type PeriodMetrics } from '../../utils/metrics'
import GlassCard from '../ui/GlassCard'
import { useData } from '../../context/DataContext'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type MetricType =
  | 'novos_leads'
  | 'atendimento'
  | 'agendamento'
  | 'visitas'
  | 'proposta'
  | 'vendas'

type Granularity = 'month' | 'trimestre' | 'year'
type DisplayMode = 'taxa' | 'bruto'

interface MetricConfig {
  label: string
  icon: string
  rateKey: keyof PeriodMetrics
  bruteKey: keyof PeriodMetrics
  rateTarget: number
  bruteTarget: number
  hasToggle: boolean  // false = always shows bruto (proposta/vendas)
  isAbsolute: boolean // true for absolute counters
}

// ─────────────────────────────────────────────
// Config per metric
// ─────────────────────────────────────────────

const METRIC_CONFIGS: Record<MetricType, MetricConfig> = {
  novos_leads: {
    label: 'Novos Leads',
    icon: '📈',
    rateKey: 'newLeadsRate',
    bruteKey: 'totalLeads',
    rateTarget: 1.0,
    bruteTarget: 30,
    hasToggle: true,
    isAbsolute: false,
  },
  atendimento: {
    label: 'Atendimentos',
    icon: '👥',
    rateKey: 'attendanceRate',
    bruteKey: 'attendedCount',
    rateTarget: 0.8,
    bruteTarget: 24,
    hasToggle: true,
    isAbsolute: false,
  },
  agendamento: {
    label: 'Agendamentos',
    icon: '📅',
    rateKey: 'schedulingRate',
    bruteKey: 'scheduledCount',
    rateTarget: 0.7,
    bruteTarget: 15,
    hasToggle: true,
    isAbsolute: false,
  },
  visitas: {
    label: 'Visitas Realizadas',
    icon: '🏢',
    rateKey: 'visitRate',
    bruteKey: 'visitedCount',
    rateTarget: 0.8,
    bruteTarget: 10,
    hasToggle: true,
    isAbsolute: false,
  },
  proposta: {
    label: 'Com Proposta',
    icon: '📋',
    rateKey: 'proposalCount',
    bruteKey: 'proposalCount',
    rateTarget: 3,
    bruteTarget: 3,
    hasToggle: false,
    isAbsolute: true,
  },
  vendas: {
    label: 'Vendas Realizadas',
    icon: '🏆',
    rateKey: 'salesCount',
    bruteKey: 'salesCount',
    rateTarget: 1,
    bruteTarget: 1,
    hasToggle: false,
    isAbsolute: true,
  },
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatPeriodLabel(period: string): string {
  // "2026-01" → "Jan/26", "2026-Q2" → "Q2/26", "2026" → "2026"
  if (period.includes('-Q')) {
    const [year, q] = period.split('-')
    return `${q}/${year.slice(2)}`
  }
  if (period.length === 7) {
    const [year, month] = period.split('-')
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    return `${months[parseInt(month, 10) - 1]}/${year.slice(2)}`
  }
  return period
}

function formatYAxis(v: number, isAbsolute: boolean): string {
  if (isAbsolute) return String(Math.round(v))
  return `${(v * 100).toFixed(0)}%`
}

function formatTooltipValue(v: number, isAbsolute: boolean): string {
  if (isAbsolute) return String(Math.round(v))
  return `${(v * 100).toFixed(1)}%`
}

// 3-period simple moving average
function withMovingAverage(data: { value: number }[]): number[] {
  return data.map((_, i, arr) => {
    if (i === 0) return arr[0].value
    if (i === 1) return (arr[0].value + arr[1].value) / 2
    return (arr[i - 2].value + arr[i - 1].value + arr[i].value) / 3
  })
}

// ─────────────────────────────────────────────
// SemiGauge — half-circle speedometer
// ─────────────────────────────────────────────

interface SemiGaugeProps {
  value: number
  target: number
  maxValue: number
  isAbsolute: boolean
}

function SemiGauge({ value, target, maxValue, isAbsolute }: SemiGaugeProps) {
  const circumference = Math.PI * 88 // ≈ 276.46

  const scaleMax = Math.max(maxValue, target, 0.01)
  const fillRatio = Math.min(value / scaleMax, 1)
  const fillLength = fillRatio * circumference

  // Status color: green ≥ 95% of target, orange 70-94%, red < 70%
  const ratio = target > 0 ? value / target : 0
  const arcColor =
    ratio >= 0.95 ? '#22c55e'
    : ratio >= 0.70 ? '#f97316'
    : '#ef4444'

  const displayValue = isAbsolute
    ? String(Math.round(value))
    : `${(value * 100).toFixed(1)}%`

  const targetLabel = isAbsolute
    ? String(Math.round(target))
    : `${(target * 100).toFixed(0)}%`

  const maxLabel = isAbsolute
    ? String(Math.round(scaleMax))
    : `${(scaleMax * 100).toFixed(0)}%`

  return (
    <svg viewBox="0 0 200 115" className="w-full max-w-[220px] mx-auto" aria-hidden>
      {/* Background track */}
      <path
        d="M 12 100 A 88 88 0 0 1 188 100"
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="16"
        strokeLinecap="round"
      />
      {/* Colored fill arc */}
      <path
        d="M 12 100 A 88 88 0 0 1 188 100"
        fill="none"
        stroke={arcColor}
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray={`${fillLength} ${circumference}`}
        style={{ transition: 'stroke-dasharray 0.5s ease, stroke 0.3s ease' }}
      />
      {/* Target tick mark */}
      {(() => {
        const targetRatio = Math.min(target / scaleMax, 1)
        const angle = Math.PI - targetRatio * Math.PI // 180° → 0°
        const tx = 100 + 88 * Math.cos(angle)
        const ty = 100 - 88 * Math.sin(angle)
        const ix = 100 + 76 * Math.cos(angle)
        const iy = 100 - 76 * Math.sin(angle)
        return (
          <line
            x1={ix} y1={iy} x2={tx} y2={ty}
            stroke="#f97316"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )
      })()}

      {/* META label */}
      <text
        x="100" y="50"
        textAnchor="middle"
        fill="#f97316"
        fontSize="11"
        fontWeight="700"
        letterSpacing="2"
      >
        META
      </text>

      {/* Target value */}
      <text x="100" y="65" textAnchor="middle" fill="#f97316" fontSize="10">
        {targetLabel}
      </text>

      {/* Current value */}
      <text x="100" y="94" textAnchor="middle" fill="white" fontSize="22" fontWeight="700">
        {displayValue}
      </text>

      {/* Min label */}
      <text x="14" y="113" textAnchor="middle" fill="#6b7280" fontSize="9">
        {isAbsolute ? '0' : '0%'}
      </text>

      {/* Max label */}
      <text x="186" y="113" textAnchor="end" fill="#6b7280" fontSize="9">
        {maxLabel}
      </text>
    </svg>
  )
}

// ─────────────────────────────────────────────
// Custom Tooltip
// ─────────────────────────────────────────────

function CustomTooltip({
  active, payload, label, target, isAbsolute,
}: {
  active?: boolean
  payload?: { value: number; name: string; color: string }[]
  label?: string
  target: number
  isAbsolute: boolean
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-zinc-900/95 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      <p className="text-zinc-400 mb-1.5 font-medium">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-zinc-300">{p.name}:</span>
          <span className="text-white font-semibold">{formatTooltipValue(p.value, isAbsolute)}</span>
        </div>
      ))}
      <div className="mt-1.5 pt-1.5 border-t border-zinc-700/60 text-zinc-500">
        META: {formatTooltipValue(target, isAbsolute)}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

interface KpiGaugeHistoryCardProps {
  metric: MetricType
  leads: Lead[]  // use filteredLeads from DataContext — global date filter applies
  loading?: boolean
}

export default function KpiGaugeHistoryCard({
  metric,
  leads,
  loading = false,
}: KpiGaugeHistoryCardProps) {
  const config = METRIC_CONFIGS[metric]
  const { dateRange } = useData()
  const [granularity, setGranularity] = useState<Granularity>('month')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('taxa')

  // Effective mode (proposta/vendas are always bruto)
  const effectiveMode: DisplayMode = config.isAbsolute ? 'bruto' : displayMode

  const isAbsolute = config.isAbsolute || effectiveMode === 'bruto'

  // Current target based on display mode
  const target = (config.isAbsolute || effectiveMode === 'bruto')
    ? config.bruteTarget
    : config.rateTarget

  const valueKey = effectiveMode === 'taxa' ? config.rateKey : config.bruteKey

  // Compute period data over the leads provided (which will be allLeads for full history)
  const periodData = useMemo(
    () => calculateMetricsByPeriod(leads, granularity),
    [leads, granularity]
  )

  // Build chart data with moving average
  const chartData = useMemo(() => {
    const raw = periodData.map(p => ({
      period: formatPeriodLabel(p.period),
      value: (p[valueKey] as number) ?? 0,
    }))
    const movAvg = withMovingAverage(raw)
    return raw.map((d, i) => ({ ...d, mediaMovel: movAvg[i] }))
  }, [periodData, valueKey])

  // Identifica o período correspondente ao filtro ativo
  const selectedPeriod = useMemo(() => {
    if (!dateRange.start) return null
    const parts = dateRange.start.split('-')
    if (parts.length < 2) return null
    const year = parts[0]
    const month = parts[1]

    if (granularity === 'month') {
      return `${year}-${month}`
    } else if (granularity === 'trimestre') {
      const m = parseInt(month, 10)
      const q = Math.ceil(m / 3)
      return `${year}-Q${q}`
    } else {
      return year
    }
  }, [dateRange.start, granularity])

  // ── Cálculo dinâmico para Novos Leads MoM no período equivalente anterior ──
  const dynamicNewLeads = useMemo(() => {
    if (metric !== 'novos_leads') return null

    let startStr = dateRange.start
    const endStr = dateRange.end

    if (!startStr) {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      startStr = `${year}-${month}-01`
    }

    // Datas do período atual
    const startMs = new Date(startStr + 'T00:00:00').getTime()
    const endMs = endStr 
      ? new Date(endStr + 'T23:59:59').getTime() 
      : new Date().getTime()

    // Datas do período equivalente anterior (deslocado 1 mês para trás)
    const dStart = new Date(startStr + 'T00:00:00')
    dStart.setMonth(dStart.getMonth() - 1)
    const startMsPrev = dStart.getTime()

    let endMsPrev: number
    if (endStr) {
      const dEnd = new Date(endStr + 'T23:59:59')
      dEnd.setMonth(dEnd.getMonth() - 1)
      endMsPrev = dEnd.getTime()
    } else {
      const dEnd = new Date()
      dEnd.setMonth(dEnd.getMonth() - 1)
      endMsPrev = dEnd.getTime()
    }

    let currentCount = 0
    let prevCount = 0

    leads.forEach(l => {
      if (!l.data_cadastro) return
      const d = new Date(l.data_cadastro)
      if (isNaN(d.getTime())) return
      const t = d.getTime()

      if (t >= startMs && t <= endMs) {
        currentCount++
      } else if (t >= startMsPrev && t <= endMsPrev) {
        prevCount++
      }
    })

    const rate = prevCount > 0 ? currentCount / prevCount : 1

    return { rate, currentCount, prevCount }
  }, [leads, metric, dateRange])

  // Obtém o registro de período correspondente
  const currentPeriodEntry = useMemo(() => {
    if (selectedPeriod) {
      const found = periodData.find(p => p.period === selectedPeriod)
      if (found) return found
    }
    return periodData.length > 0 ? periodData[periodData.length - 1] : null
  }, [periodData, selectedPeriod])

  const currentValue = useMemo(() => {
    if (metric === 'novos_leads') {
      return effectiveMode === 'taxa' 
        ? dynamicNewLeads?.rate ?? 0 
        : dynamicNewLeads?.currentCount ?? 0
    }
    return currentPeriodEntry ? (currentPeriodEntry[valueKey] as number) ?? 0 : 0
  }, [metric, effectiveMode, dynamicNewLeads, currentPeriodEntry, valueKey])

  const currentLabel = useMemo(() => {
    if (metric === 'novos_leads' && dateRange.start) {
      return 'Período Filtrado vs Mês Ant.'
    }
    return currentPeriodEntry ? formatPeriodLabel(currentPeriodEntry.period) : '—'
  }, [metric, dateRange.start, currentPeriodEntry])

  // Gauge scale max: max of (historical values, target × 1.5)
  const historicalMax = chartData.reduce((m, d) => Math.max(m, d.value), 0)
  const gaugeMax = Math.max(historicalMax, target * 1.5, 0.01)

  // Y axis domain with headroom
  const yMax = Math.max(historicalMax, target) * 1.35
  const yDomain: [number, number] = [0, yMax || 1]

  // Status badge
  const ratio = target > 0 ? currentValue / target : 0
  const statusLabel =
    ratio >= 0.95 ? '↑ Acima da meta'
    : ratio >= 0.70 ? '→ Próximo da meta'
    : '↓ Abaixo da meta'
  const statusColor =
    ratio >= 0.95 ? 'text-green-400'
    : ratio >= 0.70 ? 'text-orange-400'
    : 'text-red-400'

  return (
    <GlassCard>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 rounded backdrop-blur-sm">
          <div className="w-8 h-8 rounded-full border-2 border-zinc-600 border-t-sky-500 animate-spin" />
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">{config.icon}</span>
          <h3 className="text-sm font-semibold text-zinc-200">{config.label}</h3>
          <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Taxa / Bruto toggle */}
          {config.hasToggle && (
            <div className="flex rounded-md overflow-hidden border border-zinc-700 text-xs">
              <button
                onClick={() => setDisplayMode('taxa')}
                className={`px-2.5 py-1 transition-colors ${
                  effectiveMode === 'taxa'
                    ? 'bg-zinc-600 text-white'
                    : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Taxa %
              </button>
              <button
                onClick={() => setDisplayMode('bruto')}
                className={`px-2.5 py-1 transition-colors ${
                  effectiveMode === 'bruto'
                    ? 'bg-zinc-600 text-white'
                    : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Bruto
              </button>
            </div>
          )}

          {/* Period selector */}
          <div className="flex rounded-md overflow-hidden border border-zinc-700 text-xs">
            {(['month', 'trimestre', 'year'] as Granularity[]).map(g => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`px-2.5 py-1 transition-colors ${
                  granularity === g
                    ? 'bg-orange-500/80 text-white'
                    : 'bg-zinc-800/60 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {g === 'month' ? 'Mês' : g === 'trimestre' ? 'Tri' : 'Ano'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body: gauge + chart ── */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-center">

        {/* Gauge */}
        <div className="w-full md:w-[200px] flex-shrink-0 flex flex-col items-center gap-1">
          <SemiGauge
            value={currentValue}
            target={target}
            maxValue={gaugeMax}
            isAbsolute={isAbsolute}
          />
          <p className="text-[10px] text-zinc-500 text-center">
            {currentLabel}
          </p>
        </div>

        {/* Historical chart */}
        <div className="flex-1 w-full min-w-0" style={{ height: 200 }}>
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
              Sem dados para o período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                />

                {/* Reddish area below meta — "zona de risco" */}
                <ReferenceArea
                  y1={0}
                  y2={target}
                  fill="rgba(180, 40, 40, 0.12)"
                  ifOverflow="hidden"
                />

                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={yDomain}
                  tickFormatter={v => formatYAxis(v, isAbsolute)}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />

                <Tooltip
                  content={
                    <CustomTooltip
                      target={target}
                      isAbsolute={isAbsolute}
                    />
                  }
                />

                {/* Meta reference line */}
                <ReferenceLine
                  y={target}
                  stroke="#f97316"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  label={{
                    value: 'META',
                    position: 'insideTopRight',
                    fill: '#f97316',
                    fontSize: 9,
                    dy: -4,
                  }}
                />

                {/* Actual metric line */}
                <Line
                  type="monotone"
                  dataKey="value"
                  name={isAbsolute ? config.label : effectiveMode === 'taxa' ? 'Taxa' : 'Quantidade'}
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#0ea5e9', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />

                {/* Moving average line */}
                {chartData.length >= 3 && (
                  <Line
                    type="monotone"
                    dataKey="mediaMovel"
                    name="Média móvel"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </GlassCard>
  )
}
