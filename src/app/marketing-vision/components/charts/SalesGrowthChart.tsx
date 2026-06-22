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
import { isSale, getLeadValueNumber, getLeadDate, toISODate } from '../../utils/leads'
import { MONTHS_PT, CHART_PALETTE, formatCurrency } from '../../utils/formatters'
import GlassCard from '../ui/GlassCard'

interface SalesGrowthChartProps {
  allLeads: Lead[]
  mode: 'month' | 'year'
  onModeChange: (mode: 'month' | 'year') => void
}

const TICK_COLOR = '#71717a'
const GRID_COLOR = 'rgba(255,255,255,0.05)'

function buildMonthData(leads: Lead[]) {
  const sales = leads.filter(isSale)
  const byYM: Record<number, { count: number[]; vgv: number[] }> = {}

  sales.forEach(lead => {
    const iso = toISODate(getLeadDate(lead))
    if (!iso) return
    const [yStr, mStr] = iso.split('-')
    const y = parseInt(yStr, 10)
    const m = parseInt(mStr, 10) - 1
    if (isNaN(y) || isNaN(m) || m < 0 || m > 11) return
    if (!byYM[y]) byYM[y] = { count: Array(12).fill(0), vgv: Array(12).fill(0) }
    byYM[y].count[m]++
    byYM[y].vgv[m] += getLeadValueNumber(lead)
  })

  const years = Object.keys(byYM).map(Number).sort()

  const data = MONTHS_PT.map((label, i) => {
    const entry: Record<string, unknown> = { label }
    years.forEach(y => {
      entry[`qty_${y}`] = byYM[y]?.count[i] ?? 0
      entry[`vgv_${y}`] = byYM[y]?.vgv[i] ?? 0
    })
    return entry
  })

  return { data, years }
}

function buildYearData(leads: Lead[]) {
  const sales = leads.filter(isSale)
  const byYear: Record<number, { qty: number; vgv: number }> = {}

  sales.forEach(lead => {
    const iso = toISODate(getLeadDate(lead))
    if (!iso) return
    const y = parseInt(iso.split('-')[0], 10)
    if (isNaN(y)) return
    if (!byYear[y]) byYear[y] = { qty: 0, vgv: 0 }
    byYear[y].qty++
    byYear[y].vgv += getLeadValueNumber(lead)
  })

  const years = Object.keys(byYear).map(Number).sort()
  const data = years.map(y => ({
    label: String(y),
    qty: byYear[y].qty,
    vgv: byYear[y].vgv,
  }))

  return { data, years }
}

export default function SalesGrowthChart({ allLeads, mode, onModeChange }: SalesGrowthChartProps) {
  const { data, years } = mode === 'month' ? buildMonthData(allLeads) : buildYearData(allLeads)

  // CustomTooltip com closure sobre `data` para acessar VGV sem séries extras
  function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    const point = data.find((d: any) => d.label === label)
    if (!point) return null

    return (
      <div style={{
        backgroundColor: '#18181b',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 12,
        minWidth: 180,
      }}>
        <p style={{ color: '#e4e4e7', marginBottom: 8, fontWeight: 600 }}>{label}</p>
        {mode === 'month' ? (
          years.map((y, i) => {
            const qty = (point as any)[`qty_${y}`] as number
            const vgv = (point as any)[`vgv_${y}`] as number
            return (
              <div key={y} style={{ marginBottom: 6 }}>
                <p style={{ color: CHART_PALETTE[i % CHART_PALETTE.length], fontWeight: 600, marginBottom: 2 }}>
                  {y}
                </p>
                <p style={{ color: '#a1a1aa', paddingLeft: 8 }}>
                  Qtd: <strong style={{ color: '#e4e4e7' }}>{qty}</strong>
                </p>
                <p style={{ color: '#a1a1aa', paddingLeft: 8 }}>
                  VGV: <strong style={{ color: '#e4e4e7' }}>{formatCurrency(vgv)}</strong>
                </p>
              </div>
            )
          })
        ) : (
          <>
            <p style={{ color: '#a1a1aa', marginBottom: 2 }}>
              Qtd: <strong style={{ color: '#e4e4e7' }}>{(point as any).qty}</strong> vendas
            </p>
            <p style={{ color: '#a1a1aa' }}>
              VGV: <strong style={{ color: '#e4e4e7' }}>{formatCurrency((point as any).vgv)}</strong>
            </p>
          </>
        )}
      </div>
    )
  }

  const vgvFormatter = (v: number) =>
    v >= 1_000_000 ? `R$${(v / 1_000_000).toFixed(0)}M` : `R$${(v / 1_000).toFixed(0)}K`

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
    <GlassCard title="Vendas Realizadas" action={action}>
      <ResponsiveContainer width="100%" height={320}>
        {mode === 'month' ? (
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="label" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: TICK_COLOR, fontSize: 12 }} />
            {years.map((y, i) => (
              <Line
                key={y}
                type="monotone"
                dataKey={`qty_${y}`}
                name={String(y)}
                stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        ) : (
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="label" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: TICK_COLOR, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={vgvFormatter}
              width={64}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: TICK_COLOR, fontSize: 12 }} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="qty"
              name="Quantidade"
              stroke={CHART_PALETTE[0]}
              strokeWidth={2.5}
              dot={{ r: 5, fill: CHART_PALETTE[0] }}
              activeDot={{ r: 7 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="vgv"
              name="VGV (R$)"
              stroke={CHART_PALETTE[2]}
              strokeWidth={2.5}
              dot={{ r: 5, fill: CHART_PALETTE[2] }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </GlassCard>
  )
}
