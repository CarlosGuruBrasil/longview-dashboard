'use client'

import { useMemo, useState } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { Lead } from '../../types'
import { groupLeadsByYearMonth, isSale, getLeadValueNumber, getLeadDate, toISODate } from '../../utils/leads'
import { MONTHS_PT, CHART_PALETTE, formatCurrency } from '../../utils/formatters'
import GlassCard from '../ui/GlassCard'

interface SalesGrowthChartProps {
  allLeads: Lead[]
  mode: 'month' | 'year'
  onModeChange: (mode: 'month' | 'year') => void
}

const TICK_COLOR = '#71717a'
const GRID_COLOR = 'rgba(255,255,255,0.05)'

function groupSalesByYearMonthWithVgv(leads: Lead[]): Record<number, { count: number[]; vgv: number[] }> {
  const byYM: Record<number, { count: number[]; vgv: number[] }> = {}
  leads.forEach(lead => {
    const raw = getLeadDate(lead)
    if (!raw) return
    const iso = toISODate(raw)
    if (!iso) return
    const parts = iso.split('-')
    if (parts.length < 3) return
    const y = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10) - 1
    if (isNaN(y) || isNaN(m) || m < 0 || m > 11) return
    if (!byYM[y]) byYM[y] = { count: Array(12).fill(0), vgv: Array(12).fill(0) }
    byYM[y].count[m]++
    byYM[y].vgv[m] += getLeadValueNumber(lead)
  })
  return byYM
}

// Custom tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      backgroundColor: '#18181b',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
    }}>
      <p style={{ color: '#e4e4e7', marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {p.name?.includes('VGV')
            ? formatCurrency(p.value)
            : p.value?.toLocaleString('pt-BR')}
        </p>
      ))}
    </div>
  )
}

export default function SalesGrowthChart({ allLeads, mode, onModeChange }: SalesGrowthChartProps) {
  const sales = allLeads.filter(isSale)
  const byYM = groupSalesByYearMonthWithVgv(sales)
  const years = Object.keys(byYM).map(Number).sort()

  // Month-by-month data: one bar per year (stacked) + VGV line per year
  const monthData = MONTHS_PT.map((label, i) => {
    const entry: Record<string, unknown> = { month: label }
    years.forEach(y => {
      entry[`qty_${y}`] = byYM[y]?.count[i] ?? 0
      entry[`vgv_${y}`] = byYM[y]?.vgv[i] ?? 0
    })
    return entry
  })

  // Year aggregated data
  const yearData = years.map(y => ({
    year: String(y),
    quantidade: byYM[y].count.reduce((a, b) => a + b, 0),
    vgv: byYM[y].vgv.reduce((a, b) => a + b, 0),
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

  if (mode === 'year') {
    return (
      <GlassCard title="Vendas Realizadas" action={action}>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={yearData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="year" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: TICK_COLOR, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v >= 1_000_000 ? `R$${(v / 1_000_000).toFixed(0)}M` : `R$${(v / 1_000).toFixed(0)}K`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: TICK_COLOR, fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="quantidade" name="Quantidade" fill={CHART_PALETTE[0]} radius={[4, 4, 0, 0]} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="vgv"
              name="VGV (R$)"
              stroke={CHART_PALETTE[2]}
              strokeWidth={2}
              dot={{ r: 4, fill: CHART_PALETTE[2] }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </GlassCard>
    )
  }

  // Month mode — one bar cluster per year + VGV lines
  return (
    <GlassCard title="Vendas Realizadas" action={action}>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={monthData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis dataKey="month" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: TICK_COLOR, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => v >= 1_000_000 ? `R$${(v / 1_000_000).toFixed(0)}M` : `R$${(v / 1_000).toFixed(0)}K`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: TICK_COLOR, fontSize: 12 }} />
          {years.map((y, i) => (
            <Bar
              key={`qty_${y}`}
              yAxisId="left"
              dataKey={`qty_${y}`}
              name={`Qtd ${y}`}
              fill={CHART_PALETTE[i % CHART_PALETTE.length]}
              radius={[3, 3, 0, 0]}
            />
          ))}
          {years.map((y, i) => (
            <Line
              key={`vgv_${y}`}
              yAxisId="right"
              type="monotone"
              dataKey={`vgv_${y}`}
              name={`VGV ${y}`}
              stroke={CHART_PALETTE[(i + 3) % CHART_PALETTE.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </GlassCard>
  )
}
