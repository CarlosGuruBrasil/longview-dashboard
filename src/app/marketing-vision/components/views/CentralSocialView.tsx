'use client'

import { useMemo } from 'react'
import { Globe, Users, Heart, Eye, TrendingUp, Radio, Camera, MessageCircle } from 'lucide-react'
import { useData } from '../../context/DataContext'
import type { MetaPageInfo } from '../../types'

// ── Platform Card ─────────────────────────────────────────────────────────────

function PlatformCard({
  icon: Icon, name, color, metrics, status
}: {
  icon: React.ElementType
  name: string
  color: string
  status: 'connected' | 'coming_soon'
  metrics: Array<{ label: string; value: string | number }>
}) {
  const isConnected = status === 'connected'
  return (
    <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-4 hover:bg-white/[0.04] transition-all">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}14` }}>
            <Icon size={20} style={{ color }} />
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-100">{name}</p>
            <p className="text-[11px]" style={{ color: isConnected ? '#10b981' : '#71717a' }}>
              {isConnected ? '● Conectada' : '○ Em breve'}
            </p>
          </div>
        </div>
      </div>

      {/* Métricas */}
      {isConnected ? (
        <div className="grid grid-cols-2 gap-2">
          {metrics.map(m => (
            <div key={m.label} className="bg-white/[0.02] border border-white/[0.05] rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-zinc-600 font-medium">{m.label}</p>
              <p className="text-base font-bold text-white mt-0.5">{m.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center py-6 rounded-xl bg-white/[0.01] border border-dashed border-white/[0.08]">
          <p className="text-xs text-zinc-600">Integração disponível em breve</p>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CentralSocialView() {
  const { metaData: meta } = useData()
  const page = meta?.page as MetaPageInfo | null | undefined

  const followers = page?.fan_count ?? 0
  const igFollowers = page?.instagram_business_account ? followers : 0

  const totalImpressions = useMemo(() =>
    parseInt(meta?.global?.impressions ?? '0'), [meta])
  const totalReach = useMemo(() =>
    parseInt(meta?.global?.reach ?? '0'), [meta])
  const totalClicks = useMemo(() =>
    parseInt(meta?.global?.clicks ?? '0'), [meta])

  // Estimativa de engajamento (leads + cliques)
  const leads = useMemo(() => {
    return (meta?.campaigns ?? []).reduce((sum: number, c: import('../../types').MetaCampaignInsight) => {
      const l = parseInt((c.actions ?? []).find((a: import('../../types').MetaAction) => a.action_type === 'lead')?.value ?? '0')
      return sum + l
    }, 0)
  }, [meta])

  function fmt(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${Math.round(n / 1_000)}k`
    return n.toLocaleString('pt-BR')
  }

  const platforms = [
    {
      icon: MessageCircle,
      name: 'Facebook / Meta Ads',
      color: '#1877f2',
      status: 'connected' as const,
      metrics: [
        { label: 'Seguidores', value: fmt(followers) },
        { label: 'Impressões', value: fmt(totalImpressions) },
        { label: 'Alcance', value: fmt(totalReach) },
        { label: 'Cliques', value: fmt(totalClicks) },
        { label: 'Leads gerados', value: fmt(leads) },
        { label: 'Campanhas ativas', value: meta?.campaigns?.length ?? 0 },
      ],
    },
    {
      icon: Camera,
      name: 'Instagram',
      color: '#e1306c',
      status: 'connected' as const,
      metrics: [
        { label: 'Seguidores', value: fmt(igFollowers) },
        { label: 'Alcance (Ads)', value: fmt(totalReach) },
        { label: 'Impressões', value: fmt(totalImpressions) },
        { label: 'Stories + Feed', value: `${meta?.adsets?.length ?? 0} ad sets` },
      ],
    },
    {
      icon: Globe,
      name: 'Google Ads',
      color: '#4285f4',
      status: 'coming_soon' as const,
      metrics: [],
    },
    {
      icon: Radio,
      name: 'Google Meu Negócio',
      color: '#34a853',
      status: 'coming_soon' as const,
      metrics: [],
    },
    {
      icon: TrendingUp,
      name: 'RD Station',
      color: '#00b4d8',
      status: 'coming_soon' as const,
      metrics: [],
    },
  ]

  // KPIs consolidados do topo
  const kpis = [
    { icon: Users,        label: 'Seguidores (Meta)',   value: fmt(followers),       color: '#1877f2' },
    { icon: Eye,          label: 'Impressões totais',   value: fmt(totalImpressions), color: '#a855f7' },
    { icon: Heart,        label: 'Alcance orgânico',    value: fmt(totalReach),      color: '#f43f5e' },
    { icon: TrendingUp,   label: 'Leads gerados',       value: fmt(leads),           color: '#10b981' },
  ]

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Globe size={18} className="text-orange-400" />
          Central de Redes Sociais
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Métricas consolidadas de todas as plataformas conectadas
        </p>
      </div>

      {/* KPIs de topo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-4 flex items-center gap-3 hover:bg-white/[0.04] transition-all">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${k.color}14` }}>
              <k.icon size={18} style={{ color: k.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-zinc-600 font-medium leading-none">{k.label}</p>
              <p className="text-xl font-black text-white mt-1 leading-none">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Grid de plataformas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {platforms.map(p => (
          <PlatformCard key={p.name} {...p} />
        ))}
      </div>

      <p className="text-[10px] text-zinc-700 text-center">
        Central Social · Google Ads, Google Meu Negócio e RD Station disponíveis após configuração no Hub de Integrações
      </p>
    </div>
  )
}
