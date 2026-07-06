'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Cpu, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Zap,
  Users, DollarSign, Target, BarChart3, ArrowRight, RefreshCw,
  Sparkles, Radio, Eye, MousePointerClick, ShoppingBag
} from 'lucide-react'
import { useData } from '../../context/DataContext'
import { insightsFromIntelligence } from '../../lib/deep-insights'
import { formatCurrency } from '../../utils/formatters'
import type { AIInsight, CampaignPerformance, CampaignScore } from '../../types'

// ── Score helpers ─────────────────────────────────────────────────────────────

function calcScore(c: {
  spend: number; leads: number; cpl: number; ctr: number; roas: number
}): CampaignScore {
  if (c.leads === 0 && c.spend > 50) return 'bad'
  if (c.ctr < 0.005 && c.spend > 20) return 'bad'
  if (c.roas > 3 && c.ctr > 0.01) return 'good'
  if (c.cpl > 0 && c.cpl < 80 && c.ctr >= 0.005) return 'good'
  if (c.cpl >= 80 && c.cpl <= 150) return 'attention'
  if (c.ctr >= 0.005 && c.ctr < 0.01) return 'attention'
  return 'unknown'
}

const SCORE_CONFIG: Record<CampaignScore, { label: string; color: string; bg: string; dot: string }> = {
  good:      { label: 'Boa',       color: '#10b981', bg: 'rgba(16,185,129,0.1)',  dot: '#10b981' },
  attention: { label: 'Atenção',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  dot: '#f59e0b' },
  bad:       { label: 'Ruim',      color: '#f43f5e', bg: 'rgba(244,63,94,0.1)',   dot: '#f43f5e' },
  unknown:   { label: 'Aguardando', color: '#71717a', bg: 'rgba(113,113,122,0.1)', dot: '#71717a' },
}

function ScoreBadge({ score }: { score: CampaignScore }) {
  const cfg = SCORE_CONFIG[score]
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

// ── Insight Card ──────────────────────────────────────────────────────────────

const INSIGHT_ICONS = {
  warning:     AlertTriangle,
  success:     CheckCircle2,
  opportunity: Zap,
  info:        Eye,
  critical:    AlertTriangle,
}
const INSIGHT_COLORS = {
  warning:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)'  },
  success:     { color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)'  },
  opportunity: { color: '#a855f7', bg: 'rgba(168,85,247,0.08)',  border: 'rgba(168,85,247,0.2)'  },
  info:        { color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)',  border: 'rgba(14,165,233,0.2)'  },
  critical:    { color: '#f43f5e', bg: 'rgba(244,63,94,0.08)',   border: 'rgba(244,63,94,0.2)'   },
}

function InsightCard({ insight, onAction }: { insight: AIInsight; onAction?: (i: AIInsight) => void }) {
  const Icon = INSIGHT_ICONS[insight.type]
  const clr = INSIGHT_COLORS[insight.type]
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl border transition-all hover:opacity-90"
      style={{ backgroundColor: clr.bg, borderColor: clr.border }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: `${clr.color}18` }}>
        <Icon size={15} style={{ color: clr.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-100">{insight.title}</p>
        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{insight.description}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
            style={{ backgroundColor: `${clr.color}18`, color: clr.color }}>
            {insight.source === 'gemini' ? '✨ Análise Profunda' : '⚡ Automático'}
          </span>
          {insight.actionLabel && onAction && (
            <button onClick={() => onAction(insight)}
              className="text-xs font-semibold flex items-center gap-1 hover:underline"
              style={{ color: clr.color }}>
              {insight.actionLabel} <ArrowRight size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── KPI Bar ───────────────────────────────────────────────────────────────────

function KpiBar({ icon: Icon, label, value, delta, color }: {
  icon: React.ElementType; label: string; value: string; delta?: string; color: string
}) {
  const isPos = delta?.startsWith('+')
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.025] border border-white/[0.06] hover:bg-white/[0.04] transition-all">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}15` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-zinc-500 font-medium">{label}</p>
        <p className="text-base font-bold text-white leading-tight">{value}</p>
      </div>
      {delta && (
        <span className={`text-[11px] font-bold ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPos ? <TrendingUp size={12} className="inline mr-0.5" /> : <TrendingDown size={12} className="inline mr-0.5" />}
          {delta}
        </span>
      )}
    </div>
  )
}

// ── Gerador de Insights por Regras ────────────────────────────────────────────

function generateRuleInsights(campaigns: CampaignPerformance[], totalLeads: number, totalSpend: number): AIInsight[] {
  const insights: AIInsight[] = []
  const now = new Date().toISOString()

  campaigns.forEach(c => {
    if (c.score === 'bad' && c.status === 'ACTIVE') {
      insights.push({
        id: `bad-${c.campaignId}`,
        type: 'critical',
        title: `Campanha "${c.campaignName}" com performance ruim`,
        description: `CPL de R$${c.cpl.toFixed(2)} e CTR de ${(c.ctr * 100).toFixed(2)}% — abaixo do esperado. Considere pausar ou revisar o criativo.`,
        action: 'pause_campaign',
        actionLabel: 'Pausar agora',
        actionPayload: { campaignId: c.campaignId },
        generatedAt: now,
        source: 'rule',
      })
    }
    if (c.score === 'good' && c.status === 'ACTIVE') {
      insights.push({
        id: `good-${c.campaignId}`,
        type: 'opportunity',
        title: `"${c.campaignName}" está performando muito bem!`,
        description: `ROAS de ${c.roas.toFixed(1)}x e CPL de R$${c.cpl.toFixed(2)}. Considere aumentar o orçamento para escalar os resultados.`,
        action: 'increase_budget',
        actionLabel: 'Ver campanha',
        actionPayload: { campaignId: c.campaignId },
        generatedAt: now,
        source: 'rule',
      })
    }
    if (c.score === 'attention') {
      insights.push({
        id: `att-${c.campaignId}`,
        type: 'warning',
        title: `"${c.campaignName}" precisa de atenção`,
        description: `CTR de ${(c.ctr * 100).toFixed(2)}% e CPL de R$${c.cpl.toFixed(2)}. Revise a segmentação ou o criativo antes que piore.`,
        action: 'review_creative',
        actionLabel: 'Ver criativo',
        actionPayload: { campaignId: c.campaignId },
        generatedAt: now,
        source: 'rule',
      })
    }
  })

  if (totalLeads > 0 && totalSpend > 0) {
    const globalCpl = totalSpend / totalLeads
    insights.push({
      id: 'global-cpl',
      type: globalCpl < 100 ? 'success' : globalCpl < 200 ? 'info' : 'warning',
      title: `CPL global: R$${globalCpl.toFixed(2)}`,
      description: globalCpl < 100
        ? 'Custo por lead dentro do ideal. Bom desempenho geral das campanhas.'
        : globalCpl < 200
          ? 'CPL moderado. Há espaço para otimização nas campanhas com menor performance.'
          : 'CPL acima do recomendado. Revise as campanhas com menor taxa de conversão.',
      generatedAt: now,
      source: 'rule',
    })
  }

  return insights.slice(0, 8)
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CentralComandoView() {
  const { metaData: meta, filteredLeads, setActiveView } = useData()
  const [deepLoading, setDeepLoading] = useState(false)
  const [deepInsights, setDeepInsights] = useState<AIInsight[]>([])

  const totalSpend = useMemo(() => parseFloat(meta?.global?.spend ?? '0'), [meta])
  const totalImpressions = useMemo(() => parseInt(meta?.global?.impressions ?? '0'), [meta])
  const totalClicks = useMemo(() => parseInt(meta?.global?.clicks ?? '0'), [meta])
  const globalCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0

  // Monta lista de CampaignPerformance a partir dos dados Meta
  const campaigns: CampaignPerformance[] = useMemo(() => {
    return (meta?.campaigns ?? []).map((c: import('../../types').MetaCampaignInsight) => {
      const spend = parseFloat(c.spend ?? '0')
      const leads = (c.actions ?? []).find((a: import('../../types').MetaAction) => a.action_type === 'lead')
        ? parseInt((c.actions ?? []).find((a: import('../../types').MetaAction) => a.action_type === 'lead')!.value)
        : 0
      const clicks = parseInt(c.clicks ?? '0')
      const impressions = parseInt(c.impressions ?? '0')
      const ctr = impressions > 0 ? clicks / impressions : 0
      const cpl = leads > 0 ? spend / leads : 0
      const revenue = leads * 500 // estimativa
      const roas = spend > 0 ? revenue / spend : 0

      const perf = { spend, leads, cpl, ctr, roas }
      return {
        campaignId: c.campaign_id,
        campaignName: c.campaign_name,
        status: 'ACTIVE' as const,
        score: calcScore(perf),
        spend, leads, cpl, ctr, roas,
        impressions, clicks,
      }
    })
  }, [meta])

  const ruleInsights = useMemo(() =>
    generateRuleInsights(campaigns, filteredLeads.length, totalSpend),
    [campaigns, filteredLeads.length, totalSpend]
  )

  const allInsights = useMemo(() => [...deepInsights, ...ruleInsights], [deepInsights, ruleInsights])

  const scoreCount = useMemo(() => ({
    good: campaigns.filter(c => c.score === 'good').length,
    attention: campaigns.filter(c => c.score === 'attention').length,
    bad: campaigns.filter(c => c.score === 'bad').length,
  }), [campaigns])

  async function runDeepAnalysis() {
    setDeepLoading(true)
    try {
      const res = await fetch('/api/bi/intelligence')
      if (res.ok) {
        setDeepInsights(insightsFromIntelligence(await res.json()))
      }
    } catch { /* silently fail */ }
    finally { setDeepLoading(false) }
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header da Central ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Radio size={18} className="text-orange-400 animate-pulse" />
            Central de Comando
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Análise automática ativa · {campaigns.length} campanhas monitoradas
          </p>
        </div>
        <button
          onClick={runDeepAnalysis}
          disabled={deepLoading}
          className="flex items-center gap-2 h-9 px-4 rounded-full text-xs font-bold bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 text-purple-300 hover:from-purple-600/30 hover:to-pink-600/30 transition-all disabled:opacity-50"
        >
          <Sparkles size={13} className={deepLoading ? 'animate-spin' : ''} />
          {deepLoading ? 'Analisando…' : 'Análise Profunda (Atribuição)'}
        </button>
      </div>

      {/* ── KPIs em tempo real ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div onClick={() => setActiveView('jornada')} className="cursor-pointer">
          <KpiBar icon={Users} label="Leads (período)" value={filteredLeads.length.toLocaleString('pt-BR')} color="#0ea5e9" />
        </div>
        <div onClick={() => setActiveView('ads')} className="cursor-pointer">
          <KpiBar icon={DollarSign} label="Investimento Meta" value={`R$ ${totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="#f59e0b" />
        </div>
        <div onClick={() => setActiveView('ads')} className="cursor-pointer">
          <KpiBar icon={MousePointerClick} label="Cliques" value={totalClicks.toLocaleString('pt-BR')} color="#a855f7" />
        </div>
        <div onClick={() => setActiveView('ads')} className="cursor-pointer">
          <KpiBar icon={Target} label="CTR Global" value={`${(globalCtr * 100).toFixed(2)}%`} color="#10b981" />
        </div>
      </div>

      {/* ── Status das Campanhas + Insights ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Status resumo das campanhas */}
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <BarChart3 size={15} className="text-orange-400" />
              Status das Campanhas Ativas
            </h3>
            <button onClick={() => setActiveView('ads')} className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1">
              Ver todas <ArrowRight size={12} />
            </button>
          </div>

          {/* Score overview */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { score: 'good' as CampaignScore, count: scoreCount.good },
              { score: 'attention' as CampaignScore, count: scoreCount.attention },
              { score: 'bad' as CampaignScore, count: scoreCount.bad },
            ].map(({ score, count }) => {
              const cfg = SCORE_CONFIG[score]
              return (
                <div key={score} className="flex flex-col items-center gap-1 py-3 rounded-xl"
                  style={{ backgroundColor: cfg.bg }}>
                  <span className="text-2xl font-black" style={{ color: cfg.color }}>{count}</span>
                  <span className="text-[11px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                </div>
              )
            })}
          </div>

          {/* Mini lista das campanhas */}
          <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
            {campaigns.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-4">Nenhuma campanha com dados disponíveis</p>
            ) : (
              campaigns.slice(0, 8).map(c => (
                <div key={c.campaignId}
                  onClick={() => setActiveView('ads')}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] cursor-pointer transition-all">
                  <span className="text-xs font-medium text-zinc-300 truncate flex-1">{c.campaignName}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-zinc-500">R${c.spend.toFixed(0)}</span>
                    <ScoreBadge score={c.score} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Painel de Insights da IA */}
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Cpu size={15} className="text-purple-400" />
              Assistente de IA — Ações Recomendadas
            </h3>
            <button onClick={() => setActiveView('assistente')} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
              Ver todos <ArrowRight size={12} />
            </button>
          </div>

          <div className="flex flex-col gap-2.5 max-h-[340px] overflow-y-auto pr-1">
            {allInsights.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Sparkles size={24} className="text-zinc-700" />
                <p className="text-xs text-zinc-500 text-center">
                  Sem alertas ativos no momento.{' '}
                  <button onClick={runDeepAnalysis} className="text-purple-400 hover:underline">
                    Rodar análise profunda
                  </button>
                </p>
              </div>
            ) : (
              allInsights.map(insight => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onAction={i => {
                    if (i.action === 'pause_campaign' || i.action === 'increase_budget' || i.action === 'review_creative') {
                      setActiveView('ads')
                    }
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Atalhos Rápidos ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: Users,        label: 'Jornada dos Leads',  view: 'jornada',    color: '#0ea5e9' },
          { icon: BarChart3,    label: 'Gestão de Ads',      view: 'ads',        color: '#f59e0b' },
          { icon: Sparkles,     label: 'Assistente IA',      view: 'assistente', color: '#a855f7' },
          { icon: TrendingUp,   label: 'Redes Sociais',      view: 'social',     color: '#10b981' },
          { icon: ShoppingBag,  label: 'Funil Inteligente',  view: 'funil',      color: '#f43f5e' },
          { icon: Zap,          label: 'Integrações',        view: 'integracoes',color: '#64748b' },
        ].map(item => (
          <button
            key={item.view}
            onClick={() => setActiveView(item.view as import('../../types').ActiveView)}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-all group"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110"
              style={{ background: `${item.color}14` }}>
              <item.icon size={18} style={{ color: item.color }} />
            </div>
            <span className="text-[11px] font-semibold text-zinc-400 group-hover:text-zinc-200 text-center leading-tight transition-colors">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
