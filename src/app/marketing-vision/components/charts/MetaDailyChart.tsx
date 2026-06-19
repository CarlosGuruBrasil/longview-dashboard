'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { MetaDailyInsight } from '../../types'
import { formatCurrency } from '../../utils/formatters'
import GlassCard from '../ui/GlassCard'

type Metric = 'spend' | 'impressions' | 'clicks'

interface MetaDailyChartProps {
  daily: MetaDailyInsight[]
  metric: Metric
  onMetricChange: (metric: Metric) => void
}

const METRIC_LABELS: Record<Metric, string> = {
  spend: 'Investimento',
  impressions: 'Impressões',
  clicks: 'Cliques',
}

const TICK_COLOR = '#71717a'
const GRID_COLOR = 'rgba(255,255,255,0.05)'
const BAR_COLOR = '#0ea5e9'

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`
  return dateStr
}

interface TooltipPayload {
  value: number | string
  name: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
  metric: Metric
}

function CustomTooltip({ active, payload, label, metric }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const raw = Number(payload[0]?.value ?? 0)
  const formatted = metric === 'spend' ? formatCurrency(raw) : raw.toLocaleString('pt-BR')
  return (
    <div
      style={{
        backgroundColor: '#18181b',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
      }}
    >
      <p style={{ color: '#e4e4e7', marginBottom: 2 }}>{label}</p>
      <p style={{ color: '#0ea5e9' }}>
        {METRIC_LABELS[metric]}: {formatted}
      </p>
    </div>
  )
}

export default function MetaDailyChart({ daily, metric, onMetricChange }: MetaDailyChartProps) {
  const data = daily
    .slice()
    .sort((a, b) => (a.date_start ?? '').localeCompare(b.date_start ?? ''))
    .map(d => ({
      date: formatDate(d.date_start),
      value: Number(d[metric] ?? 0),
    }))

  const action = (
    <div className="flex gap-1">
      {(['spend', 'impressions', 'clicks'] as Metric[]).map(m => (
        <button
          key={m}
          onClick={() => onMetricChange(m)}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            metric === m
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {METRIC_LABELS[m]}
        </button>
      ))}
    </div>
  )

  return (
    <GlassCard title="Meta Ads — Diário" action={action}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: TICK_COLOR, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: TICK_COLOR, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v =>
              metric === 'spend'
                ? formatCurrency(Number(v))
                : Number(v).toLocaleString('pt-BR')
            }
            width={60}
          />
          <Tooltip content={<CustomTooltip metric={metric} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="value" fill={BAR_COLOR} radius={[3, 3, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </GlassCard>
  )
}
