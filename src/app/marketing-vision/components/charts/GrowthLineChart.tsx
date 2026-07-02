'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { Lead, MetaDailyInsight } from '../../types'
import { groupLeadsByYearMonth } from '../../utils/leads'
import { MONTHS_PT, CHART_PALETTE, formatCurrency } from '../../utils/formatters'
import GlassCard from '../ui/GlassCard'

interface GrowthLineChartProps {
  leads: Lead[]
  daily?: MetaDailyInsight[]
  mode: 'month' | 'year'
  onModeChange: (mode: 'month' | 'year') => void
}

type ChartPoint = Record<string, unknown> & { label: string }
type CustomTooltipProps = {
  active?: boolean
  payload?: unknown[]
  label?: string
  data: ChartPoint[]
  years: number[]
  hasSpend: boolean
  mode: 'month' | 'year'
}

const TICK_COLOR = '#71717a'
const GRID_COLOR = 'rgba(255,255,255,0.05)'
const COLOR_SPEND = '#f59e0b' // amarelo — investimento

// Agrega spend do Meta por mês (índice 0-11) e por ano
function buildSpendByMonth(daily: MetaDailyInsight[]): { byMonth: number[]; byYear: Record<number, number> } {
  const byMonth = Array(12).fill(0)
  const byYear: Record<number, number> = {}
  daily.forEach(d => {
    if (!d.date_start || !d.spend) return
    const spend = parseFloat(d.spend)
    if (isNaN(spend)) return
    const parts = d.date_start.split('-')
    if (parts.length < 2) return
    const y = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10) - 1
    if (m < 0 || m > 11) return
    byMonth[m] += spend
    byYear[y] = (byYear[y] ?? 0) + spend
  })
  return { byMonth, byYear }
}

function CustomTooltip({ active, payload, label, data, years, hasSpend, mode }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const point = data.find(d => d.label === label)
  if (!point) return null

  return (
    <div style={{
      backgroundColor: '#18181b',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
      minWidth: 190,
    }}>
      <p style={{ color: '#e4e4e7', marginBottom: 8, fontWeight: 600 }}>{label}</p>
      {mode === 'month' ? (
        <>
          {years.map((y, i) => (
            <div key={y} style={{ marginBottom: 6 }}>
              <p style={{ color: CHART_PALETTE[i % CHART_PALETTE.length], fontWeight: 600, marginBottom: 2 }}>
                {y}
              </p>
              <p style={{ color: '#a1a1aa', paddingLeft: 8 }}>
                Leads: <strong style={{ color: '#e4e4e7' }}>{(point[`qty_${y}`] as number) ?? 0}</strong>
              </p>
            </div>
          ))}
          {hasSpend && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ color: COLOR_SPEND }}>
                Investimento: <strong>{formatCurrency((point.spend as number) ?? 0)}</strong>
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <p style={{ color: '#a1a1aa', marginBottom: 4 }}>
            Leads: <strong style={{ color: '#e4e4e7' }}>{point.qty as number}</strong>
          </p>
          {hasSpend && (
            <p style={{ color: COLOR_SPEND }}>
              Investimento: <strong>{formatCurrency((point.spend as number) ?? 0)}</strong>
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default function GrowthLineChart({ leads, daily = [], mode, onModeChange }: GrowthLineChartProps) {
  const byYearMonth = groupLeadsByYearMonth(leads)
  const years = Object.keys(byYearMonth).map(Number).sort()
  const { byMonth: spendByMonth, byYear: spendByYear } = buildSpendByMonth(daily)
  const hasSpend = daily.length > 0

  const monthData: ChartPoint[] = MONTHS_PT.map((label, i) => {
    const entry: ChartPoint = { label }
    years.forEach(y => { entry[`qty_${y}`] = byYearMonth[y]?.[i] ?? 0 })
    if (hasSpend) entry.spend = spendByMonth[i]
    return entry
  })

  const yearData = years.map(y => ({
    label: String(y),
    qty: byYearMonth[y].reduce((a, b) => a + b, 0),
    ...(hasSpend ? { spend: spendByYear[y] ?? 0 } : {}),
  }))

  const data = mode === 'month' ? monthData : yearData

  const spendFormatter = (v: number) =>
    v >= 1_000_000 ? `R$${(v / 1_000_000).toFixed(1)}M` : `R$${(v / 1_000).toFixed(0)}K`

  const action = (
    <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
      {(['month', 'year'] as const).map(m => (
        <button
          key={m}
          onClick={() => onModeChange(m)}
          className={`no-tap px-3 py-1 rounded-md text-xs font-medium transition-all shrink-0 ${
            mode === m
              ? 'bg-sky-500/20 text-sky-400'
              : 'text-zinc-500 hover:text-zinc-200'
          }`}
        >
          {m === 'month' ? 'Mês a Mês' : 'Ano a Ano'}
        </button>
      ))}
    </div>
  )

  return (
    <GlassCard title="Crescimento de Leads" action={action}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: hasSpend ? 16 : 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis dataKey="label" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
          {hasSpend && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: COLOR_SPEND, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={spendFormatter}
              width={64}
            />
          )}
          <Tooltip content={<CustomTooltip data={data} years={years} hasSpend={hasSpend} mode={mode} />} />
          <Legend wrapperStyle={{ color: TICK_COLOR, fontSize: 12 }} />

          {/* Linhas de leads — uma por ano */}
          {mode === 'month' ? (
            years.map((y, i) => (
              <Line
                key={y}
                yAxisId="left"
                type="monotone"
                dataKey={`qty_${y}`}
                name={String(y)}
                stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))
          ) : (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="qty"
              name="Leads"
              stroke={CHART_PALETTE[0]}
              strokeWidth={2}
              dot={{ r: 4, fill: CHART_PALETTE[0] }}
              activeDot={{ r: 6 }}
            />
          )}

          {/* Linha de investimento Meta */}
          {hasSpend && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="spend"
              name="Investimento (R$)"
              stroke={COLOR_SPEND}
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              activeDot={{ r: 4 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </GlassCard>
  )
}
