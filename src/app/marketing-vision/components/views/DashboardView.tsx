'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Info,
  Lightbulb, Users, DollarSign, Target, Clock, ShoppingCart,
  BarChart3, Activity, Globe,
} from 'lucide-react'
import {
  Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useData } from '../../context/DataContext'
import { generateInsights, type Insight } from '../../utils/insights'
import { isSale, getLeadValueNumber } from '../../utils/leads'
import { formatCurrency, formatNumber } from '../../utils/formatters'
import GlassCard from '../ui/GlassCard'
import FilterBar from '../ui/FilterBar'
import type { BiInsights } from '../../types'

const TICK = '#71717a'
const GRID = 'rgba(255,255,255,0.05)'
const PALETTE = ['#0ea5e9', '#a855f7', '#f59e0b', '#10b981', '#f43f5e', '#64748b', '#06b6d4', '#ec4899']

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatK(v: number) {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `R$${Math.round(v / 1_000)}k`
  return formatCurrency(v)
}

// ── Alert Card ─────────────────────────────────────────────────────────────────

function AlertCard({ insight }: { insight: Insight }) {
  const colors = {
    critical: { border: '#ef4444', bg: 'rgba(239,68,68,0.08)', icon: AlertTriangle, iconColor: '#ef4444' },
    warning: { border: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: AlertTriangle, iconColor: '#f59e0b' },
    positive: { border: '#10b981', bg: 'rgba(16,185,129,0.08)', icon: CheckCircle2, iconColor: '#10b981' },
    info: { border: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', icon: Info, iconColor: '#0ea5e9' },
  }
  const c = colors[insight.type]

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2.5 border"
      style={{ background: c.bg, borderColor: c.border }}
    >
      <div className="flex items-start gap-2.5">
        <c.icon size={18} style={{ color: c.iconColor, marginTop: 1 }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{insight.title}</p>
          {insight.description && (
            <p className="text-xs text-zinc-400 mt-0.5">{insight.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-start gap-2 pl-[26px]">
        <Lightbulb size={13} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-300 leading-relaxed">{insight.action}</p>
      </div>
    </div>
  )
}

function NoTrendIcon() { return null }

// ── KPI Card with comparison ───────────────────────────────────────────────────

function SmartKpi({
  icon: Icon, label, value, sub, color, trend, trendLabel, vsPrev, vsPrevValue,
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string
  trend?: 'up' | 'down' | 'stable'
  trendLabel?: string
  vsPrev?: number
  vsPrevValue?: string
}) {
  const trendColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#71717a'
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : NoTrendIcon

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 sm:p-5 flex flex-col gap-2 relative overflow-hidden min-w-0">
      <div className="flex items-center justify-between min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}20` }}>
            <Icon size={15} style={{ color }} />
          </div>
          <span className="text-[12px] text-zinc-400 font-medium truncate">{label}</span>
        </div>
        {trend && (
          <span className="flex items-center gap-0.5 text-[11px] font-semibold shrink-0" style={{ color: trendColor }}>
            <TrendIcon size={11} />
            {trendLabel}
          </span>
        )}
      </div>
      <p className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white truncate" title={String(value)}>{value}</p>
      {sub && <p className="text-[11px] text-zinc-500 truncate" title={sub}>{sub}</p>}
      {vsPrev !== undefined && (
        <div className="flex items-center gap-2 text-[10px] text-zinc-600 mt-0.5">
          <span>vs mês passado:</span>
          <span className={vsPrev >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            {vsPrev >= 0 ? '+' : ''}{vsPrev}%
          </span>
          {vsPrevValue && <span className="text-zinc-500">({vsPrevValue})</span>}
        </div>
      )}
    </div>
  )
}

// ── Social Media Card ──────────────────────────────────────────────────────────

function SocialMediaCard({ metaData }: { metaData: import('../../types').MetaData | null }) {
  const page = metaData?.page
  const global = metaData?.global
  const daily = metaData?.daily ?? []

  const recentDaily = daily.slice(-7)
  const avgReach = recentDaily.length > 0
    ? recentDaily.reduce((s, d) => s + (parseInt(d.reach ?? '0')), 0) / recentDaily.length
    : 0
  const totalImpressions = recentDaily.reduce((s, d) => s + (parseInt(d.impressions ?? '0')), 0)
  const totalClicks = recentDaily.reduce((s, d) => s + (parseInt(d.clicks ?? '0')), 0)
  const ctr = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 100) : 0

  const health = []
  if (page?.fan_count) health.push({ label: 'Seguidores FB', value: formatNumber(page.fan_count), status: 'ok' as const })
  if (page?.followers_count) health.push({ label: 'Seguidores IG', value: formatNumber(page.followers_count), status: 'ok' as const })
  if (avgReach > 0) health.push({ label: 'Alcance médio/dia', value: formatNumber(Math.round(avgReach)), status: 'ok' as const })
  health.push({ label: 'CTR últimos 7 dias', value: `${ctr}%`, status: ctr >= 1 ? 'ok' as const : 'warning' as const })

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-zinc-200">Panorama Redes Sociais & Mídia</p>
        <Globe size={15} className="text-zinc-500" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {health.map(h => (
          <div key={h.label} className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{h.label}</span>
            <span className={`text-sm font-bold ${h.status === 'warning' ? 'text-amber-400' : 'text-white'}`}>
              {h.value}
            </span>
          </div>
        ))}
      </div>
      {global?.spend && (
        <div className="mt-4 pt-3 border-t border-white/[0.06]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Gasto total (Meta)</span>
            <span className="text-white font-semibold">{formatCurrency(parseFloat(global.spend))}</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1.5">
            <span className="text-zinc-500">Impressões</span>
            <span className="text-white font-semibold">{formatNumber(parseInt(global.impressions ?? '0'))}</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1.5">
            <span className="text-zinc-500">Cliques</span>
            <span className="text-white font-semibold">{formatNumber(parseInt(global.clicks ?? '0'))}</span>
          </div>
        </div>
      )}
      <div className="mt-3 pt-2 border-t border-white/[0.06]">
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          {ctr >= 1
            ? 'CTR saudável. Publique conteúdo orgânico 3-4x/semana. Responda comentários em até 1h.'
            : 'CTR baixo. Revise criativos e segmentação. Teste diferentes formatos de anúncio.'}
        </p>
      </div>
    </GlassCard>
  )
}

// ── Attribution ROAS Overview ──────────────────────────────────────────────────

function AttributionCard({ bi, leads, spend }: { bi: BiInsights | null; leads: import('../../types').Lead[]; spend: number }) {
  const sales = useMemo(() => leads.filter(isSale), [leads])
  const totalVGV = useMemo(() => sales.reduce((s, l) => s + getLeadValueNumber(l), 0), [sales])
  const totalLeads = leads.length
  const cpl = spend > 0 && totalLeads > 0 ? spend / totalLeads : (bi?.summary.cpl ?? 0)
  const roas = spend > 0 && totalVGV > 0 ? totalVGV / spend : (bi?.summary.roas ?? 0)

  return (
    <GlassCard>
      <p className="text-sm font-semibold text-zinc-200 mb-4">Eficiência de Marketing</p>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>CPL (Custo por Lead)</span>
            <span className="text-white font-semibold">{cpl > 0 ? formatCurrency(cpl) : '—'}</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
              style={{ width: `${Math.min(cpl > 0 ? (80 / cpl) * 50 : 0, 100)}%` }} />
          </div>
          <span className="text-[10px] text-zinc-600 mt-0.5 block">
            {cpl > 80 ? 'Acima da meta (R$80)' : cpl > 0 ? 'Dentro do ideal' : 'Sem dados'}
          </span>
        </div>
        <div>
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>ROAS (Retorno sobre investimento)</span>
            <span className="text-white font-semibold">{roas > 0 ? `${roas.toFixed(1)}x` : '—'}</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
              style={{ width: `${Math.min(roas > 0 ? (roas / 5) * 100 : 0, 100)}%` }} />
          </div>
          <span className="text-[10px] text-zinc-600 mt-0.5 block">
            {roas >= 2 ? 'ROAS saudável (meta: 2x)' : roas > 0 ? 'Abaixo da meta (2x)' : 'Sem dados'}
          </span>
        </div>
        {bi?.campaignAttribution && bi.campaignAttribution.length > 0 && (
          <div className="pt-2">
            <p className="text-[11px] text-zinc-500 mb-2">Top campanhas por ROAS</p>
            <div className="space-y-1.5">
              {[...bi.campaignAttribution]
                .sort((a, b) => b.roas - a.roas)
                .slice(0, 4)
                .map(c => (
                  <div key={c.campaignName} className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-300 truncate max-w-[120px]">{c.campaignName}</span>
                    <span className={`font-semibold ${c.roas >= 2 ? 'text-emerald-400' : c.roas > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>
                      {c.roas > 0 ? `${c.roas.toFixed(1)}x` : '—'}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  )
}

// ── Monthly Series (like the original) ─────────────────────────────────────────

function MonthlyChart({ bi }: { bi: BiInsights | null }) {
  const data = bi?.monthlySeries ?? []
  return (
    <GlassCard>
      <p className="text-sm font-semibold text-zinc-200 mb-4">Série Mensal — Leads vs Vendas vs VGV</p>
      {data.length === 0 ? (
        <p className="text-xs text-zinc-600 py-8 text-center">Sem dados mensais disponíveis</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
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
      )}
    </GlassCard>
  )
}

// ── Development Performance Table ──────────────────────────────────────────────

function DevTable({ bi }: { bi: BiInsights | null }) {
  const data = bi?.perDevelopment ?? []
  return (
    <GlassCard>
      <p className="text-sm font-semibold text-zinc-200 mb-4">Performance por Empreendimento</p>
      {data.length === 0 ? (
        <p className="text-xs text-zinc-600 py-8 text-center">Sem dados de empreendimentos</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-white/[0.06]">
                <th className="text-left pb-2 font-medium">Empreendimento</th>
                <th className="text-right pb-2 font-medium">Leads</th>
                <th className="text-right pb-2 font-medium">Vendas</th>
                <th className="text-right pb-2 font-medium">VGV</th>
                <th className="text-right pb-2 font-medium">Ticket</th>
                <th className="text-right pb-2 font-medium">Conv.</th>
                <th className="text-right pb-2 font-medium">Tendência</th>
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
                  <td className="text-right py-2.5 text-emerald-400 font-semibold">{r.sales}</td>
                  <td className="text-right py-2.5 text-zinc-300">{r.vgv > 0 ? formatK(r.vgv) : '—'}</td>
                  <td className="text-right py-2.5 text-zinc-200 font-semibold">{r.avgTicket > 0 ? formatK(r.avgTicket) : '—'}</td>
                  <td className="text-right py-2.5">
                    <span className={`text-[11px] font-semibold ${r.conversionPct >= 5 ? 'text-emerald-400' : r.conversionPct >= 2 ? 'text-amber-400' : 'text-zinc-500'}`}>
                      {r.conversionPct}%
                    </span>
                  </td>
                  <td className="text-right py-2.5">
                    <span className={`text-[11px] font-semibold ${i === 0 ? 'text-emerald-400' : i === data.length - 1 ? 'text-red-400' : 'text-zinc-500'}`}>
                      {i === 0 ? '▲' : i === data.length - 1 ? '▼' : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function DashboardView() {
  const { allLeads, filteredLeads, crmTotal, loading, metaData } = useData()
  const [biData, setBiData] = useState<BiInsights | null>(null)
  const [, setBiLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/bi/insights')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (active) setBiData(d) })
      .catch(() => {})
      .finally(() => { if (active) setBiLoading(false) })
    return () => { active = false }
  }, [])

  // Compute KPIs
  const salesLeads = useMemo(() => filteredLeads.filter(isSale), [filteredLeads])
  const totalVGV = useMemo(() => salesLeads.reduce((s, l) => s + getLeadValueNumber(l), 0), [salesLeads])
  const ticketMedio = salesLeads.length > 0 ? totalVGV / salesLeads.length : 0
  const spend = Number(metaData?.global?.spend ?? 0)
  const cpl = spend > 0 && filteredLeads.length > 0 ? spend / filteredLeads.length : 0
  const roas = spend > 0 && totalVGV > 0 ? totalVGV / spend : 0

  // Generate AI insights
  const insights = useMemo(() => generateInsights(biData, allLeads, metaData), [biData, allLeads, metaData])

  const criticalInsights = insights.filter(i => i.type === 'critical')
  const warningInsights = insights.filter(i => i.type === 'warning')
  const positiveInsights = insights.filter(i => i.type === 'positive')

  if (loading && allLeads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: '60vh' }}>
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <div className="absolute inset-0 rounded-full border-2 border-t-sky-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        </div>
        <p className="text-[15px] font-medium text-zinc-300">Carregando Smart Dashboard</p>
        <p className="text-[13px] text-zinc-500">Processando dados e gerando insights…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">

      {/* ── Filtros ── */}
      <FilterBar />

      {/* ── Alertas Inteligentes ── */}
      {insights.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-zinc-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Insights Inteligentes
            </span>
            <span className="text-[10px] text-zinc-700">
              ({criticalInsights.length} crítico{criticalInsights.length !== 1 ? 's' : ''}, {warningInsights.length} atenção, {positiveInsights.length} positivo{positiveInsights.length !== 1 ? 's' : ''})
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {insights.slice(0, 4).map((insight, i) => (
              <AlertCard key={i} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* ── KPIs Principais com Comparação ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <SmartKpi
          icon={Users} label="Leads" value={formatNumber(filteredLeads.length)}
          sub={`${formatNumber(crmTotal)} na base`} color="#0ea5e9"
          trend={biData && filteredLeads.length > (biData.monthlySeries?.slice(-2)?.[0]?.leads ?? 0) ? 'up' : 'down'}
        />
        <SmartKpi
          icon={ShoppingCart} label="Vendas" value={formatNumber(salesLeads.length)}
          sub={`${totalVGV > 0 ? formatK(totalVGV) : 'R$ 0'} VGV`} color="#10b981"
          trend={salesLeads.length > 0 ? 'up' : 'stable'}
          trendLabel={salesLeads.length > 0 ? `${salesLeads.length} fechadas` : undefined}
        />
        <SmartKpi
          icon={Target} label="Ticket Médio" value={ticketMedio > 0 ? formatK(ticketMedio) : '—'}
          sub="VGV ÷ vendas" color="#a855f7"
          trend={ticketMedio > (biData?.summary.avgTicket ?? 0) ? 'up' : ticketMedio < (biData?.summary.avgTicket ?? 0) ? 'down' : 'stable'}
        />
        <SmartKpi
          icon={DollarSign} label="ROAS" value={roas > 0 ? `${roas.toFixed(1)}x` : '—'}
          sub={roas >= 2 ? 'Acima da meta (2x)' : roas > 0 ? 'Abaixo da meta (2x)' : 'Sem dados'}
          color={roas >= 2 ? '#10b981' : '#f59e0b'}
          trend={roas >= 2 ? 'up' : roas > 0 ? 'down' : 'stable'}
        />
      </div>

      {/* ── KPIs Secundários ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <SmartKpi
          icon={TrendingUp} label="VGV Total" value={totalVGV > 0 ? formatK(totalVGV) : 'R$ 0'}
          sub="Valor total vendido" color="#f59e0b"
        />
        <SmartKpi
          icon={BarChart3} label="CPL" value={cpl > 0 ? formatCurrency(cpl) : '—'}
          sub={spend > 0 ? `Investimento: ${formatCurrency(spend)}` : 'Sem dados'}
          color="#f43f5e"
          trend={cpl > 0 && cpl <= 80 ? 'up' : 'down'}
          trendLabel={cpl > 0 && cpl <= 80 ? 'eficiente' : 'elevado'}
        />
        <SmartKpi
          icon={Clock} label="Temp. Conversão"
          value={biData?.summary.avgConversionDays ? `${biData.summary.avgConversionDays}d` : '—'}
          sub="Lead → Venda" color="#06b6d4"
          trend={biData?.summary.avgConversionDays && biData.summary.avgConversionDays <= 30 ? 'up' : 'down'}
          trendLabel={biData?.summary.avgConversionDays && biData.summary.avgConversionDays <= 30 ? 'rápido' : 'lento'}
        />
        <SmartKpi
          icon={Activity} label="Taxa Conversão"
          value={biData?.summary.totalLeads ? `${Math.round((biData.summary.totalSales / biData.summary.totalLeads) * 100)}%` : '—'}
          sub="Meta: 3%" color="#0ea5e9"
          trend={biData?.summary.totalLeads && (biData.summary.totalSales / biData.summary.totalLeads) >= 0.03 ? 'up' : 'down'}
        />
      </div>

      {/* ── Social Media + Attribution ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SocialMediaCard metaData={metaData} />
        <AttributionCard bi={biData} leads={filteredLeads} spend={spend} />
      </div>

      {/* ── Monthly Chart + Dev Table ── */}
      <MonthlyChart bi={biData} />
      <DevTable bi={biData} />

      {/* ── All insights (collapsible) ── */}
      {insights.length > 4 && (
        <details className="group">
          <summary className="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400 transition-colors select-none">
            Ver todos os {insights.length} insights
          </summary>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 mt-3">
            {insights.slice(4).map((insight, i) => (
              <AlertCard key={i} insight={insight} />
            ))}
          </div>
        </details>
      )}

      <p className="text-[10px] text-zinc-700 text-center">
        Smart Dashboard · Dados em tempo real · Insights gerados por engine analítica
      </p>
    </div>
  )
}
