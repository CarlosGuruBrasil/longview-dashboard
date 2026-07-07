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
  Database
} from 'lucide-react'
import { useData } from '../../context/DataContext'
import { getOrigin } from '../../utils/leads'
import { formatCurrency } from '../../utils/formatters'
import KpiCard from '../ui/KpiCard'
import GlassCard from '../ui/GlassCard'
import PieDonutChart from '../charts/PieDonutChart'
import MetaDailyChart from '../charts/MetaDailyChart'
import DataTable from '../ui/DataTable'
import type { MetaCampaignInsight, MetaAdset, MetaDemographic, MetaRegion } from '../../types'

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
  const { metaData, filteredLeads, leadForms } = useData()
  const [dailyMetric, setDailyMetric] = useState<DailyMetric>('spend')
  const [activeTab, setActiveTab] = useState<'dashboard' | 'data'>('dashboard')
  const [dataSubTab, setDataSubTab] = useState<'campaigns' | 'adsets' | 'demographics' | 'regions'>('campaigns')

  const ageData = useMemo(() => {
    if (!metaData?.demographics?.length) return []
    const map = new Map<string, number>()
    for (const d of metaData.demographics) {
      if (d.age) {
        map.set(d.age, (map.get(d.age) ?? 0) + Number(d.impressions ?? 0))
      }
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [metaData])
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
        <div className="flex flex-col gap-6">
          {/* KPI Row com Badges Qualitativas baseadas em Semáforo */}
          {(() => {
            const badge = (cls: string, text: string) => (
              <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase ${cls}`}>
                {text}
              </span>
            )
            const getCtrBadge = (val: number) => {
              if (val >= 1.5) return badge('bg-green-500/15 text-green-400 border border-green-500/20', 'Excelente CTR')
              if (val >= 1.0) return badge('bg-sky-500/15 text-sky-400 border border-sky-500/20', 'Bom CTR')
              if (val >= 0.6) return badge('bg-amber-500/15 text-amber-400 border border-amber-500/20', 'Regular')
              return badge('bg-red-500/15 text-red-400 border border-red-500/20', 'Crítico / Baixo')
            }
            const getCpcBadge = (val: number) => {
              if (val <= 1.50) return badge('bg-green-500/15 text-green-400 border border-green-500/20', 'Excelente CPC')
              if (val <= 3.00) return badge('bg-sky-500/15 text-sky-400 border border-sky-500/20', 'Bom CPC')
              if (val <= 5.00) return badge('bg-amber-500/15 text-amber-400 border border-amber-500/20', 'Regular')
              return badge('bg-red-500/15 text-red-400 border border-red-500/20', 'Caro CPC')
            }
            const getCpmBadge = (val: number) => {
              if (val <= 20.00) return badge('bg-green-500/15 text-green-400 border border-green-500/20', 'Excelente CPM')
              if (val <= 40.00) return badge('bg-sky-500/15 text-sky-400 border border-sky-500/20', 'Bom CPM')
              return badge('bg-amber-500/15 text-amber-400 border border-amber-500/20', 'Caro CPM')
            }
            const getCplBadge = (val: number) => {
              if (val === 0) return badge('bg-zinc-500/15 text-zinc-400 border border-zinc-500/20', 'Sem dados')
              if (val <= 45.00) return badge('bg-green-500/15 text-green-400 border border-green-500/20', 'Excelente CPL')
              if (val <= 85.00) return badge('bg-sky-500/15 text-sky-400 border border-sky-500/20', 'Bom CPL')
              if (val <= 140.00) return badge('bg-amber-500/15 text-amber-400 border border-amber-500/20', 'Regular')
              return badge('bg-red-500/15 text-red-400 border border-red-500/20', 'Caro CPL')
            }
            const metaCpl = metaLeadsFromAds > 0 ? spend / metaLeadsFromAds : 0

            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <KpiCard icon={DollarSign} label="Investimento Meta" value={formatCurrency(spend)} color="#f59e0b" subtitleNode={badge('bg-orange-500/15 text-orange-400 border border-orange-500/20', 'Mídia Paga')} />
                  <KpiCard icon={Users} label="CPL Médio Meta" value={formatCurrency(metaCpl)} color="#ec4899" subtitleNode={getCplBadge(metaCpl)} />
                  <KpiCard icon={TrendingUp} label="CTR" value={`${ctr.toFixed(2)}%`} color="#06b6d4" subtitleNode={getCtrBadge(ctr)} />
                  <KpiCard icon={MousePointerClick} label="CPC" value={formatCurrency(cpc)} color="#f43f5e" subtitleNode={getCpcBadge(cpc)} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <KpiCard icon={DollarSign} label="CPM" value={formatCurrency(cpm)} color="#a855f7" subtitleNode={getCpmBadge(cpm)} />
                  <KpiCard icon={Users} label="Alcance" value={reach.toLocaleString('pt-BR')} color="#0ea5e9" subtitleNode={badge('bg-sky-500/15 text-sky-400 border border-sky-500/20', 'Pessoas')} />
                  <KpiCard icon={Eye} label="Impressões" value={impressions.toLocaleString('pt-BR')} color="#10b981" subtitleNode={badge('bg-green-500/15 text-green-400 border border-green-500/20', 'Exibições')} />
                  <KpiCard icon={Users} label="Leads Meta Ads" value={metaLeadsFromAds.toLocaleString('pt-BR')} color="#ec4899" subtitleNode={badge('bg-pink-500/15 text-pink-400 border border-pink-500/20', 'Meta Ads')} />
                </div>
              </>
            )
          })()}

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {genderData.length > 0 && (
              <PieDonutChart title="Por Gênero" data={genderData} />
            )}
            {ageData.length > 0 && (
              <PieDonutChart title="Por Faixa Etária" data={ageData} />
            )}
            {platformData.length > 0 && (
              <PieDonutChart title="Por Plataforma" data={platformData} />
            )}
            {deviceData.length > 0 && (
              <PieDonutChart title="Por Dispositivo" data={deviceData} />
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Sub-abas de dados */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { key: 'campaigns', label: 'Campanhas' },
              { key: 'adsets', label: 'Conjuntos de Anúncios (Adsets)' },
              { key: 'demographics', label: 'Dados Demográficos' },
              { key: 'regions', label: 'Regiões' },
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
            {dataSubTab === 'campaigns' && (
              <DataTable<any>
                title="Campanhas de Marketing (Meta Ads)"
                rows={metaData.campaigns || []}
                exportFileName="campanhas_meta"
                searchFields={['campaign_name', 'campaign_id']}
                searchPlaceholder="Buscar por campanha..."
                defaultSortField="spend"
                columns={[
                  { label: 'ID da Campanha', field: 'campaign_id', width: '120px' },
                  { label: 'Campanha', field: 'campaign_name' },
                  { label: 'Status', render: row => {
                      const status = statusById.get(row.campaign_id)
                      return (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-500/20 text-zinc-400'}`}>
                          {status || 'Desconhecido'}
                        </span>
                      )
                    }
                  },
                  { label: 'Gasto', field: 'spend', align: 'right', render: row => formatCurrency(Number(row.spend ?? 0)), csvValue: row => String(row.spend ?? 0) },
                  { label: 'Impressões', field: 'impressions', align: 'right', render: row => Number(row.impressions ?? 0).toLocaleString('pt-BR') },
                  { label: 'Cliques', field: 'clicks', align: 'right', render: row => Number(row.clicks ?? 0).toLocaleString('pt-BR') },
                  { label: 'CTR', field: 'ctr', align: 'right', render: row => `${Number(row.ctr ?? 0).toFixed(2)}%` },
                  { label: 'CPM', field: 'cpm', align: 'right', render: row => formatCurrency(Number(row.cpm ?? 0)) },
                  { label: 'CPC', field: 'cpc', align: 'right', render: row => formatCurrency(Number(row.cpc ?? 0)) },
                  { label: 'Leads', align: 'right', render: row => sumActions(row.actions, 'lead').toLocaleString('pt-BR'), csvValue: row => String(sumActions(row.actions, 'lead')) }
                ]}
              />
            )}

            {dataSubTab === 'adsets' && (
              <DataTable<any>
                title="Conjuntos de Anúncios (Adsets)"
                rows={metaData.adsets || []}
                exportFileName="adsets_meta"
                searchFields={['adset_name', 'campaign_name']}
                searchPlaceholder="Buscar adset ou campanha..."
                defaultSortField="spend"
                columns={[
                  { label: 'Adset ID', field: 'adset_id', width: '120px' },
                  { label: 'Conjunto de Anúncios', field: 'adset_name' },
                  { label: 'Campanha', field: 'campaign_name' },
                  { label: 'Gasto', field: 'spend', align: 'right', render: row => formatCurrency(Number(row.spend ?? 0)), csvValue: row => String(row.spend ?? 0) },
                  { label: 'Impressões', field: 'impressions', align: 'right', render: row => Number(row.impressions ?? 0).toLocaleString('pt-BR') },
                  { label: 'Cliques', field: 'clicks', align: 'right', render: row => Number(row.clicks ?? 0).toLocaleString('pt-BR') },
                  { label: 'CTR', field: 'ctr', align: 'right', render: row => `${Number(row.ctr ?? 0).toFixed(2)}%` },
                  { label: 'Leads', align: 'right', render: row => sumActions(row.actions, 'lead').toLocaleString('pt-BR'), csvValue: row => String(sumActions(row.actions, 'lead')) }
                ]}
              />
            )}

            {dataSubTab === 'demographics' && (
              <DataTable<any>
                title="Dados Demográficos (Idade e Gênero)"
                rows={metaData.demographics || []}
                exportFileName="demograficos_meta"
                searchFields={['age', 'gender']}
                searchPlaceholder="Buscar por faixa etária ou gênero..."
                defaultSortField="impressions"
                columns={[
                  { label: 'Gênero', field: 'gender', render: row => row.gender === 'male' ? 'Masculino' : row.gender === 'female' ? 'Feminino' : row.gender || 'Não Informado' },
                  { label: 'Faixa Etária', field: 'age' },
                  { label: 'Gasto', field: 'spend', align: 'right', render: row => formatCurrency(Number(row.spend ?? 0)), csvValue: row => String(row.spend ?? 0) },
                  { label: 'Impressões', field: 'impressions', align: 'right', render: row => Number(row.impressions ?? 0).toLocaleString('pt-BR') },
                  { label: 'Cliques', field: 'clicks', align: 'right', render: row => Number(row.clicks ?? 0).toLocaleString('pt-BR') },
                  { label: 'Leads', align: 'right', render: row => sumActions(row.actions, 'lead').toLocaleString('pt-BR'), csvValue: row => String(sumActions(row.actions, 'lead')) }
                ]}
              />
            )}

            {dataSubTab === 'regions' && (
              <DataTable<any>
                title="Desempenho por Região"
                rows={metaData.regions || []}
                exportFileName="regioes_meta"
                searchFields={['region']}
                searchPlaceholder="Buscar por região..."
                defaultSortField="spend"
                columns={[
                  { label: 'Região', field: 'region' },
                  { label: 'Gasto', field: 'spend', align: 'right', render: row => formatCurrency(Number(row.spend ?? 0)), csvValue: row => String(row.spend ?? 0) },
                  { label: 'Impressões', field: 'impressions', align: 'right', render: row => Number(row.impressions ?? 0).toLocaleString('pt-BR') },
                  { label: 'Cliques', field: 'clicks', align: 'right', render: row => Number(row.clicks ?? 0).toLocaleString('pt-BR') },
                  { label: 'Leads', align: 'right', render: row => sumActions(row.actions, 'lead').toLocaleString('pt-BR'), csvValue: row => String(sumActions(row.actions, 'lead')) }
                ]}
              />
            )}
          </GlassCard>
        </div>
      )}
    </div>
  )
}
