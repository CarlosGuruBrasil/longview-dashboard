'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Play, Pause, RefreshCw, Image as ImageIcon, Video, ChevronDown,
  ChevronUp, DollarSign, MousePointerClick, Users, Target, Eye,
  ExternalLink, Sparkles
} from 'lucide-react'
import { useData } from '../../context/DataContext'
import { inferProdutoDaCampanha } from '../../lib/campaign-product'
import type { CampaignCreative, CampaignPerformance, CampaignScore } from '../../types'

// ── Score helpers ─────────────────────────────────────────────────────────────

function calcScore(c: { spend: number; leads: number; cpl: number; ctr: number }): CampaignScore {
  if (c.leads === 0 && c.spend > 50) return 'bad'
  if (c.ctr < 0.005 && c.spend > 20) return 'bad'
  if (c.cpl > 0 && c.cpl < 80 && c.ctr >= 0.01) return 'good'
  if (c.cpl >= 80 && c.cpl <= 150) return 'attention'
  if (c.ctr >= 0.005 && c.ctr < 0.01) return 'attention'
  return 'unknown'
}

const SCORE_CFG: Record<CampaignScore, { label: string; color: string; bg: string }> = {
  good:      { label: '🟢 Boa',       color: '#10b981', bg: 'rgba(16,185,129,0.1)'  },
  attention: { label: '🟡 Atenção',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  bad:       { label: '🔴 Ruim',      color: '#f43f5e', bg: 'rgba(244,63,94,0.1)'   },
  unknown:   { label: '⚪ Aguardando', color: '#71717a', bg: 'rgba(113,113,122,0.1)' },
}

// ── Creative Card (formato story/vertical) ────────────────────────────────────

function CreativeCard({ creative }: { creative: CampaignCreative }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden flex flex-col">
      {/* Preview vertical (9:16) */}
      <div className="relative bg-black/40 w-full" style={{ aspectRatio: '9/16', maxHeight: '240px' }}>
        {creative.thumbnailUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creative.thumbnailUrl}
            alt={creative.title ?? creative.adName}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            {creative.format === 'video'
              ? <Video size={28} className="text-zinc-700" />
              : <ImageIcon size={28} className="text-zinc-700" />
            }
            <span className="text-[11px] text-zinc-600">{creative.format === 'video' ? 'Vídeo' : 'Imagem'}</span>
          </div>
        )}

        {/* Badge de formato */}
        <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white uppercase tracking-wider">
          {creative.format}
        </span>

        {/* Link para o Facebook */}
        {creative.videoUrl && (
          <a href={creative.videoUrl} target="_blank" rel="noopener noreferrer"
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-all">
            <ExternalLink size={12} className="text-white" />
          </a>
        )}
      </div>

      {/* Dados do criativo */}
      <div className="p-3 flex flex-col gap-2">
        <p className="text-xs font-bold text-zinc-200 leading-tight line-clamp-2">
          {creative.title ?? creative.adName}
        </p>
        {creative.body && (
          <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-3">{creative.body}</p>
        )}
        <div className="flex flex-wrap gap-1.5 mt-1">
          {creative.callToAction && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/12 border border-orange-500/20 text-orange-400">
              {creative.callToAction}
            </span>
          )}
          {creative.targeting && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.07] text-zinc-500">
              {creative.adsetName}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Campaign Row ──────────────────────────────────────────────────────────────

function CampaignRow({
  campaign, creatives, onToggleStatus, toggling
}: {
  campaign: CampaignPerformance
  creatives: CampaignCreative[]
  onToggleStatus: (id: string, newStatus: 'ACTIVE' | 'PAUSED') => void
  toggling: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = SCORE_CFG[campaign.score]
  const isActive = campaign.status === 'ACTIVE'
  const campCreatives = creatives.filter(c => c.campaignId === campaign.campaignId)

  return (
    <div className="border border-white/[0.07] rounded-2xl overflow-hidden bg-white/[0.01]">
      {/* Header da campanha */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Score badge */}
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}>
          {cfg.label}
        </span>

        {/* Nome */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-semibold text-zinc-100 truncate">{campaign.campaignName}</p>
            {inferProdutoDaCampanha(campaign.campaignName) && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 shrink-0">
                {inferProdutoDaCampanha(campaign.campaignName)}
              </span>
            )}
          </div>
          <div className="flex gap-3 mt-0.5 text-[11px] text-zinc-500 flex-wrap">
            <span className="flex items-center gap-1"><DollarSign size={10} />R${campaign.spend.toFixed(0)}</span>
            <span className="flex items-center gap-1"><Users size={10} />{campaign.leads} leads</span>
            <span className="flex items-center gap-1"><MousePointerClick size={10} />{campaign.clicks.toLocaleString()}</span>
            <span className="flex items-center gap-1"><Target size={10} />{(campaign.ctr * 100).toFixed(2)}% CTR</span>
          </div>
        </div>

        {/* Botão Pausar/Ativar */}
        <button
          onClick={() => onToggleStatus(campaign.campaignId, isActive ? 'PAUSED' : 'ACTIVE')}
          disabled={toggling}
          className={`flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-bold border transition-all disabled:opacity-50 shrink-0 ${
            isActive
              ? 'bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20'
              : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20'
          }`}
        >
          {isActive ? <Pause size={11} /> : <Play size={11} />}
          {toggling ? '…' : isActive ? 'Pausar' : 'Ativar'}
        </button>

        {/* Expandir */}
        <button onClick={() => setExpanded(e => !e)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.03] hover:bg-white/[0.07] transition-all shrink-0 text-zinc-600">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Criativos expandidos */}
      {expanded && (
        <div className="border-t border-white/[0.06] p-4">
          {campCreatives.length === 0 ? (
            <div className="flex items-center justify-center py-6 gap-2 text-zinc-600">
              <Sparkles size={16} />
              <span className="text-sm">Nenhum criativo carregado para esta campanha</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {campCreatives.map(cr => (
                <CreativeCard key={cr.adId} creative={cr} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function GestaoAdsView() {
  const { metaData: meta } = useData()
  const [creatives, setCreatives] = useState<CampaignCreative[]>([])
  const [loadingCreatives, setLoadingCreatives] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [filter, setFilter] = useState<CampaignScore | 'all'>('all')

  // Monta campanhas a partir do contexto Meta
  const campaigns: CampaignPerformance[] = useMemo(() => {
    return (meta?.campaigns ?? []).map((c: import('../../types').MetaCampaignInsight) => {
      const spend = parseFloat(c.spend ?? '0')
      const leads = parseInt((c.actions ?? []).find((a: import('../../types').MetaAction) => a.action_type === 'lead')?.value ?? '0')
      const clicks = parseInt(c.clicks ?? '0')
      const impressions = parseInt(c.impressions ?? '0')
      const ctr = impressions > 0 ? clicks / impressions : 0
      const cpl = leads > 0 ? spend / leads : 0
      return {
        campaignId: c.campaign_id,
        campaignName: c.campaign_name,
        status: 'ACTIVE' as const,
        score: calcScore({ spend, leads, cpl, ctr }),
        spend, leads, cpl, ctr, roas: 0, impressions, clicks,
      }
    })
  }, [meta])

  const filtered = useMemo(() =>
    filter === 'all' ? campaigns : campaigns.filter(c => c.score === filter),
    [campaigns, filter]
  )

  async function loadCreatives() {
    setLoadingCreatives(true)
    try {
      const res = await fetch('/api/meta/creatives')
      const data = await res.json() as { creatives?: CampaignCreative[] }
      setCreatives(data.creatives ?? [])
    } catch { /* ignore */ }
    finally { setLoadingCreatives(false) }
  }

  useEffect(() => { void loadCreatives() }, [])

  async function handleToggle(campaignId: string, newStatus: 'ACTIVE' | 'PAUSED') {
    setToggling(campaignId)
    setStatusMsg(null)
    try {
      const res = await fetch(`/api/meta/campaigns/${campaignId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json() as { ok?: boolean; message?: string; error?: string }
      if (data.ok) {
        setStatusMsg(`✅ ${data.message}`)
      } else {
        setStatusMsg(`❌ ${data.error ?? 'Erro ao alterar campanha'}`)
      }
    } catch (e: unknown) {
      setStatusMsg(`❌ ${e instanceof Error ? e.message : 'Erro de conexão'}`)
    } finally {
      setToggling(null)
    }
  }

  const scoreCount = useMemo(() => ({
    all: campaigns.length,
    good: campaigns.filter(c => c.score === 'good').length,
    attention: campaigns.filter(c => c.score === 'attention').length,
    bad: campaigns.filter(c => c.score === 'bad').length,
  }), [campaigns])

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Eye size={18} className="text-orange-400" />
            Gestão de Campanhas & Criativos
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {campaigns.length} campanhas · {creatives.length} criativos carregados
          </p>
        </div>
        <button onClick={loadCreatives} disabled={loadingCreatives}
          className="flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-semibold bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-zinc-100 transition-all disabled:opacity-50">
          <RefreshCw size={13} className={loadingCreatives ? 'animate-spin' : ''} />
          {loadingCreatives ? 'Carregando criativos…' : 'Atualizar criativos'}
        </button>
      </div>

      {/* Mensagem de status */}
      {statusMsg && (
        <div className={`px-4 py-2.5 rounded-xl text-xs border ${statusMsg.startsWith('✅') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {statusMsg}
        </div>
      )}

      {/* Filtro de score */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { key: 'all',       label: `Todas (${scoreCount.all})` },
          { key: 'good',      label: `🟢 Boas (${scoreCount.good})` },
          { key: 'attention', label: `🟡 Atenção (${scoreCount.attention})` },
          { key: 'bad',       label: `🔴 Ruins (${scoreCount.bad})` },
        ] as const).map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`h-8 px-3.5 rounded-full text-xs font-semibold border transition-all ${
              filter === f.key
                ? 'bg-orange-500/15 border-orange-500/30 text-orange-300'
                : 'bg-white/[0.02] border-white/[0.07] text-zinc-500 hover:text-zinc-200'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista de campanhas */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Eye size={28} className="text-zinc-700" />
            <p className="text-zinc-500 text-sm">Nenhuma campanha neste filtro</p>
          </div>
        ) : (
          filtered.map(c => (
            <CampaignRow
              key={c.campaignId}
              campaign={c}
              creatives={creatives}
              onToggleStatus={handleToggle}
              toggling={toggling === c.campaignId}
            />
          ))
        )}
      </div>
    </div>
  )
}
