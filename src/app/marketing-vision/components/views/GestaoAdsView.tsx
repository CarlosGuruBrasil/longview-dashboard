'use client'

import { useState, useEffect, useMemo } from 'react'
import { Play, Pause, RefreshCw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'

type Campaign = {
  id: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | string
  effectiveStatus: string
  objective: string | null
  dailyBudget: number | null
  lifetimeBudget: number | null
  createdTime: string | null
  spend: number
  impressions: number
  clicks: number
  leads: number
  reach: number
  cpl: number
  ctr: number
  hasDelivery: boolean
}

type TabFilter = 'all' | 'active' | 'paused' | 'delivery'

const STATUS_CFG: Record<string, { dot: string; label: string }> = {
  ACTIVE:          { dot: 'bg-emerald-500 animate-pulse', label: 'Ativo' },
  PAUSED:          { dot: 'bg-zinc-500',                  label: 'Pausado' },
  WITH_ISSUES:     { dot: 'bg-amber-500',                 label: 'Com problemas' },
  CAMPAIGN_PAUSED: { dot: 'bg-zinc-600',                  label: 'Camp. pausada' },
  ARCHIVED:        { dot: 'bg-zinc-700',                  label: 'Arquivada' },
  DELETED:         { dot: 'bg-red-600',                   label: 'Deletada' },
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${Math.round(n / 1_000)}k`
  return String(n)
}

function BudgetCell({ daily, lifetime }: { daily: number | null; lifetime: number | null }) {
  if (daily)    return <span className="text-zinc-300">{formatCurrency(daily)}<span className="text-zinc-600 text-[10px] ml-0.5">/ dia</span></span>
  if (lifetime) return <span className="text-zinc-300">{formatCurrency(lifetime)}<span className="text-zinc-600 text-[10px] ml-0.5">total</span></span>
  return <span className="text-zinc-600">—</span>
}

export default function GestaoAdsView() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabFilter>('all')
  const [toggling, setToggling] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/meta/campaigns-table')
      const data = await res.json() as { campaigns?: Campaign[]; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Erro ao carregar')
      setCampaigns(data.campaigns ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    switch (tab) {
      case 'active':   return campaigns.filter(c => c.status === 'ACTIVE')
      case 'paused':   return campaigns.filter(c => c.status === 'PAUSED')
      case 'delivery': return campaigns.filter(c => c.hasDelivery)
      default:         return campaigns
    }
  }, [campaigns, tab])

  const totals = useMemo(() => ({
    active:   campaigns.filter(c => c.status === 'ACTIVE').length,
    paused:   campaigns.filter(c => c.status === 'PAUSED').length,
    delivery: campaigns.filter(c => c.hasDelivery).length,
    leads:    campaigns.reduce((s, c) => s + c.leads, 0),
    spend:    campaigns.reduce((s, c) => s + c.spend, 0),
  }), [campaigns])

  async function handleToggle(c: Campaign) {
    const newStatus = c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    setToggling(c.id)
    setMsg(null)
    try {
      const res = await fetch(`/api/meta/campaigns/${c.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json() as { ok?: boolean; message?: string; error?: string }
      if (data.ok) {
        setMsg({ ok: true, text: data.message ?? 'Campanha atualizada' })
        setCampaigns(prev => prev.map(p => p.id === c.id ? { ...p, status: newStatus, effectiveStatus: newStatus } : p))
      } else {
        setMsg({ ok: false, text: data.error ?? 'Erro ao alterar' })
      }
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Erro de conexão' })
    } finally {
      setToggling(null)
    }
  }

  const TABS: { key: TabFilter; label: string; count: number }[] = [
    { key: 'all',      label: 'Todos os anúncios', count: campaigns.length },
    { key: 'active',   label: 'Anúncios ativos',   count: totals.active },
    { key: 'paused',   label: 'Pausados',           count: totals.paused },
    { key: 'delivery', label: 'Com veiculação',     count: totals.delivery },
  ]

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-white">Gerenciador de Anúncios</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {campaigns.length} campanhas · {totals.active} ativas · {fmt(totals.leads)} leads · {formatCurrency(totals.spend)} investidos
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-white/[0.04] border border-white/[0.09] text-zinc-400 hover:text-zinc-100 transition-all disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Status msg */}
      {msg && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${
          msg.ok
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {msg.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.07] overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 -mb-px whitespace-nowrap transition-all ${
              tab === t.key
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-200'
            }`}
          >
            {t.label}
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
              tab === t.key ? 'bg-sky-500/20 text-sky-300' : 'bg-white/5 text-zinc-600'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-zinc-500">
          <RefreshCw size={16} className="animate-spin" />
          <span className="text-sm">Carregando campanhas da Meta...</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-zinc-600">
          <Clock size={28} />
          <p className="text-sm">Nenhuma campanha neste filtro</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.07] bg-white/[0.01]">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="border-b border-white/[0.07] text-zinc-500 text-[11px] uppercase font-semibold">
                <th className="text-left px-3 py-3 w-8"></th>
                <th className="text-left px-3 py-3">Campanha</th>
                <th className="text-center px-3 py-3">Veiculação</th>
                <th className="text-right px-3 py-3">Leads</th>
                <th className="text-right px-3 py-3">CPL</th>
                <th className="text-right px-3 py-3">Orçamento</th>
                <th className="text-right px-3 py-3">Valor usado</th>
                <th className="text-right px-3 py-3">Impressões</th>
                <th className="text-right px-3 py-3">Alcance</th>
                <th className="text-right px-3 py-3">CTR</th>
                <th className="text-center px-3 py-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const cfg = STATUS_CFG[c.effectiveStatus] ?? STATUS_CFG[c.status] ?? STATUS_CFG['PAUSED']
                const isActive = c.status === 'ACTIVE'
                const isToggling = toggling === c.id

                return (
                  <tr
                    key={c.id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors"
                  >
                    {/* Status dot */}
                    <td className="px-3 py-3">
                      <span className={`block w-2 h-2 rounded-full mx-auto ${cfg.dot}`} title={cfg.label} />
                    </td>

                    {/* Nome da campanha */}
                    <td className="px-3 py-3 max-w-[280px]">
                      <p className="font-semibold text-zinc-200 truncate" title={c.name}>{c.name}</p>
                      {c.objective && (
                        <p className="text-[10px] text-zinc-600 mt-0.5 truncate">{c.objective}</p>
                      )}
                    </td>

                    {/* Status text */}
                    <td className="px-3 py-3 text-center">
                      <span className={`text-[11px] font-semibold ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`}>
                        {cfg.label}
                      </span>
                    </td>

                    {/* Leads */}
                    <td className="px-3 py-3 text-right font-bold text-orange-400">
                      {c.leads > 0 ? fmt(c.leads) : <span className="text-zinc-700">—</span>}
                    </td>

                    {/* CPL */}
                    <td className="px-3 py-3 text-right text-zinc-300">
                      {c.cpl > 0 ? formatCurrency(c.cpl) : <span className="text-zinc-700">—</span>}
                    </td>

                    {/* Orçamento */}
                    <td className="px-3 py-3 text-right">
                      <BudgetCell daily={c.dailyBudget} lifetime={c.lifetimeBudget} />
                    </td>

                    {/* Spend */}
                    <td className="px-3 py-3 text-right font-semibold text-zinc-200">
                      {c.spend > 0 ? formatCurrency(c.spend) : <span className="text-zinc-700">—</span>}
                    </td>

                    {/* Impressões */}
                    <td className="px-3 py-3 text-right text-zinc-400 font-mono">
                      {c.impressions > 0 ? fmt(c.impressions) : <span className="text-zinc-700">—</span>}
                    </td>

                    {/* Alcance */}
                    <td className="px-3 py-3 text-right text-zinc-400 font-mono">
                      {c.reach > 0 ? fmt(c.reach) : <span className="text-zinc-700">—</span>}
                    </td>

                    {/* CTR */}
                    <td className="px-3 py-3 text-right text-sky-400 font-mono">
                      {c.ctr > 0 ? `${c.ctr.toFixed(2)}%` : <span className="text-zinc-700">—</span>}
                    </td>

                    {/* Toggle */}
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => handleToggle(c)}
                        disabled={isToggling}
                        title={isActive ? 'Pausar campanha' : 'Ativar campanha'}
                        className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-bold border transition-all disabled:opacity-40 ${
                          isActive
                            ? 'bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20'
                            : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                      >
                        {isToggling
                          ? <RefreshCw size={10} className="animate-spin" />
                          : isActive
                            ? <><Pause size={10} /> Pausar</>
                            : <><Play size={10} /> Ativar</>
                        }
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Totais */}
      {!loading && filtered.length > 0 && (
        <div className="flex gap-4 flex-wrap text-[11px] text-zinc-500 px-1">
          <span>{filtered.length} campanhas exibidas</span>
          <span>·</span>
          <span>Leads: <strong className="text-orange-400">{fmt(filtered.reduce((s, c) => s + c.leads, 0))}</strong></span>
          <span>·</span>
          <span>Investido: <strong className="text-zinc-200">{formatCurrency(filtered.reduce((s, c) => s + c.spend, 0))}</strong></span>
          <span>·</span>
          <span>Impressões: <strong className="text-zinc-200">{fmt(filtered.reduce((s, c) => s + c.impressions, 0))}</strong></span>
        </div>
      )}
    </div>
  )
}
