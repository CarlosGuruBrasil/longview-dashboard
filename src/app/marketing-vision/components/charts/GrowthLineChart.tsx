'use client'

import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { Lead, MetaDailyInsight } from '../../types'
import { toISODate } from '../../utils/leads'
import GlassCard from '../ui/GlassCard'

interface GrowthLineChartProps {
  leads: Lead[]
  daily?: MetaDailyInsight[]
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const YEAR_COLORS: Record<number, string> = {
  2023: '#6366f1',
  2024: '#0ea5e9',
  2025: '#f59e0b',
  2026: '#10b981',
  2027: '#f43f5e',
}

const TICK_COLOR = '#71717a'
const GRID_COLOR = 'rgba(255,255,255,0.05)'

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string; payload: Record<string, number> }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#121214', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '10px 14px', fontSize: 11 }}>
      <p style={{ color: '#e4e4e7', fontWeight: 700, marginBottom: 8 }}>{label}</p>
      {payload.map(p => {
        const year = p.dataKey.replace('leads_', '')
        const spend = p.payload[`spend_${year}`] ?? 0
        return (
          <div key={year} style={{ marginBottom: 4 }}>
            <span style={{ color: p.color, fontWeight: 700 }}>{year}</span>
            <span style={{ color: '#a1a1aa' }}> · Leads: </span>
            <span style={{ color: '#fff', fontWeight: 700 }}>{p.value ?? 0}</span>
            {spend > 0 && (
              <>
                <span style={{ color: '#a1a1aa' }}> · Invest: </span>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>
                  {spend.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function GrowthLineChart({ leads, daily = [] }: GrowthLineChartProps) {
  const { chartData, years } = useMemo(() => {
    const byYearMonth = new Map<string, { leads: number; spend: number }>()

    leads.forEach(l => {
      const iso = toISODate(l.data_cad || l.data_cadastro || l.data_cadastramento)
      if (!iso) return
      const [y, m] = iso.split('-')
      const key = `${y}-${m}`
      const entry = byYearMonth.get(key) ?? { leads: 0, spend: 0 }
      entry.leads += 1
      byYearMonth.set(key, entry)
    })

    daily.forEach(d => {
      if (!d.date_start) return
      const [y, m] = d.date_start.split('-')
      const key = `${y}-${m}`
      const entry = byYearMonth.get(key) ?? { leads: 0, spend: 0 }
      entry.spend += parseFloat(d.spend || '0') || 0
      byYearMonth.set(key, entry)
    })

    const yearsSet = new Set<number>()
    for (const key of byYearMonth.keys()) {
      yearsSet.add(parseInt(key.split('-')[0]))
    }
    const years = Array.from(yearsSet).sort()

    const chartData = MONTH_LABELS.map((label, i) => {
      const monthNum = String(i + 1).padStart(2, '0')
      const row: Record<string, unknown> = { month: label, monthNum }
      for (const year of years) {
        const key = `${year}-${monthNum}`
        const entry = byYearMonth.get(key)
        row[`leads_${year}`] = entry?.leads ?? null
        row[`spend_${year}`] = entry?.spend ?? 0
      }
      return row
    })

    return { chartData, years }
  }, [leads, daily])

  return (
    <GlassCard title="Crescimento de Leads — Comparativo Anual">
      {years.length === 0 ? (
        <div className="flex items-center justify-center h-[280px] text-zinc-500 text-xs">
          Nenhum dado disponível.
        </div>
      ) : (
        <>
          <div className="flex gap-3 mb-3 flex-wrap">
            {years.map(year => (
              <div key={year} className="flex items-center gap-1.5">
                <span className="w-3 h-[2.5px] rounded-full" style={{ backgroundColor: YEAR_COLORS[year] ?? '#fff' }} />
                <span className="text-[11px] text-zinc-400 font-semibold">{year}</span>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 8, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: TICK_COLOR, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: TICK_COLOR, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ display: 'none' }} />
              {years.map(year => (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={`leads_${year}`}
                  name={String(year)}
                  stroke={YEAR_COLORS[year] ?? '#ffffff'}
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </GlassCard>
  )
}
