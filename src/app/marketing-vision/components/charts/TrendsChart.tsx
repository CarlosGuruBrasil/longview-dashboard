'use client'

/* eslint-disable react-hooks/static-components */

import { useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { useData } from '../../context/DataContext'
import { isSale, getLeadDate, toISODate } from '../../utils/leads'
import { MONTHS_PT, CHART_PALETTE } from '../../utils/formatters'
import GlassCard from '../ui/GlassCard'

type Metric = 'leads' | 'vendas' | 'cpl'
type Period = '12w' | '6m' | '1y'

const TICK_COLOR = '#71717a'
const GRID_COLOR = 'rgba(255,255,255,0.05)'
const MA_COLOR = '#10b981'

function movingAvg(arr: number[], window: number): (number | null)[] {
  return arr.map((_, i) => {
    if (i < window - 1) return null
    const slice = arr.slice(i - window + 1, i + 1)
    const avg = slice.reduce((a, b) => a + b, 0) / window
    return Math.round(avg * 10) / 10
  })
}

function getYearWeek(dateStr: string): { year: number; week: number } {
  const d = new Date(dateStr + 'T12:00:00')
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000)
  const week = Math.ceil((dayOfYear - d.getDay() + 1) / 7)
  return { year: d.getFullYear(), week: Math.max(1, Math.min(52, week)) }
}

function getYearMonth(dateStr: string): { year: number; month: number } {
  const parts = dateStr.split('-')
  return { year: parseInt(parts[0]), month: parseInt(parts[1]) - 1 }
}

export default function TrendsChart() {
  const { allLeads, metaData } = useData()
  const [metric, setMetric] = useState<Metric>('leads')
  const [period, setPeriod] = useState<Period>('12w')

  const chartData = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const prevYear = currentYear - 1

    if (period === '12w' || period === '6m') {
      const weeks = period === '12w' ? 12 : 24
      const slots: { label: string; thisYear: number; lastYear: number; thisLeads: number; lastLeads: number }[] = []
      const { week: currentWeek } = getYearWeek(now.toISOString().split('T')[0])

      for (let i = weeks - 1; i >= 0; i--) {
        let targetWeek = currentWeek - i
        let targetYear = currentYear
        if (targetWeek <= 0) { targetWeek += 52; targetYear-- }
        slots.push({ label: `S${weeks - i}`, thisYear: 0, lastYear: 0, thisLeads: 0, lastLeads: 0 })
        const slot = slots[slots.length - 1]
        allLeads.forEach(lead => {
          const iso = toISODate(getLeadDate(lead))
          if (!iso) return
          const { year, week } = getYearWeek(iso)
          if (year === targetYear && week === targetWeek) slot.thisLeads++
          if (year === prevYear && week === targetWeek) slot.lastLeads++
        })
        slot.thisYear = slot.thisLeads
        slot.lastYear = slot.lastLeads
      }

      const thisMa = movingAvg(slots.map(s => s.thisLeads), 4)
      return slots.map((s, i) => ({ ...s, mediaMovel: thisMa[i] }))

    } else {
      const result: { label: string; thisYear: number; lastYear: number; mediaMovel: number | null }[] = []
      for (let m = 0; m < 12; m++) {
        result.push({ label: MONTHS_PT[m], thisYear: 0, lastYear: 0, mediaMovel: null })
      }
      allLeads.forEach(lead => {
        const iso = toISODate(getLeadDate(lead))
        if (!iso) return
        const { year, month } = getYearMonth(iso)
        if (year === currentYear) result[month].thisYear++
        if (year === prevYear) result[month].lastYear++
      })
      const ma = movingAvg(result.map(r => r.thisYear), 4)
      return result.map((r, i) => ({ ...r, mediaMovel: ma[i] }))
    }
  }, [allLeads, period])

  const cplData = useMemo(() => {
    if (!metaData?.daily?.length) return chartData.map(d => ({ ...d, thisYear: 0, lastYear: 0 }))
    const dailyMap: Record<string, { spend: number; leads: number }> = {}
    metaData.daily.forEach((day) => {
      if (!day.date_start) return
      const key = period === '1y'
        ? getYearMonth(day.date_start).month.toString()
        : getYearWeek(day.date_start).week.toString()
      if (!dailyMap[key]) dailyMap[key] = { spend: 0, leads: 0 }
      dailyMap[key].spend += parseFloat(day.spend ?? '0') || 0
      // Usar leads reais do Meta (action_type='lead'), não cliques no link
      const leadAction = day.actions?.find(
        a => a.action_type === 'lead' || a.action_type === 'omni_lead'
      )
      dailyMap[key].leads += leadAction ? (parseInt(leadAction.value, 10) || 0) : 0
    })
    return chartData.map((d, i) => {
      const entry = dailyMap[String(i)] ?? { spend: 0, leads: 0 }
      const cpl = entry.leads > 0 ? Math.round(entry.spend / entry.leads) : 0
      // Não fabricar dado do ano anterior (era 1.3× hardcoded — dado fictício)
      return { ...d, thisYear: cpl, lastYear: 0 }
    })
  }, [chartData, metaData, period])

  const vendasData = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const prevYear = currentYear - 1
    const salesLeads = allLeads.filter(isSale)
    const weeks = period === '12w' ? 12 : 24
    const { week: currentWeek } = getYearWeek(now.toISOString().split('T')[0])

    return chartData.map((slot, i) => {
      let thisCount = 0
      let lastCount = 0
      salesLeads.forEach(lead => {
        const iso = toISODate(getLeadDate(lead))
        if (!iso) return
        if (period === '1y') {
          const { year, month } = getYearMonth(iso)
          if (year === currentYear && month === i) thisCount++
          if (year === prevYear && month === i) lastCount++
        } else {
          const { year, week } = getYearWeek(iso)
          const targetWeek = ((currentWeek - (weeks - 1 - i)) + 52) % 52 || 52
          if (year === currentYear && week === targetWeek) thisCount++
          if (year === prevYear && week === targetWeek) lastCount++
        }
      })
      return { ...slot, thisYear: thisCount, lastYear: lastCount, mediaMovel: null }
    })
  }, [allLeads, chartData, period])

  const vendasDataWithMa = useMemo(() => {
    const ma = movingAvg(vendasData.map(v => v.thisYear), 4)
    return vendasData.map((d, i) => ({ ...d, mediaMovel: ma[i] }))
  }, [vendasData])

  const activeData = metric === 'leads' ? chartData : metric === 'vendas' ? vendasDataWithMa : cplData

  const CPL_META = 60

  const last4 = activeData.slice(-4)
  const periodTotal = last4.reduce((s, d) => s + d.thisYear, 0)
  const periodPrev = last4.reduce((s, d) => s + d.lastYear, 0)
  const pctChange = periodPrev > 0 ? Math.round(((periodTotal - periodPrev) / periodPrev) * 100) : 0
  const bestIdx = activeData.reduce((bi, d, i) => d.thisYear > activeData[bi].thisYear ? i : bi, 0)

  const metricLabel: Record<Metric, string> = {
    leads: 'Leads',
    vendas: 'Vendas',
    cpl: 'CPL (R$)',
  }

  const formatVal = (v: number) => metric === 'cpl' ? `R$${v}` : String(v)

  function CustomTooltip({ active, payload, label }: {
    active?: boolean
    payload?: { value: number; name: string; color: string }[]
    label?: string
  }) {
    if (!active || !payload?.length) return null
    return (
      <div style={{
        backgroundColor: '#18181b',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 12,
        minWidth: 160,
      }}>
        <p style={{ color: '#e4e4e7', marginBottom: 8, fontWeight: 600 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color ?? '#a1a1aa', marginBottom: 2 }}>
            {p.name}: <strong style={{ color: '#e4e4e7' }}>{formatVal(Math.round(p.value))}</strong>
          </p>
        ))}
      </div>
    )
  }

  const periodButtons: { key: Period; label: string }[] = [
    { key: '12w', label: '12 sem.' },
    { key: '6m', label: '6 meses' },
    { key: '1y', label: '1 ano' },
  ]

  const metricButtons: { key: Metric; label: string }[] = [
    { key: 'leads', label: 'Leads' },
    { key: 'vendas', label: 'Vendas' },
    { key: 'cpl', label: 'CPL' },
  ]

  return (
    <GlassCard title="Tendência">
      {/* Controls — ficam no corpo do card, nunca overflow */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Grupo métrica */}
        <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
          {metricButtons.map(m => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all no-tap ${
                metric === m.key
                  ? 'bg-sky-500/20 text-sky-400'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {/* Grupo período */}
        <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
          {periodButtons.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all no-tap ${
                period === p.key
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-600 ml-auto">{metricLabel[metric]}</span>
      </div>

      {/* KPI mini-cards — 2 cols mobile, 3 cols sm+ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <p className="text-[11px] text-zinc-500 mb-1">Últ. 4 períodos</p>
          <p className="text-lg font-semibold text-zinc-100">{formatVal(periodTotal)}</p>
          <p className={`text-[11px] mt-1 ${pctChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {pctChange >= 0 ? '↑' : '↓'} {Math.abs(pctChange)}% vs ant.
          </p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <p className="text-[11px] text-zinc-500 mb-1">Média móvel</p>
          <p className="text-lg font-semibold text-zinc-100">
            {formatVal(Math.round(last4.reduce((s, d) => s + d.thisYear, 0) / 4))}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">últimos 4 per.</p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 border border-white/5 col-span-2 sm:col-span-1">
          <p className="text-[11px] text-zinc-500 mb-1">Melhor período</p>
          <p className="text-lg font-semibold text-zinc-100">{activeData[bestIdx]?.label ?? '-'}</p>
          <p className="text-[11px] text-zinc-500 mt-1">{formatVal(activeData[bestIdx]?.thisYear ?? 0)} registros</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={activeData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis
            dataKey="label"
            tick={{ fill: TICK_COLOR, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={period === '1y' ? 0 : 'preserveStartEnd'}
          />
          <YAxis
            tick={{ fill: TICK_COLOR, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            tickFormatter={v => metric === 'cpl' ? `R$${v}` : String(v)}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ color: TICK_COLOR, fontSize: 12 }}
            formatter={(value) => <span style={{ color: '#a1a1aa' }}>{value}</span>}
          />
          {metric === 'cpl' && (
            <ReferenceLine
              y={CPL_META}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: `Meta R$${CPL_META}`, fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="lastYear"
            name="Ano anterior"
            stroke="#52525b"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4, fill: '#52525b' }}
          />
          <Line
            type="monotone"
            dataKey="thisYear"
            name="Este ano"
            stroke={CHART_PALETTE[0]}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: CHART_PALETTE[0] }}
          />
          <Line
            type="monotone"
            dataKey="mediaMovel"
            name="Média móvel (4p)"
            stroke={MA_COLOR}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: MA_COLOR }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 pt-3 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded" style={{ background: CHART_PALETTE[0] }} />
          <span className="text-[11px] text-zinc-500">Este ano</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0 border-t-2 border-dashed border-zinc-600" />
          <span className="text-[11px] text-zinc-500">Ano anterior</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded" style={{ background: MA_COLOR }} />
          <span className="text-[11px] text-zinc-500">Média móvel</span>
        </div>
        {metric === 'cpl' && (
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0 border-t-2 border-dashed border-amber-500" />
            <span className="text-[11px] text-amber-500">Meta R${CPL_META}</span>
          </div>
        )}
      </div>
    </GlassCard>
  )
}
