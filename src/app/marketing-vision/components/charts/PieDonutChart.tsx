'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { CHART_PALETTE } from '../../utils/formatters'
import GlassCard from '../ui/GlassCard'

interface PieDonutChartProps {
  data: Array<{ name: string; value: number }>
  title: string
  colors?: string[]
  height?: number
}

interface TooltipPayload {
  name: string
  value: number
  payload: { name: string; value: number }
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const total = payload[0]?.payload?.value
  const item = payload[0]
  if (!item) return null
  // We don't have the total here easily, so just show value and name
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
      <p style={{ color: '#e4e4e7', marginBottom: 2 }}>{item.name}</p>
      <p style={{ color: '#a1a1aa' }}>
        {item.value.toLocaleString('pt-BR')}
      </p>
    </div>
  )
}

function CustomTooltipWithPercent({
  active,
  payload,
  total,
}: CustomTooltipProps & { total: number }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  if (!item) return null
  const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0'
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
      <p style={{ color: '#e4e4e7', marginBottom: 2 }}>{item.name}</p>
      <p style={{ color: '#a1a1aa' }}>
        {item.value.toLocaleString('pt-BR')} ({pct}%)
      </p>
    </div>
  )
}

export default function PieDonutChart({
  data,
  title,
  colors = CHART_PALETTE,
  height = 280,
}: PieDonutChartProps) {
  const total = data.reduce((acc, d) => acc + d.value, 0)

  const renderLegendText = (value: string, entry: any) => {
    const itemVal = entry.payload?.value ?? 0
    const pct = total > 0 ? ((itemVal / total) * 100).toFixed(1) : '0.0'
    return (
      <span className="text-zinc-400 pl-1">
        {value}: <span className="font-semibold text-zinc-200">{itemVal.toLocaleString('pt-BR')}</span> <span className="text-zinc-500 text-[10px]">({pct}%)</span>
      </span>
    )
  }

  return (
    <GlassCard title={title}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="40%"
            cy="50%"
            innerRadius="55%"
            outerRadius="75%"
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            content={<CustomTooltipWithPercent total={total} />}
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ color: '#71717a', fontSize: 12 }}
            formatter={renderLegendText}
          />
        </PieChart>
      </ResponsiveContainer>
    </GlassCard>
  )
}
