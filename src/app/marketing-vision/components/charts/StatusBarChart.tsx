'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import { CHART_PALETTE } from '../../utils/formatters'
import GlassCard from '../ui/GlassCard'

interface StatusBarChartProps {
  data: Array<{ name: string; value: number }>
  title: string
  height?: number
}

const TICK_COLOR = '#71717a'
const GRID_COLOR = 'rgba(255,255,255,0.05)'

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div style={{
      backgroundColor: '#18181b',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 12,
    }}>
      <p style={{ color: '#e4e4e7', marginBottom: 2 }}>{item.payload?.name}</p>
      <p style={{ color: '#a1a1aa' }}>{item.value?.toLocaleString('pt-BR')} leads</p>
    </div>
  )
}

export default function StatusBarChart({ data, title, height = 320 }: StatusBarChartProps) {
  const total = data.reduce((a, b) => a + b.value, 0)

  return (
    <GlassCard title={title}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: TICK_COLOR, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={140}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{
            position: 'right',
            formatter: (v: any) => {
              const num = typeof v === 'number' ? v : 0
              const pct = total > 0 ? ((num / total) * 100).toFixed(0) : '0'
              return `${num} (${pct}%)`
            },
            fill: '#71717a',
            fontSize: 10,
          }}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </GlassCard>
  )
}
