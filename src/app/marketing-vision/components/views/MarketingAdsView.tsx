'use client'

import { useMemo, useState } from 'react'
import {
  DollarSign,
  Eye,
  MousePointerClick,
  Users,
  TrendingUp,
  BarChart2,
  Search,
} from 'lucide-react'
import { useData } from '../../context/DataContext'
import { getOrigin } from '../../utils/leads'
import { formatCurrency } from '../../utils/formatters'
import KpiCard from '../ui/KpiCard'
import GlassCard from '../ui/GlassCard'
import PieDonutChart from '../charts/PieDonutChart'
import MetaDailyChart from '../charts/MetaDailyChart'
import type { MetaCampaignInsight } from '../../types'

type DailyMetric = 'spend' | 'impressions' | 'clicks'

const META_ORIGINS = ['facebook', 'instagram', 'fb', 'ig', 'meta', 'fb ads', 'facebook ads', 'instagram ads']

function isMeta(origin: string): boolean {
  const o = origin.toLowerCase()
  return META_ORIGINS.some(k => o.includes(k))
}

function sumActions(actions: Array<{ action_type: string; value: string }> | undefined, type: string): number {
  if (!actions) return 0
  return actions
    .filter(a => a.action_type === type)
    .reduce((acc, a) => acc + Number(a.value || 0), 0)
}

export default function MarketingAdsView() {
  const { metaData, filteredLeads } = useData()
  const [dailyMetric, setDailyMetric] = useState<DailyMetric>('spend')
  const [campaignSearch, setCampaignSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE'>('all')
  const [sortField, setSortField] = useState<keyof MetaCampaignInsight>('spend')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const metaLeadsInCrm = useMemo(
    () => filteredLeads.filter(l => isMeta(getOrigin(l))).length,
    [filteredLeads]
  )

  const global = metaData?.global

  const metaLeadsFromAds = useMemo(
    () => Math.round(sumActions(global?.actions, 'lead')),
    [global]
  )

  const genderData = useMemo(() => {
    if (!metaData?.demographics?.length) return []
    const map = new Map<string, number>()
    for (const d of metaData.demographics) {
      const label = d.gender === 'male' ? 'Masculino' : d.gender === 'female' ? 'Feminino' : d.gender || 'Outro'
      map.set(label, (map.get(label) ?? 0) + Number(d.impressions ?? 0))
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [metaData])

  const platformData = useMemo(() => {
    if (!metaData?.platforms?.length) return []
    return metaData.platforms.map(p => ({
      name: p.publisher_platform || 'Desconhecido',
      value: Number(p.impressions ?? 0),
    }))
  }, [metaData])

  const deviceData = useMemo(() => {
    if (!metaData?.devices?.length) return []
    return metaData.devices.map(d => ({
      name: d.device_platform || 'Desconhecido',
      value: Number(d.impressions ?? 0),
    }))
  }, [metaData])

  const statusById = useMemo(() => {
    const map = new Map<string, string>()
    for (const d of metaData?.campaignDetails ?? []) {
      map.set(d.id, d.status)
    }
    return map
  }, [metaData])

  const filteredCampaigns = useMemo(() => {
    const list = (metaData?.campaigns ?? [])
      .filter(c =>
        c.campaign_name.toLowerCase().includes(campaignSearch.toLowerCase()) &&
        (statusFilter === 'all' || statusById.get(c.campaign_id) === statusFilter)
      )
    return list.slice().sort((a, b) => {
      const aStatus = statusById.get(a.campaign_id)
      const bStatus = statusById.get(b.campaign_id)
      if (aStatus === 'ACTIVE' && bStatus !== 'ACTIVE') return -1
      if (aStatus !== 'ACTIVE' && bStatus === 'ACTIVE') return 1
      const av = Number(a[sortField] ?? 0)
      const bv = Number(b[sortField] ?? 0)
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [metaData, campaignSearch, statusFilter, sortField, sortDir, statusById])

  function toggleSort(field: keyof MetaCampaignInsight) {
    if (sortField === field) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  if (!metaData || !global) {
    // HIG: empty state com ícone + título + descrição + ação clara
    return (
      <div className="flex flex-col items-center justify-center gap-5 px-6 text-center" style={{ minHeight: '60vh' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
             style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.15)' }}>
          <BarChart2 size={28} style={{ color: '#f97316' }} />
        </div>
        <div>
          <p className="text-[17px] font-semibold text-zinc-100">Meta Ads não conectado</p>
          <p className="text-[15px] text-zinc-400 mt-2 max-w-[260px] leading-snug">
            Configure META_TOKEN e META_ACT_ID nas variáveis de ambiente do servidor.
          </p>
        </div>
      </div>
    )
  }

  const spend = Number(global.spend ?? 0)
  const reach = Number(global.reach ?? 0)
  const impressions = Number(global.impressions ?? 0)
  const clicks = Number(global.clicks ?? 0)
  const cpm = Number(global.cpm ?? 0)
  const cpc = Number(global.cpc ?? 0)
  const ctr = Number(global.ctr ?? 0)

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
        <KpiCard icon={DollarSign} label="Investimento" value={formatCurrency(spend)} color="#f59e0b" />
        <KpiCard icon={Users} label="Alcance" value={reach.toLocaleString('pt-BR')} color="#0ea5e9" />
        <KpiCard icon={Eye} label="Impressões" value={impressions.toLocaleString('pt-BR')} color="#a855f7" />
        <KpiCard icon={MousePointerClick} label="Cliques" value={clicks.toLocaleString('pt-BR')} color="#10b981" />
        <KpiCard icon={DollarSign} label="CPM" value={formatCurrency(cpm)} color="#f59e0b" />
        <KpiCard icon={DollarSign} label="CPC" value={formatCurrency(cpc)} color="#f43f5e" />
        <KpiCard icon={TrendingUp} label="CTR" value={`${ctr.toFixed(2)}%`} color="#06b6d4" />
        <KpiCard icon={Users} label="Leads Meta" value={metaLeadsFromAds.toLocaleString('pt-BR')} color="#ec4899" />
      </div>

      {/* CRM vs Meta comparison */}
      <GlassCard title="Comparativo CRM × Meta Ads">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1 p-4 rounded-xl bg-white/5 border border-white/10">
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Leads no CRM (origem Meta)
            </span>
            <span className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {metaLeadsInCrm.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Leads com origem facebook / instagram / meta
            </span>
          </div>
          <div className="flex flex-col gap-1 p-4 rounded-xl bg-white/5 border border-white/10">
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Leads registrados no Meta Ads
            </span>
            <span className="text-3xl font-bold" style={{ color: '#ec4899' }}>
              {metaLeadsFromAds.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Ações do tipo &quot;lead&quot; reportadas pelo Meta
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Daily chart */}
      {metaData.daily.length > 0 && (
        <MetaDailyChart
          daily={metaData.daily}
          metric={dailyMetric}
          onMetricChange={setDailyMetric}
        />
      )}

      {/* Demographics charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {genderData.length > 0 && (
          <PieDonutChart title="Por Gênero" data={genderData} />
        )}
        {platformData.length > 0 && (
          <PieDonutChart title="Por Plataforma" data={platformData} />
        )}
        {deviceData.length > 0 && (
          <PieDonutChart title="Por Dispositivo" data={deviceData} />
        )}
      </div>

      {/* Campaigns table */}
      <GlassCard
        title="Campanhas"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatusFilter(s => s === 'all' ? 'ACTIVE' : 'all')}
              className={`px-2.5 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {statusFilter === 'ACTIVE' ? 'Só ativas' : 'Todas'}
            </button>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" style={{ color: 'var(--text-primary)' }} />
              <input
                type="text"
                placeholder="Filtrar campanha..."
                value={campaignSearch}
                onChange={e => setCampaignSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 focus:outline-none focus:border-sky-500/40 w-48"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: 'var(--text-secondary)' }}>
                {[
                  { label: 'Campanha', field: 'campaign_name' as keyof MetaCampaignInsight },
                  { label: 'Status', field: null },
                  { label: 'Gasto', field: 'spend' as keyof MetaCampaignInsight },
                  { label: 'Impressões', field: 'impressions' as keyof MetaCampaignInsight },
                  { label: 'Cliques', field: 'clicks' as keyof MetaCampaignInsight },
                  { label: 'CTR', field: 'ctr' as keyof MetaCampaignInsight },
                  { label: 'CPM', field: 'cpm' as keyof MetaCampaignInsight },
                  { label: 'CPC', field: 'cpc' as keyof MetaCampaignInsight },
                  { label: 'Leads', field: null },
                ].map(({ label, field }) => (
                  <th
                    key={label}
                    className={`text-left py-2 px-3 font-medium whitespace-nowrap ${field ? 'cursor-pointer hover:text-white' : ''}`}
                    onClick={() => field && toggleSort(field)}
                  >
                    {label}
                    {field && sortField === field && (
                      <span className="ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCampaigns.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center opacity-50" style={{ color: 'var(--text-secondary)' }}>
                    Nenhuma campanha encontrada
                  </td>
                </tr>
              )}
              {filteredCampaigns.map(c => {
                const leads = Math.round(sumActions(c.actions, 'lead'))
                const status = statusById.get(c.campaign_id)
                return (
                  <tr
                    key={c.campaign_id}
                    className="border-t border-white/5 hover:bg-white/5 transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <td className="py-2.5 px-3 max-w-[200px] truncate">{c.campaign_name}</td>
                    <td className="py-2.5 px-3">
                      {status ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-zinc-500/20 text-zinc-400'
                          }`}
                        >
                          {status}
                        </span>
                      ) : (
                        <span className="opacity-30">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-amber-400">{formatCurrency(Number(c.spend ?? 0))}</td>
                    <td className="py-2.5 px-3">{Number(c.impressions ?? 0).toLocaleString('pt-BR')}</td>
                    <td className="py-2.5 px-3">{Number(c.clicks ?? 0).toLocaleString('pt-BR')}</td>
                    <td className="py-2.5 px-3">{Number(c.ctr ?? 0).toFixed(2)}%</td>
                    <td className="py-2.5 px-3">{formatCurrency(Number(c.cpm ?? 0))}</td>
                    <td className="py-2.5 px-3">{formatCurrency(Number(c.cpc ?? 0))}</td>
                    <td className="py-2.5 px-3 text-pink-400 font-semibold">{leads}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}
