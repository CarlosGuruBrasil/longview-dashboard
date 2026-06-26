'use client'

import { useMemo, useState } from 'react'
import {
  Users, DollarSign, MapPin, Banknote, TrendingUp,
  Target, Home, BarChart2, ArrowUp, ArrowDown, Minus,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import SocialPanel from '../ui/SocialPanel'
import { useData } from '../../context/DataContext'
import {
  isSale, getOrigin, getLeadValueNumber, getReservaValueNumber, getLeadDate, toISODate,
} from '../../utils/leads'
import { formatCurrency, MONTHS_PT, CHART_PALETTE } from '../../utils/formatters'
import GlassCard from '../ui/GlassCard'

// ── Constantes ────────────────────────────────────────────────────────────────
const TICK = '#71717a'
const GRID = 'rgba(255,255,255,0.05)'
const YEAR_COLORS = ['#0ea5e9', '#a855f7', '#f59e0b', '#10b981', '#f43f5e']
const EMP_COLORS  = ['#0ea5e9', '#a855f7', '#f59e0b', '#10b981', '#f43f5e', '#64748b']

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayISO() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

function empName(lead: { empreendimento?: { id: number; nome: string }[] }) {
  return lead.empreendimento?.[0]?.nome ?? 'Sem empreendimento'
}

function delta(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0
  return Math.round(((curr - prev) / prev) * 100)
}

function formatK(v: number) {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `R$${Math.round(v / 1_000)}k`
  return formatCurrency(v)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiTile({
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
            {trend > 0 ? <ArrowUp size={11} /> : trend < 0 ? <ArrowDown size={11} /> : <Minus size={11} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{value}</p>
      {sub && <p className="text-[11px] text-zinc-500 truncate">{sub}</p>}
    </div>
  )
}

// ── Gráfico comparativo multi-ano ─────────────────────────────────────────────
function MultiYearChart({
  title, leads, valueKey, yLabel, extractValue,
}: {
  title: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leads: any[]
  valueKey: 'count' | 'vgv'
  yLabel: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractValue: (lead: any) => number
}) {
  // Agrupa por ano/mês
  const { data, years, emps } = useMemo(() => {
    const byYM: Record<number, Record<number, { count: number; vgv: number; emps: Record<string, { count: number; vgv: number }> }>> = {}
    const empSet = new Set<string>()
    leads.forEach((lead: any) => {
      const iso = toISODate(getLeadDate(lead))
      if (!iso) return
      const [yS, mS] = iso.split('-')
      const y = parseInt(yS), m = parseInt(mS) - 1
      if (isNaN(y) || isNaN(m)) return
      if (!byYM[y]) byYM[y] = {}
      if (!byYM[y][m]) byYM[y][m] = { count: 0, vgv: 0, emps: {} }
      const val = extractValue(lead)
      byYM[y][m].count++
      byYM[y][m].vgv += val
      const en = empName(lead as any)
      empSet.add(en)
      if (!byYM[y][m].emps[en]) byYM[y][m].emps[en] = { count: 0, vgv: 0 }
      byYM[y][m].emps[en].count++
      byYM[y][m].emps[en].vgv += val
    })
    const years = Object.keys(byYM).map(Number).sort()
    const emps = Array.from(empSet)
    const data = MONTHS_PT.map((label, i) => {
      const entry: Record<string, unknown> = { label }
      years.forEach(y => {
        entry[`${y}_count`] = byYM[y]?.[i]?.count ?? 0
        entry[`${y}_vgv`]   = byYM[y]?.[i]?.vgv   ?? 0
        entry[`${y}_emps`]  = byYM[y]?.[i]?.emps   ?? {}
      })
      return entry
    })
    return { data, years, emps }
  }, [leads, extractValue])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-[#1a1a1d] border border-zinc-700 rounded-xl p-3 text-xs min-w-[180px] shadow-2xl">
        <p className="text-zinc-300 font-semibold mb-2">{label}</p>
        {payload.map((p: any) => {
          const year = p.dataKey.split('_')[0]
          const empData: Record<string, { count: number; vgv: number }> = p.payload[`${year}_emps`] ?? {}
          return (
            <div key={p.dataKey} className="mb-2">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="font-semibold text-white">{year}</span>
                <span className="text-zinc-400 ml-auto">{valueKey === 'vgv' ? formatK(p.value) : `${p.value} venda${p.value !== 1 ? 's' : ''}`}</span>
              </div>
              {Object.entries(empData).filter(([, v]) => (valueKey === 'count' ? v.count : v.vgv) > 0).map(([name, v], i) => (
                <div key={name} className="flex justify-between pl-3.5 text-zinc-500 text-[10px]">
                  <span className="truncate max-w-[100px]">{name}</span>
                  <span>{valueKey === 'vgv' ? formatK(v.vgv) : v.count}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <GlassCard>
      <p className="text-sm font-semibold text-zinc-200 mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="label" tick={{ fill: TICK, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: TICK, fontSize: 11 }} axisLine={false} tickLine={false}
            tickFormatter={v => valueKey === 'vgv' ? formatK(v) : String(v)}
            width={valueKey === 'vgv' ? 52 : 28} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: TICK, paddingTop: 8 }} />
          {years.map((y, i) => (
            <Line key={y} type="monotone" dataKey={`${y}_${valueKey}`} name={String(y)}
              stroke={YEAR_COLORS[i % YEAR_COLORS.length]} strokeWidth={2}
              dot={{ r: 3, fill: YEAR_COLORS[i % YEAR_COLORS.length] }} activeDot={{ r: 5 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </GlassCard>
  )
}

// ── Funil / Pirâmide ──────────────────────────────────────────────────────────
function FunnelChart({ data }: { data: { name: string; value: number }[] }) {
  const max = data[0]?.value || 1
  const colors = ['#0ea5e9', '#22d3ee', '#a855f7', '#f59e0b', '#10b981', '#f43f5e', '#64748b', '#ec4899']

  return (
    <GlassCard>
      <p className="text-sm font-semibold text-zinc-200 mb-4">Funil de Leads por Etapa</p>
      <div className="space-y-2">
        {data.map((item, i) => {
          const pct = Math.round((item.value / max) * 100)
          const convPct = i === 0 ? 100 : Math.round((item.value / data[0].value) * 100)
          return (
            <div key={item.name} className="flex items-center gap-3 group">
              <span className="text-[11px] text-zinc-500 w-5 text-right shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-zinc-300 truncate">{item.name}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {i > 0 && <span className="text-[10px] text-zinc-600">{convPct}%</span>}
                    <span className="text-xs font-semibold text-white">{item.value}</span>
                  </div>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}


// ── Leads do Dia por Empreendimento ──────────────────────────────────────────
function LeadsTodayRow({ allLeads }: { allLeads: any[] }) {
  const today = todayISO()
  const todayLeads = useMemo(
    () => allLeads.filter(l => (l.data_cad || '').startsWith(today)),
    [allLeads, today]
  )
  const byEmp = useMemo(() => {
    const map = new Map<string, number>()
    todayLeads.forEach(l => {
      const n = empName(l)
      map.set(n, (map.get(n) ?? 0) + 1)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [todayLeads])

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-zinc-200">Leads de hoje</p>
        <span className="text-xs font-bold text-emerald-400">{todayLeads.length} total</span>
      </div>
      {todayLeads.length === 0 ? (
        <p className="text-xs text-zinc-600 py-4 text-center">Nenhum lead gerado hoje ainda</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {byEmp.map(([name, count], i) => (
            <div key={name} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04]">
              <Home size={12} style={{ color: EMP_COLORS[i % EMP_COLORS.length] }} />
              <span className="text-xs text-zinc-300 font-medium">{name}</span>
              <span className="text-sm font-bold text-white">{count}</span>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  )
}

// ── Tabela por Empreendimento ─────────────────────────────────────────────────
function EmpTable({ leads, spend }: { leads: any[]; spend: number }) {
  const rows = useMemo(() => {
    const map = new Map<string, { leads: number; visitas: number; reservas: number; vendas: number; vgv: number }>()
    leads.forEach(l => {
      const n = empName(l)
      if (!map.has(n)) map.set(n, { leads: 0, visitas: 0, reservas: 0, vendas: 0, vgv: 0 })
      const r = map.get(n)!
      r.leads++
      const s = (l.situacao?.nome ?? '').toLowerCase()
      if (s.includes('visita')) r.visitas++
      if (s.includes('reserva')) r.reservas++
      if (isSale(l)) { r.vendas++; r.vgv += getLeadValueNumber(l) }
    })
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v, conv: v.leads > 0 ? Math.round((v.vendas / v.leads) * 100) : 0 }))
      .sort((a, b) => b.leads - a.leads)
  }, [leads])

  const totalLeads = rows.reduce((s, r) => s + r.leads, 0)
  const cpl = spend > 0 && totalLeads > 0 ? spend / totalLeads : 0

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-zinc-200">Por empreendimento — período selecionado</p>
        {cpl > 0 && (
          <span className="text-[11px] text-zinc-400">
            CPL médio: <span className="text-white font-semibold">{formatCurrency(cpl)}</span>
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-500 border-b border-white/[0.06]">
              <th className="text-left pb-2 font-medium">Empreendimento</th>
              <th className="text-right pb-2 font-medium">Leads</th>
              <th className="text-right pb-2 font-medium">Visitas</th>
              <th className="text-right pb-2 font-medium">Reservas</th>
              <th className="text-right pb-2 font-medium">Vendas</th>
              <th className="text-right pb-2 font-medium">Conv.</th>
              <th className="text-right pb-2 font-medium">VGV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((r, i) => (
              <tr key={r.name} className="hover:bg-white/[0.03] transition-colors">
                <td className="py-2.5 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: EMP_COLORS[i % EMP_COLORS.length] }} />
                    <span className="text-zinc-200 font-medium">{r.name}</span>
                  </div>
                </td>
                <td className="text-right py-2.5 text-zinc-100 font-semibold">{r.leads}</td>
                <td className="text-right py-2.5 text-zinc-400">{r.visitas}</td>
                <td className="text-right py-2.5 text-zinc-400">{r.reservas}</td>
                <td className="text-right py-2.5 text-emerald-400 font-semibold">{r.vendas}</td>
                <td className="text-right py-2.5">
                  <span className={`text-[11px] font-semibold ${r.conv >= 5 ? 'text-emerald-400' : r.conv >= 2 ? 'text-amber-400' : 'text-zinc-500'}`}>
                    {r.conv}%
                  </span>
                </td>
                <td className="text-right py-2.5 text-zinc-300">{r.vgv > 0 ? formatK(r.vgv) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  )
}

// ── Leads por Mídia ───────────────────────────────────────────────────────────
function MediaBreakdown({ leads }: { leads: any[] }) {
  const data = useMemo(() => {
    const map = new Map<string, number>()
    leads.forEach(l => {
      const o = getOrigin(l)
      map.set(o, (map.get(o) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7)
  }, [leads])

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <GlassCard>
      <p className="text-sm font-semibold text-zinc-200 mb-4">Leads por Mídia — período</p>
      <div className="space-y-2">
        {data.map((item, i) => (
          <div key={item.name} className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-400 w-28 truncate shrink-0">{item.name}</span>
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.round((item.value / total) * 100)}%`, background: CHART_PALETTE[i % CHART_PALETTE.length] }} />
            </div>
            <span className="text-xs font-semibold text-white w-6 text-right shrink-0">{item.value}</span>
            <span className="text-[10px] text-zinc-600 w-8 text-right shrink-0">{Math.round((item.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DashboardView() {
  const { filteredLeads, allLeads, crmTotal, loading, metaData, metaPage, dateRange } = useData()

  const salesLeads   = useMemo(() => filteredLeads.filter(isSale), [filteredLeads])
  const reservaLeads = useMemo(() => filteredLeads.filter(l => l.situacao?.nome?.toLowerCase() === 'com reserva'), [filteredLeads])
  const visitLeads   = useMemo(() => filteredLeads.filter(l => l.situacao?.nome?.toLowerCase().includes('visita')), [filteredLeads])

  const totalVGV     = useMemo(() => salesLeads.reduce((s, l) => s + getLeadValueNumber(l), 0), [salesLeads])
  const totalResVGV  = useMemo(() => reservaLeads.reduce((s, l) => s + getReservaValueNumber(l), 0), [reservaLeads])
  const ticketMedio  = salesLeads.length > 0 ? totalVGV / salesLeads.length : 0
  const spend        = Number(metaData?.global?.spend ?? 0)
  const cpl          = spend > 0 && filteredLeads.length > 0 ? spend / filteredLeads.length : 0

  // Funil ordenado por rank de etapa (maior pipeline primeiro)
  const funnelData = useMemo(() => {
    const map = new Map<string, number>()
    filteredLeads.forEach(l => {
      const s = l.situacao?.nome || 'Sem etapa'
      map.set(s, (map.get(s) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredLeads])

  if (loading && allLeads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: '60vh' }}>
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <div className="absolute inset-0 rounded-full border-2 border-t-sky-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        </div>
        <p className="text-[15px] font-medium text-zinc-300">Carregando dados</p>
        <p className="text-[13px] text-zinc-500">Buscando leads e vendas do CRM…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">

      {/* ── KPIs principais ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <KpiTile icon={Users}     label="Leads no período"   value={filteredLeads.length}
          sub={`de ${crmTotal.toLocaleString('pt-BR')} na base`} color="#0ea5e9" />
        <KpiTile icon={MapPin}    label="Visitas realizadas" value={visitLeads.length}     color="#f59e0b" />
        <KpiTile icon={Banknote}  label="Reservas ativas"   value={reservaLeads.length}
          sub={`VGV ${formatK(totalResVGV)}`} color="#a855f7" />
        <KpiTile icon={TrendingUp} label="Vendas realizadas" value={salesLeads.length}
          sub={`VGV ${formatK(totalVGV)}`} color="#10b981" />
      </div>

      {/* ── KPIs secundários ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
        <KpiTile icon={DollarSign} label="VGV vendido" value={formatK(totalVGV)}          color="#10b981" />
        <KpiTile icon={Target}     label="Custo por lead (CPL)"
          value={cpl > 0 ? formatCurrency(cpl) : '—'}
          sub={spend > 0 ? `Investimento: ${formatCurrency(spend)}` : 'Sem dados de investimento'}
          color="#f43f5e" />
        <KpiTile icon={TrendingUp} label="Ticket médio"
          value={ticketMedio > 0 ? formatK(ticketMedio) : '—'}
          sub="VGV ÷ vendas" color="#64748b" />
      </div>

      {/* ── Leads de hoje ── */}
      <LeadsTodayRow allLeads={allLeads} />

      {/* ── Tabela por empreendimento ── */}
      <EmpTable leads={filteredLeads} spend={spend} />

      {/* ── Gráfico comparativo de vendas (multi-ano) ── */}
      <MultiYearChart
        title="Vendas realizadas — comparativo por ano (VGV)"
        leads={allLeads.filter(isSale)}
        valueKey="vgv"
        yLabel="VGV"
        extractValue={getLeadValueNumber}
      />

      {/* ── Gráfico comparativo de leads (multi-ano) ── */}
      <MultiYearChart
        title="Leads gerados — comparativo por ano"
        leads={allLeads}
        valueKey="count"
        yLabel="Leads"
        extractValue={() => 0}
      />

      {/* ── Funil + Mídia ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <FunnelChart data={funnelData} />
        <MediaBreakdown leads={filteredLeads} />
      </div>

      {/* ── Redes Sociais ── */}
      <SocialPanel />

    </div>
  )
}
