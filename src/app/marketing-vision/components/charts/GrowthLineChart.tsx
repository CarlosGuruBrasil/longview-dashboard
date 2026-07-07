'use client'

import { useMemo } from 'react'
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
import { toISODate } from '../../utils/leads'
import { formatCurrency } from '../../utils/formatters'
import GlassCard from '../ui/GlassCard'

interface GrowthLineChartProps {
  leads: Lead[]
  daily?: MetaDailyInsight[]
  mode: 'day' | 'month'
  onModeChange: (mode: 'day' | 'month') => void
}

type ChartPoint = {
  label: string
  leads: number
  spend?: number
  sortKey: string
}

const TICK_COLOR = '#71717a'
const GRID_COLOR = 'rgba(255,255,255,0.05)'
const COLOR_LEADS = '#3b82f6' // azul — leads
const COLOR_SPEND = '#f59e0b' // amarelo — investimento

export default function GrowthLineChart({ leads, daily = [], mode, onModeChange }: GrowthLineChartProps) {
  const hasSpend = daily.length > 0

  const data = useMemo(() => {
    // 1. Coleta todas as datas disponíveis nos leads e insights diários
    const dates = leads
      .map(l => toISODate(l.data_cad || l.data_cadastro || l.data_cadastramento))
      .filter(Boolean) as string[]

    if (daily.length > 0) {
      daily.forEach(d => {
        if (d.date_start) dates.push(d.date_start)
      })
    }

    if (dates.length === 0) {
      return []
    }

    dates.sort()
    const minDateStr = dates[0]
    const maxDateStr = dates[dates.length - 1]

    if (mode === 'day') {
      // Agrupamento Diário
      const start = new Date(minDateStr)
      const end = new Date(maxDateStr)
      const points: ChartPoint[] = []

      const current = new Date(start)
      let limit = 0
      while (current <= end && limit < 366) {
        const isoString = current.toISOString().split('T')[0]
        const label = current.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

        // Filtra leads do dia
        const qtyLeads = leads.filter(l => {
          const d = toISODate(l.data_cad || l.data_cadastro || l.data_cadastramento)
          return d === isoString
        }).length

        // Soma spend do dia
        const spend = daily
          .filter(d => d.date_start === isoString)
          .reduce((sum, d) => sum + (parseFloat(d.spend || '0') || 0), 0)

        points.push({
          label,
          leads: qtyLeads,
          spend,
          sortKey: isoString
        })

        current.setDate(current.getDate() + 1)
        limit++
      }
      return points
    } else {
      // Agrupamento Mensal
      const map = new Map<string, ChartPoint>()
      const start = new Date(minDateStr)
      const end = new Date(maxDateStr)

      const current = new Date(start.getFullYear(), start.getMonth(), 1)
      const targetEnd = new Date(end.getFullYear(), end.getMonth(), 1)

      let limit = 0
      while (current <= targetEnd && limit < 48) {
        const y = current.getFullYear()
        const m = current.getMonth()
        const sortKey = `${y}-${String(m + 1).padStart(2, '0')}`
        const label = current.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })

        map.set(sortKey, { label, leads: 0, spend: 0, sortKey })
        current.setMonth(current.getMonth() + 1)
        limit++
      }

      // Distribui os leads
      leads.forEach(l => {
        const iso = toISODate(l.data_cad || l.data_cadastro || l.data_cadastramento)
        if (!iso) return
        const parts = iso.split('-')
        const sortKey = `${parts[0]}-${parts[1]}`
        const entry = map.get(sortKey)
        if (entry) {
          entry.leads += 1
        }
      })

      // Distribui o spend
      daily.forEach(d => {
        if (!d.date_start) return
        const parts = d.date_start.split('-')
        const sortKey = `${parts[0]}-${parts[1]}`
        const entry = map.get(sortKey)
        if (entry) {
          entry.spend = (entry.spend || 0) + (parseFloat(d.spend || '0') || 0)
        }
      })

      return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    }
  }, [leads, daily, mode])

  const spendFormatter = (v: number) =>
    v >= 1_000_000 ? `R$${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `R$${(v / 1_000).toFixed(0)}K` : `R$${v.toFixed(0)}`

  const action = (
    <div className="flex gap-1 bg-white/5 rounded-lg p-0.5 border border-white/5">
      {(['day', 'month'] as const).map(m => (
        <button
          key={m}
          onClick={() => onModeChange(m)}
          className={`no-tap px-3 py-1 rounded-md text-xs font-semibold transition-all shrink-0 ${
            mode === m
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/10'
              : 'text-zinc-500 hover:text-zinc-200'
          }`}
        >
          {m === 'day' ? 'Evolução Diária' : 'Evolução Mensal'}
        </button>
      ))}
    </div>
  )

  return (
    <GlassCard title="Crescimento & Investimento de Leads" action={action}>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[280px] text-zinc-500 text-xs">
          Nenhum dado de leads ou investimento no período selecionado.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 12, right: hasSpend ? 16 : 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: TICK_COLOR, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fill: TICK_COLOR, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
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
            <Tooltip
              contentStyle={{ backgroundColor: '#121214', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
              labelClassName="text-zinc-200 font-bold text-xs"
              formatter={(value: any, name: any) => {
                const nameStr = String(name || '')
                if (nameStr.includes('Investimento')) {
                  return [formatCurrency(Number(value)), nameStr]
                }
                return [value, nameStr]
              }}
            />
            <Legend wrapperStyle={{ color: TICK_COLOR, fontSize: 11 }} />

            <Line
              yAxisId="left"
              type="monotone"
              dataKey="leads"
              name="Leads Gerados"
              stroke={COLOR_LEADS}
              strokeWidth={2.5}
              dot={data.length <= 31 ? { r: 3, strokeWidth: 1 } : false}
              activeDot={{ r: 5 }}
            />

            {hasSpend && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="spend"
                name="Investimento Meta (R$)"
                stroke={COLOR_SPEND}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={data.length <= 31 ? { r: 2, strokeWidth: 1 } : false}
                activeDot={{ r: 4 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </GlassCard>
  )
}
