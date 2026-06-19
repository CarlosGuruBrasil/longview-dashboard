'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts'
import { CHART_PALETTE, formatCurrency } from '../../utils/formatters'
import GlassCard from '../ui/GlassCard'

interface OriginsBarChartProps {
  data: Array<{ name: string; quantidade: number; vgv: number }>
  title: string
  height?: number
}

const TICK_COLOR = '#71717a'
const GRID_COLOR = 'rgba(255,255,255,0.05)'

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
      <p style={{ color: '#e4e4e7', fontWeight: 600, marginBottom: 6 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {p.dataKey === 'vgv' ? formatCurrency(p.value) : p.value?.toLocaleString('pt-BR')}
        </p>
      ))}
    </div>
  )
}

export default function OriginsBarChart({ data, title, height = 320 }: OriginsBarChartProps) {
  const totalQtd = data.reduce((a, b) => a + b.quantidade, 0)

  return (
    <GlassCard title={title}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 30, left: 0, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis
            dataKey="name"
            tick={{ fill: TICK_COLOR, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: TICK_COLOR, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: TICK_COLOR, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) =>
              v >= 1_000_000
                ? `R$${(v / 1_000_000).toFixed(0)}M`
                : `R$${(v / 1_000).toFixed(0)}K`
            }
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: TICK_COLOR, fontSize: 12 }} />
          <Bar
            yAxisId="left"
            dataKey="quantidade"
            name="Vendas"
            fill={CHART_PALETTE[0]}
            radius={[4, 4, 0, 0]}
          >
            <LabelList
              dataKey="quantidade"
              position="top"
              style={{ fill: '#a1a1aa', fontSize: 10 }}
              formatter={(v: any) => {
                const num = typeof v === 'number' ? v : 0
                const pct = totalQtd > 0 ? ((num / totalQtd) * 100).toFixed(0) : '0'
                return `${num} (${pct}%)`
              }}
            />
          </Bar>
          <Bar
            yAxisId="right"
            dataKey="vgv"
            name="VGV (R$)"
            fill={CHART_PALETTE[2]}
            radius={[4, 4, 0, 0]}
            fillOpacity={0.6}
          />
        </BarChart>
      </ResponsiveContainer>
    </GlassCard>
  )
}
