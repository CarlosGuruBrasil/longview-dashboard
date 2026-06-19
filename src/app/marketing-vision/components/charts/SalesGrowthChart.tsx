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
import type { Lead } from '../../types'
import { groupLeadsByYearMonth, isSale } from '../../utils/leads'
import { MONTHS_PT, CHART_PALETTE } from '../../utils/formatters'
import GlassCard from '../ui/GlassCard'

interface SalesGrowthChartProps {
  allLeads: Lead[]
  mode: 'month' | 'year'
  onModeChange: (mode: 'month' | 'year') => void
}

const TICK_COLOR = '#71717a'
const GRID_COLOR = 'rgba(255,255,255,0.05)'

export default function SalesGrowthChart({ allLeads, mode, onModeChange }: SalesGrowthChartProps) {
  const sales = allLeads.filter(isSale)
  const byYearMonth = groupLeadsByYearMonth(sales)
  const years = Object.keys(byYearMonth).map(Number).sort()

  const monthData = MONTHS_PT.map((label, i) => {
    const entry: Record<string, unknown> = { month: label }
    years.forEach(y => {
      entry[String(y)] = byYearMonth[y]?.[i] ?? 0
    })
    return entry
  })

  const yearData = years.map(y => ({
    year: String(y),
    total: byYearMonth[y].reduce((a, b) => a + b, 0),
  }))

  const action = (
    <div className="flex gap-1">
      {(['month', 'year'] as const).map(m => (
        <button
          key={m}
          onClick={() => onModeChange(m)}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            mode === m
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {m === 'month' ? 'Mês a Mês' : 'Ano a Ano'}
        </button>
      ))}
    </div>
  )

  return (
    <GlassCard title="Crescimento de Vendas" action={action}>
      <ResponsiveContainer width="100%" height={300}>
        {mode === 'month' ? (
          <LineChart data={monthData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="month" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
              labelStyle={{ color: '#e4e4e7' }}
              itemStyle={{ color: '#a1a1aa' }}
            />
            <Legend wrapperStyle={{ color: TICK_COLOR, fontSize: 12 }} />
            {years.map((y, i) => (
              <Line
                key={y}
                type="monotone"
                dataKey={String(y)}
                stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        ) : (
          <LineChart data={yearData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="year" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
              labelStyle={{ color: '#e4e4e7' }}
              itemStyle={{ color: '#a1a1aa' }}
            />
            <Line
              type="monotone"
              dataKey="total"
              name="Vendas"
              stroke={CHART_PALETTE[0]}
              strokeWidth={2}
              dot={{ r: 4, fill: CHART_PALETTE[0] }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </GlassCard>
  )
}
