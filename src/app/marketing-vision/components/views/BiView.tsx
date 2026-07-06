'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  BarChart3, Users, DollarSign, TrendingUp, Target, Clock,
  ShoppingCart, ArrowUp, ArrowDown, Activity,
} from 'lucide-react'
import GlassCard from '../ui/GlassCard'
import type { BiInsights } from '../../types'
import { formatCurrency, formatNumber } from '../../utils/formatters'
import logger from '@/lib/logger'

const TICK = '#71717a'
const GRID = 'rgba(255,255,255,0.05)'
const PALETTE = ['#0ea5e9', '#a855f7', '#f59e0b', '#10b981', '#f43f5e', '#64748b', '#06b6d4', '#ec4899']

function KpiCard({
  icon: Icon, label, value, sub, color, trend,
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string; trend?: number
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 sm:p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}20` }}>
            <Icon size={15} style={{ color }} />
          </div>
          <span className="text-[12px] text-zinc-400 font-medium truncate">{label}</span>
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
            {trend > 0 ? <ArrowUp size={11} /> : trend < 0 ? <ArrowDown size={11} /> : null}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{value}</p>
      {sub && <p className="text-[11px] text-zinc-500 truncate">{sub}</p>}
    </div>
  )
}

function FunnelChart({ data }: { data: BiInsights['funnel'] }) {
  const max = data[0]?.value || 1
  return (
    <GlassCard>
      <p className="text-sm font-semibold text-zinc-200 mb-4">Funil de Vendas por Etapa</p>
      <div className="space-y-2">
        {data.map((item, i) => {
          const pct = Math.round((item.value / max) * 100)
          return (
            <div key={item.name} className="flex items-center gap-3 group">
              <span className="text-[11px] text-zinc-500 w-5 text-right shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-zinc-300 truncate">{item.name}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {i > 0 && <span className="text-[10px] text-zinc-600">{item.percentage}%</span>}
                    <span className="text-xs font-semibold text-white">{formatNumber(item.value)}</span>
                  </div>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}

function ConversionTimeChart({ data }: { data: BiInsights['conversionTime'] }) {
  return (
    <GlassCard>
      <p className="text-sm font-semibold text-zinc-200 mb-4">Tempo de Conversão de Leads</p>
      <div className="space-y-2">
        {data.map((item, i) => (
          <div key={item.range} className="flex items-center gap-3">
            <span className="text-[11px] text-zinc-400 w-20 shrink-0 truncate">{item.range}</span>
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${item.percentage}%`, background: PALETTE[i % PALETTE.length] }} />
            </div>
            <span className="text-xs font-semibold text-white w-8 text-right">{formatNumber(item.count)}</span>
            <span className="text-[10px] text-zinc-600 w-8 text-right">{item.percentage}%</span>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

function CampaignTable({ data }: { data: BiInsights['campaignAttribution'] }) {
  return (
    <GlassCard>
      <p className="text-sm font-semibold text-zinc-200 mb-4">Atribuição por Campanha / Origem</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-500 border-b border-white/[0.06]">
              <th className="text-left pb-2 font-medium">Campanha</th>
              <th className="text-right pb-2 font-medium">Leads</th>
              <th className="text-right pb-2 font-medium">Vendas</th>
              <th className="text-right pb-2 font-medium">Receita</th>
              <th className="text-right pb-2 font-medium">CPL</th>
              <th className="text-right pb-2 font-medium">CAC</th>
              <th className="text-right pb-2 font-medium">ROAS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {data.map((r) => (
              <tr key={r.campaignName} className="hover:bg-white/[0.03] transition-colors">
                <td className="py-2.5 pr-2 text-zinc-200 font-medium truncate max-w-[120px]">{r.campaignName}</td>
                <td className="text-right py-2.5 text-zinc-100 font-semibold">{formatNumber(r.leads)}</td>
                <td className="text-right py-2.5 text-emerald-400 font-semibold">{r.sales}</td>
                <td className="text-right py-2.5 text-zinc-300">{r.revenue > 0 ? formatCurrency(r.revenue) : '—'}</td>
                <td className="text-right py-2.5 text-zinc-400">{r.cpl > 0 ? formatCurrency(r.cpl) : '—'}</td>
                <td className="text-right py-2.5 text-zinc-400">{r.cac > 0 ? formatCurrency(r.cac) : '—'}</td>
                <td className="text-right py-2.5">
                  <span className={`text-[11px] font-semibold ${r.roas >= 2 ? 'text-emerald-400' : r.roas >= 1 ? 'text-amber-400' : 'text-zinc-500'}`}>
                    {r.roas > 0 ? `${r.roas.toFixed(1)}x` : '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  )
}

function PerDevelopmentTable({ data }: { data: BiInsights['perDevelopment'] }) {
  return (
    <GlassCard>
      <p className="text-sm font-semibold text-zinc-200 mb-4">Ticket Médio por Empreendimento</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-500 border-b border-white/[0.06]">
              <th className="text-left pb-2 font-medium">Empreendimento</th>
              <th className="text-right pb-2 font-medium">Leads</th>
              <th className="text-right pb-2 font-medium">Visitas</th>
              <th className="text-right pb-2 font-medium">Reservas</th>
              <th className="text-right pb-2 font-medium">Vendas</th>
              <th className="text-right pb-2 font-medium">VGV</th>
              <th className="text-right pb-2 font-medium">Ticket Médio</th>
              <th className="text-right pb-2 font-medium">Conv.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {data.map((r, i) => (
              <tr key={r.nome} className="hover:bg-white/[0.03] transition-colors">
                <td className="py-2.5 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="text-zinc-200 font-medium truncate max-w-[150px]">{r.nome}</span>
                  </div>
                </td>
                <td className="text-right py-2.5 text-zinc-100 font-semibold">{r.leads}</td>
                <td className="text-right py-2.5 text-zinc-400">{r.visits}</td>
                <td className="text-right py-2.5 text-zinc-400">{r.reservations}</td>
                <td className="text-right py-2.5 text-emerald-400 font-semibold">{r.sales}</td>
                <td className="text-right py-2.5 text-zinc-300">{r.vgv > 0 ? formatCurrency(r.vgv) : '—'}</td>
                <td className="text-right py-2.5 text-zinc-200 font-semibold">{r.avgTicket > 0 ? formatCurrency(r.avgTicket) : '—'}</td>
                <td className="text-right py-2.5">
                  <span className={`text-[11px] font-semibold ${r.conversionPct >= 5 ? 'text-emerald-400' : r.conversionPct >= 2 ? 'text-amber-400' : 'text-zinc-500'}`}>
                    {r.conversionPct}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  )
}

function MonthlySeriesChart({ data }: { data: BiInsights['monthlySeries'] }) {
  return (
    <GlassCard>
      <p className="text-sm font-semibold text-zinc-200 mb-4">Série Mensal — Leads vs Vendas vs VGV</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="month" tick={{ fill: TICK, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fill: TICK, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: TICK, fontSize: 10 }} axisLine={false} tickLine={false}
            tickFormatter={v => v >= 1_000_000 ? `R$${(v / 1_000_000).toFixed(0)}M` : `R$${(v / 1_000).toFixed(0)}K`} width={52} />
          <Tooltip content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const p = payload[0]?.payload as Record<string, unknown>
            return (
              <div className="bg-[#1a1a1d] border border-zinc-700 rounded-xl p-3 text-xs shadow-2xl">
                <p className="text-zinc-300 font-semibold mb-2">{label}</p>
                <p className="text-zinc-400">Leads: <span className="text-white font-semibold">{p.leads as number}</span></p>
                <p className="text-zinc-400">Vendas: <span className="text-emerald-400 font-semibold">{p.sales as number}</span></p>
                <p className="text-zinc-400">VGV: <span className="text-white font-semibold">{formatCurrency(p.vgv as number)}</span></p>
              </div>
            )
          }} />
          <Legend wrapperStyle={{ color: TICK, fontSize: 11 }} />
          <Bar yAxisId="left" dataKey="leads" name="Leads" fill={PALETTE[0]} radius={[2, 2, 0, 0]} />
          <Bar yAxisId="left" dataKey="sales" name="Vendas" fill={PALETTE[3]} radius={[2, 2, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="vgv" name="VGV" stroke={PALETTE[2]} strokeWidth={2} dot={false} />
        </BarChart>
      </ResponsiveContainer>
    </GlassCard>
  )
}

function AttributionFunnelChart() {
  const stages = [
    { name: 'Impressões', value: 100, color: '#0ea5e9' },
    { name: 'Cliques', value: 30, color: '#22d3ee' },
    { name: 'Leads', value: 10, color: '#a855f7' },
    { name: 'Vendas', value: 2, color: '#10b981' },
  ]
  return (
    <GlassCard>
      <p className="text-sm font-semibold text-zinc-200 mb-4">Funil de Atribuição — Impressão → Venda</p>
      <div className="flex items-end justify-center gap-3 h-44">
        {stages.map((s, i) => {
          const h = Math.max((s.value / stages[0].value) * 100, 5)
          return (
            <div key={s.name} className="flex flex-col items-center gap-2">
              <span className="text-[10px] text-zinc-500 font-medium">{s.value.toLocaleString('pt-BR')}</span>
              <div
                className="w-16 rounded-t-lg transition-all duration-500"
                style={{ height: `${h}%`, background: s.color, opacity: 1 - i * 0.12 }}
              />
              <span className="text-[10px] text-zinc-400 text-center max-w-[80px] leading-tight">{s.name}</span>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}

export default function BiView() {
  const [data, setData] = useState<BiInsights | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/bi/insights')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      logger.error({ e }, '[BiView] fetch error:')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [fetchData])

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: '60vh' }}>
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <div className="absolute inset-0 rounded-full border-2 border-t-sky-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        </div>
        <p className="text-[15px] font-medium text-zinc-300">Carregando BI Insights</p>
        <p className="text-[13px] text-zinc-500">Compilando dados do Star Schema…</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: '60vh' }}>
        <Activity size={40} className="text-zinc-600" />
        <p className="text-[15px] font-medium text-zinc-300">Nenhum dado disponível</p>
        <p className="text-[13px] text-zinc-500">Execute o ETL (sync-bi) para popular o Star Schema.</p>
      </div>
    )
  }

  const { summary } = data

  return (
    <div className="flex flex-col gap-5 sm:gap-6">

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <KpiCard icon={Users} label="Total de Leads" value={formatNumber(summary.totalLeads)}
          sub="Na base" color="#0ea5e9" />
        <KpiCard icon={ShoppingCart} label="Vendas Realizadas" value={formatNumber(summary.totalSales)}
          sub={`${summary.leadsWithSale} leads converteram`} color="#10b981" />
        <KpiCard icon={DollarSign} label="VGV Total" value={summary.totalVGV > 0 ? formatCurrency(summary.totalVGV) : 'R$ 0'}
          sub="Valor total vendido" color="#f59e0b" />
        <KpiCard icon={Target} label="Ticket Médio" value={summary.avgTicket > 0 ? formatCurrency(summary.avgTicket) : '—'}
          sub="VGV ÷ Vendas" color="#a855f7" />
      </div>

      {/* KPIs secundários */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
        <KpiCard icon={Clock} label="Tempo Médio Conversão"
          value={summary.avgConversionDays > 0 ? `${summary.avgConversionDays} dias` : '—'}
          sub="Lead → Venda" color="#06b6d4" />
        <KpiCard icon={TrendingUp} label="CPL (Custo por Lead)"
          value={summary.cpl > 0 ? formatCurrency(summary.cpl) : '—'}
          sub="Gasto total ÷ Leads" color="#f43f5e" />
        <KpiCard icon={BarChart3} label="ROAS"
          value={summary.roas > 0 ? `${summary.roas.toFixed(1)}x` : '—'}
          sub="Receita ÷ Gasto" color={summary.roas >= 2 ? '#10b981' : '#f59e0b'} />
      </div>

      {/* Funil + Tempo conversão */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <FunnelChart data={data.funnel} />
        <ConversionTimeChart data={data.conversionTime} />
      </div>

      {/* Attribution Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AttributionFunnelChart />
        <MonthlySeriesChart data={data.monthlySeries} />
      </div>

      {/* Tabela por empreendimento */}
      <PerDevelopmentTable data={data.perDevelopment} />

      {/* Campanhas */}
      <CampaignTable data={data.campaignAttribution} />

      <p className="text-[10px] text-zinc-700 text-center">
        Última sincronização BI: {new Date(data.syncedAt).toLocaleString('pt-BR')}
      </p>
    </div>
  )
}
