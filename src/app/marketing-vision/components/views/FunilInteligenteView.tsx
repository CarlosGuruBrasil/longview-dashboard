'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  GitMerge, DollarSign, Users, TrendingUp, Clock, ShoppingBag,
  AlertTriangle, ArrowRight, RefreshCw, Award, Target,
  BarChart3, ArrowDown, CheckCircle2, XCircle, Calendar, Database
} from 'lucide-react'
import { useData } from '../../context/DataContext'
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters'
import GlassCard from '../ui/GlassCard'
import DataTable from '../ui/DataTable'
import type { FunilIntelligenceData } from '../../types'


// ── Formatadores locais ──────────────────────────────────────────────────────

function fmtK(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}k`
  return formatCurrency(v)
}

function CycleBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-zinc-600 text-xs">—</span>
  let color = '#10b981', label = '⚡ Rápido'
  if (days > 90) { color = '#a855f7'; label = '🕐 Longo' }
  else if (days > 30) { color = '#f59e0b'; label = '⏱ Médio' }
  return (
    <span className="text-xs font-semibold" style={{ color }}>
      {days === 0 ? 'Mesmo dia' : `${days}d`} <span className="text-[10px] opacity-70">{label}</span>
    </span>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KPI({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex flex-col gap-2"
      style={{ backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 100%)' }}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
          <Icon size={15} style={{ color }} />
        </div>
        <span className="text-[12px] text-zinc-400 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight text-white">{value}</p>
      {sub && <p className="text-[11px] text-zinc-500">{sub}</p>}
    </div>
  )
}

// ── Funil Step Bar ────────────────────────────────────────────────────────────

function FunnelStep({ label, value, percentage, color, isLast }: {
  label: string; value: number; percentage: number; color: string; isLast?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-zinc-200">{label}</span>
        <span className="font-bold text-white">{formatNumber(value)} <span className="text-zinc-400 font-normal">({percentage}%)</span></span>
      </div>
      <div className="h-3 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${percentage}%`, backgroundColor: color }} />
      </div>
      {!isLast && (
        <div className="flex justify-center">
          <ArrowDown size={14} className="text-zinc-700" />
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FunilInteligenteView() {
  const { setActiveView, setLeadFilters, leadFilters, loading: ctxLoading } = useData()
  const [data, setData] = useState<FunilIntelligenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncingVendas, setSyncingVendas] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'data'>('dashboard')
  const [dataSubTab, setDataSubTab] = useState<'origin' | 'emp' | 'corretores' | 'monthly'>('origin')


  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cv/funil-intelligence')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function syncVendas() {
    setSyncingVendas(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/cv/vendas?refresh=true')
      const json = await res.json()
      setSyncMsg(`✅ ${json.total ?? 0} reservas/vendas sincronizadas do CV CRM.`)
      await fetchData()
    } catch (e: unknown) {
      setSyncMsg(`❌ Erro: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSyncingVendas(false)
    }
  }

  useEffect(() => { void fetchData() }, [])

  const hasVendas = (data?.summary?.totalReservas ?? 0) > 0

  if (loading || ctxLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: '60vh' }}>
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <div className="absolute inset-0 rounded-full border-2 border-t-emerald-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        </div>
        <p className="text-sm font-medium text-zinc-300">Cruzando funis de Leads e Reservas…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header com sync ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <GitMerge size={18} className="text-emerald-400" />
            Funil Inteligente — Leads × Reservas × Vendas
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Cruzamento completo entre o Funil de Leads e o Funil de Reservas do CV CRM
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncVendas}
            disabled={syncingVendas}
            className="flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={syncingVendas ? 'animate-spin' : ''} />
            {syncingVendas ? 'Sincronizando…' : 'Sincronizar Reservas'}
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-medium border border-white/10 bg-white/[0.04] text-zinc-400 hover:text-zinc-100 transition-all disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Mensagem de sync ── */}
      {syncMsg && (
        <div className={`px-4 py-2.5 rounded-xl text-xs border ${
          syncMsg.startsWith('✅')
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {syncMsg}
        </div>
      )}

      {/* Abas Superiores - Estilo Adidas */}
      <div className="flex border-b border-white/10 -mb-px">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
            activeTab === 'dashboard'
              ? 'border-sky-500 text-sky-400 bg-sky-500/10'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
          }`}
        >
          Painel de Análise
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === 'data'
              ? 'border-sky-500 text-sky-400 bg-sky-500/10'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
          }`}
        >
          <Database size={14} /> Tabela de Dados
        </button>
      </div>

      {activeTab === 'dashboard' ? (
        <>
          {/* ── Aviso: sem dados de vendas ── */}
          {!hasVendas && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-4 flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-300">Nenhuma reserva sincronizada ainda</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Clique em <strong>&quot;Sincronizar Reservas&quot;</strong> acima para importar as reservas e vendas do CV CRM.
                  Os cruzamentos de VGV, ciclo de venda e performance de corretores ficarão disponíveis após a sincronização.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-2.5 rounded-xl">
              ⚠ {error}
            </div>
          )}

          {/* ── KPIs Principais ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPI icon={Users} label="Total de Leads" value={formatNumber(data?.summary.totalLeads ?? 0)} sub="Funil de Atração" color="#0ea5e9" />
            <KPI icon={Target} label="Reservas no CVDW" value={formatNumber(data?.summary.totalReservas ?? 0)} sub={`${data?.summary.cancelamentos ?? 0} cancelamentos`} color="#f59e0b" />
            <KPI icon={CheckCircle2} label="Vendas Aprovadas" value={formatNumber(data?.summary.totalVendas ?? 0)} sub={`Taxa: ${data?.summary.conversionRate ?? 0}% sobre leads`} color="#10b981" />
            <KPI icon={DollarSign} label="VGV Total" value={fmtK(data?.summary.totalVgv ?? 0)} sub={`Ticket médio: ${fmtK(data?.summary.avgTicket ?? 0)}`} color="#a855f7" />
          </div>

          {/* ── Funil de Conversão + Ciclo por Empreendimento ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Funil visual */}
            <GlassCard title="Funil de Conversão — De Ponta a Ponta">
              <div className="flex flex-col gap-4 py-2">
                {(data?.steps ?? []).map((step, i, arr) => (
                  <FunnelStep
                    key={step.label}
                    label={step.label}
                    value={step.value}
                    percentage={step.percentage}
                    color={step.color}
                    isLast={i === arr.length - 1}
                  />
                ))}
                {(data?.steps ?? []).length === 0 && (
                  <p className="text-zinc-500 text-sm text-center py-6">Sem dados de funil disponíveis</p>
                )}
              </div>
            </GlassCard>

            {/* Ciclo de venda por empreendimento */}
            <GlassCard title="Ciclo de Venda por Empreendimento (dias Lead → Contrato)">
              <div className="flex flex-col gap-3 max-h-[340px] overflow-y-auto pr-1">
                {(data?.cycleByEmp ?? []).length === 0 ? (
                  <div className="text-center py-8">
                    <Clock size={24} className="text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs text-zinc-500">Sincronize as reservas para ver o ciclo de venda</p>
                  </div>
                ) : (
                  (data?.cycleByEmp ?? []).map(emp => (
                    <div key={emp.empreendimento}
                      className="p-3 rounded-xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.04] cursor-pointer transition-all"
                      onClick={() => setActiveView('vendas')}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-zinc-200 truncate">{emp.empreendimento}</span>
                        <CycleBadge days={emp.avg_days_to_venda} />
                      </div>
                      <div className="flex gap-4 mt-2 text-[11px] text-zinc-500">
                        <span>{emp.leads} leads</span>
                        <span className="text-zinc-700">·</span>
                        <span>{emp.reservas} reservas</span>
                        <span className="text-zinc-700">·</span>
                        <span className="text-emerald-400 font-semibold">{fmtK(emp.vgv)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>

          </div>

          {/* ── VGV por Origem de Mídia ── */}
          <GlassCard title={`VGV por Origem de Captação — Cruzamento Lead × Reserva (${data?.vgvByOrigin.length ?? 0} origens)`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-500 text-xs uppercase font-semibold">
                    <th className="text-left py-3 px-3">Origem / Mídia</th>
                    <th className="text-right py-3 px-3">Leads</th>
                    <th className="text-right py-3 px-3">Reservas</th>
                    <th className="text-right py-3 px-3">VGV Gerado</th>
                    <th className="text-right py-3 px-3">Ticket Médio</th>
                    <th className="text-right py-3 px-3">Conversão</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.vgvByOrigin ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500 text-sm">
                        Sincronize as reservas do CV CRM para ver o VGV por origem
                      </td>
                    </tr>
                  ) : (
                    (data?.vgvByOrigin ?? []).map((row, i) => {
                      const conv = row.leads > 0 ? ((row.reservas / row.leads) * 100).toFixed(1) : '0.0'
                      const COLORS = ['#0ea5e9','#a855f7','#f59e0b','#10b981','#f43f5e','#64748b','#06b6d4','#ec4899']
                      return (
                        <tr
                          key={row.origem}
                          onClick={() => {
                            // Drill-down real: leva o filtro de origem junto pra tela de Leads
                            setLeadFilters({ ...leadFilters, origem: row.origem })
                            setActiveView('leads')
                          }}
                          className="border-b border-white/5 hover:bg-white/[0.04] cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <span className="font-semibold text-zinc-200">{row.origem}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-xs text-zinc-400">{formatNumber(row.leads)}</td>
                          <td className="py-3 px-3 text-right font-bold text-orange-400">{formatNumber(row.reservas)}</td>
                          <td className="py-3 px-3 text-right font-semibold text-emerald-400">{fmtK(row.vgv)}</td>
                          <td className="py-3 px-3 text-right text-zinc-300">{row.reservas > 0 ? fmtK(row.ticket_medio) : '—'}</td>
                          <td className="py-3 px-3 text-right">
                            <span className={`text-xs font-semibold ${Number(conv) > 5 ? 'text-emerald-400' : Number(conv) > 1 ? 'text-amber-400' : 'text-zinc-500'}`}>
                              {conv}%
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* ── Top Corretores por VGV + Série Mensal ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Top Corretores */}
            <GlassCard title="Top Corretores por VGV">
              <div className="flex flex-col gap-3">
                {(data?.topCorretores ?? []).length === 0 ? (
                  <div className="text-center py-8">
                    <Award size={24} className="text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs text-zinc-500">Nenhuma reserva sincronizada ainda</p>
                  </div>
                ) : (
                  (data?.topCorretores ?? []).map((c, i) => {
                    const maxVgv = data!.topCorretores[0]?.vgv ?? 1
                    const pct = maxVgv > 0 ? (c.vgv / maxVgv) * 100 : 0
                    return (
                      <div key={c.corretor} className="flex flex-col gap-1.5 p-3 rounded-xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.04] transition-all cursor-pointer" onClick={() => setActiveView('vendas')}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-zinc-500 w-5">#{i + 1}</span>
                            <span className="text-sm font-semibold text-zinc-200 truncate">{c.corretor}</span>
                          </div>
                          <div className="flex items-center gap-3 text-right">
                            <span className="text-xs font-bold text-emerald-400">{fmtK(c.vgv)}</span>
                            {c.cancelamentos > 0 && (
                              <span className="flex items-center gap-1 text-[11px] text-red-400">
                                <XCircle size={11} /> {c.cancelamentos}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #10b981, #059669)' }} />
                        </div>
                        <div className="flex gap-3 text-[10px] text-zinc-600">
                          <span>{c.reservas} reservas</span>
                          <span>·</span>
                          <span>Ticket: {fmtK(c.ticket_medio)}</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </GlassCard>

            {/* Evolução Mensal */}
            <GlassCard title="Evolução Mensal — Leads & Reservas & VGV">
              <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
                {(data?.monthly ?? []).length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar size={24} className="text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs text-zinc-500">Sem série histórica disponível</p>
                  </div>
                ) : (
                  [...(data?.monthly ?? [])].reverse().slice(0, 12).map(m => {
                    const maxLeads = Math.max(...(data?.monthly ?? []).map(x => x.leads), 1)
                    const leadsW = (m.leads / maxLeads) * 100
                    return (
                      <div key={m.month} className="p-3 rounded-xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.04] transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-zinc-300">{m.month}</span>
                          <div className="flex gap-4 text-[11px]">
                            <span className="text-sky-400">{m.leads}L</span>
                            <span className="text-orange-400">{m.reservas}R</span>
                            {m.vgv > 0 && <span className="text-emerald-400">{fmtK(m.vgv)}</span>}
                          </div>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${leadsW}%`, backgroundColor: '#0ea5e9' }} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </GlassCard>

          </div>
        </>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Sub-abas de dados */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { key: 'origin', label: 'VGV por Origem de Mídia' },
              { key: 'emp', label: 'VGV por Lançamento / Empreendimento' },
              { key: 'corretores', label: 'Desempenho de Corretores' },
              { key: 'monthly', label: 'Evolução Mensal Histórica' },
            ].map(sub => (
              <button
                key={sub.key}
                onClick={() => setDataSubTab(sub.key as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all whitespace-nowrap ${
                  dataSubTab === sub.key
                    ? 'bg-white text-zinc-900 border-transparent'
                    : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          <GlassCard>
            {dataSubTab === 'origin' && (
              <DataTable<any>
                title="VGV e Performance por Origem de Mídia"
                rows={data?.vgvByOrigin || []}
                exportFileName="vgv_por_origem"
                searchFields={['origem']}
                searchPlaceholder="Buscar origem..."
                defaultSortField="vgv"
                columns={[
                  { label: 'Origem de Mídia', field: 'origem' },
                  { label: 'Leads', field: 'leads', align: 'right', render: (row) => formatNumber(row.leads as number) },
                  { label: 'Reservas', field: 'reservas', align: 'right', render: (row) => formatNumber(row.reservas) },
                  { label: 'VGV Comercial', field: 'vgv', align: 'right', render: (row) => formatCurrency(row.vgv), csvValue: (row) => String(row.vgv) },
                  { label: 'Cancelamentos', field: 'cancelamentos', align: 'right', render: (row) => formatNumber(row.cancelamentos) },
                  { label: 'Ticket Médio', field: 'ticket_medio', align: 'right', render: (row) => formatCurrency(row.ticket_medio), csvValue: (row) => String(row.ticket_medio) }
                ]}
              />
            )}

            {dataSubTab === 'emp' && (
              <DataTable<any>
                title="Ciclo e VGV por Empreendimento"
                rows={data?.cycleByEmp || []}
                exportFileName="vgv_por_empreendimento"
                searchFields={['empreendimento']}
                searchPlaceholder="Buscar empreendimento..."
                defaultSortField="vgv"
                columns={[
                  { label: 'Empreendimento', field: 'empreendimento' },
                  { label: 'Ciclo Médio', field: 'avg_days_to_venda', align: 'center', render: (row) => row.avg_days_to_venda != null ? `${row.avg_days_to_venda} dias` : '—' },
                  { label: 'Leads', field: 'leads', align: 'right', render: (row) => formatNumber(row.leads as number) },
                  { label: 'Reservas', field: 'reservas', align: 'right', render: (row) => formatNumber(row.reservas) },
                  { label: 'VGV Comercial', field: 'vgv', align: 'right', render: (row) => formatCurrency(row.vgv), csvValue: (row) => String(row.vgv) },
                  { label: 'Cancelamentos', field: 'cancelamentos', align: 'right', render: (row) => formatNumber(row.cancelamentos) },
                  { label: 'Ticket Médio', field: 'ticket_medio', align: 'right', render: (row) => formatCurrency(row.ticket_medio), csvValue: (row) => String(row.ticket_medio) }
                ]}
              />
            )}

            {dataSubTab === 'corretores' && (
              <DataTable<any>
                title="Top Corretores por VGV Comercial"
                rows={data?.topCorretores || []}
                exportFileName="performance_corretores"
                searchFields={['corretor']}
                searchPlaceholder="Buscar corretor..."
                defaultSortField="vgv"
                columns={[
                  { label: 'Posição', width: '50px', render: (_, idx: number) => <span>{idx + 1}º</span> },
                  { label: 'Corretor', field: 'corretor' },
                  { label: 'Vendas Realizadas', field: 'reservas', align: 'right', render: (row) => formatNumber(row.reservas) },
                  { label: 'VGV Total', field: 'vgv', align: 'right', render: (row) => formatCurrency(row.vgv), csvValue: (row) => String(row.vgv) }
                ]}
              />
            )}

            {dataSubTab === 'monthly' && (
              <DataTable<any>
                title="Evolução Mensal Consolidada"
                rows={data?.monthly || []}
                exportFileName="evolucao_mensal_funil"
                searchFields={['month']}
                searchPlaceholder="Buscar mês (YYYY-MM)..."
                defaultSortField="month"
                columns={[
                  { label: 'Mês', field: 'month' },
                  { label: 'Leads', field: 'leads', align: 'right', render: (row) => formatNumber(row.leads as number) },
                  { label: 'Reservas', field: 'reservas', align: 'right', render: (row) => formatNumber(row.reservas) },
                  { label: 'VGV', field: 'vgv', align: 'right', render: (row) => formatCurrency(row.vgv), csvValue: (row) => String(row.vgv) }
                ]}
              />
            )}
          </GlassCard>
        </div>
      )}

      <p className="text-[10px] text-zinc-700 text-center mt-2">
        Funil Inteligente · Cruzamento em tempo real · Tabelas e gráficos agregados
      </p>
    </div>
  )
}
