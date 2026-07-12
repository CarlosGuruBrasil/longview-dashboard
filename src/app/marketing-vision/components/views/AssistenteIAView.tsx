'use client'

import { useState, useMemo } from 'react'
import { Cpu, Sparkles, CheckCircle2, X, Play, RefreshCw, Clock } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { insightsFromIntelligence } from '../../lib/deep-insights'
import type { AIInsight, AIInsightType, CampaignPerformance, CampaignScore } from '../../types'

// ── Score calc ────────────────────────────────────────────────────────────────
function calcScore(c: { spend: number; leads: number; cpl: number; ctr: number }): CampaignScore {
  if (c.leads === 0 && c.spend > 50) return 'bad'
  if (c.ctr < 0.005 && c.spend > 20) return 'bad'
  if (c.cpl > 0 && c.cpl < 80 && c.ctr >= 0.01) return 'good'
  if (c.cpl >= 80 && c.cpl <= 150) return 'attention'
  if (c.ctr >= 0.005 && c.ctr < 0.01) return 'attention'
  return 'unknown'
}

function generateInsights(campaigns: CampaignPerformance[], totalLeads: number, totalSpend: number): AIInsight[] {
  const insights: AIInsight[] = []
  const now = new Date().toISOString()

  campaigns.forEach(c => {
    if (c.score === 'bad' && c.status === 'ACTIVE') {
      insights.push({
        id: `bad-${c.campaignId}`,
        type: 'critical',
        title: `Pausar campanha: "${c.campaignName}"`,
        description: `CPL de R$${c.cpl.toFixed(2)} e CTR de ${(c.ctr * 100).toFixed(2)}%. A campanha está consumindo orçamento sem resultados satisfatórios.`,
        action: 'pause_campaign',
        actionLabel: 'Ir para Gestão de Ads',
        generatedAt: now,
        source: 'rule',
      })
    }
    if (c.score === 'good') {
      insights.push({
        id: `opp-${c.campaignId}`,
        type: 'opportunity',
        title: `Escalar: "${c.campaignName}"`,
        description: `Performance excelente — CTR ${(c.ctr * 100).toFixed(2)}% e CPL de R$${c.cpl.toFixed(2)}. Oportunidade de aumentar o orçamento.`,
        action: 'increase_budget',
        actionLabel: 'Ver campanha',
        generatedAt: now,
        source: 'rule',
      })
    }
    if (c.leads === 0 && c.spend > 0) {
      insights.push({
        id: `nolead-${c.campaignId}`,
        type: 'warning',
        title: `"${c.campaignName}" gastou R$${c.spend.toFixed(0)} sem gerar leads`,
        description: 'Revise o formulário de lead ou a landing page associada a este anúncio.',
        action: 'review_creative',
        actionLabel: 'Ver criativo',
        generatedAt: now,
        source: 'rule',
      })
    }
  })

  if (totalLeads > 0 && totalSpend > 0) {
    const cpl = totalSpend / totalLeads
    insights.push({
      id: 'global-summary',
      type: cpl < 100 ? 'success' : cpl < 200 ? 'info' : 'warning',
      title: `CPL global atual: R$${cpl.toFixed(2)}`,
      description: cpl < 100
        ? 'Seu custo por lead está dentro do ideal. Continue monitorando as campanhas.'
        : `O CPL está ${cpl < 200 ? 'moderado' : 'elevado'}. Avalie desativar campanhas com baixo desempenho.`,
      generatedAt: now,
      source: 'rule',
    })
  }

  if (totalLeads === 0) {
    insights.push({
      id: 'no-leads-warning',
      type: 'warning',
      title: 'Nenhum lead registrado no período selecionado',
      description: 'Verifique os filtros de data ou sincronize os dados do CV CRM para garantir que os leads estejam atualizados.',
      action: 'sync_leads',
      actionLabel: 'Sincronizar leads',
      generatedAt: now,
      source: 'rule',
    })
  }

  return insights
}

// ── Type config ───────────────────────────────────────────────────────────────
const TYPE_CFG: Record<AIInsightType, { label: string; color: string; bg: string; border: string }> = {
  critical:    { label: 'Crítico',     color: '#f43f5e', bg: 'rgba(244,63,94,0.07)',   border: 'rgba(244,63,94,0.2)'   },
  warning:     { label: 'Atenção',     color: '#f59e0b', bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.2)'  },
  opportunity: { label: 'Oportunidade',color: '#a855f7', bg: 'rgba(168,85,247,0.07)', border: 'rgba(168,85,247,0.2)'  },
  success:     { label: 'Positivo',    color: '#10b981', bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.2)'  },
  info:        { label: 'Informação',  color: '#0ea5e9', bg: 'rgba(14,165,233,0.07)', border: 'rgba(14,165,233,0.2)'  },
}

function InsightCard({ insight, onDismiss }: { insight: AIInsight; onDismiss: (id: string) => void }) {
  const { setActiveView } = useData()
  const cfg = TYPE_CFG[insight.type]
  const date = new Date(insight.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="relative flex flex-col gap-2.5 p-4 rounded-2xl border transition-all"
      style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${cfg.color}15` }}>
          <Cpu size={15} style={{ color: cfg.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}>
              {cfg.label}
            </span>
            <span className="text-[10px] font-medium text-zinc-600 flex items-center gap-1">
              <Clock size={9} /> {date}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: insight.source === 'gemini' ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)', color: insight.source === 'gemini' ? '#a855f7' : '#71717a' }}>
              {insight.source === 'gemini' ? '✨ Análise Profunda' : '⚡ Automático'}
            </span>
          </div>
          <p className="text-sm font-bold text-zinc-100 mt-1.5">{insight.title}</p>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{insight.description}</p>
        </div>
        <button onClick={() => onDismiss(insight.id)}
          className="w-6 h-6 flex items-center justify-center rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-zinc-600 hover:text-zinc-400 transition-all shrink-0">
          <X size={12} />
        </button>
      </div>
      {insight.actionLabel && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => setActiveView(insight.action === 'sync_leads' ? 'leads' : 'ads')}
            className="text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all hover:opacity-80"
            style={{ color: cfg.color, borderColor: `${cfg.color}30`, backgroundColor: `${cfg.color}10` }}>
            <Play size={10} /> {insight.actionLabel}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AssistenteIAView() {
  const { metaData: meta, filteredLeads } = useData()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [deepLoading, setDeepLoading] = useState(false)
  const [deepInsights, setDeepInsights] = useState<AIInsight[]>([])
  const [filterType, setFilterType] = useState<AIInsightType | 'all'>('all')

  const totalSpend = parseFloat(meta?.global?.spend ?? '0')

  const campaigns: CampaignPerformance[] = useMemo(() => (meta?.campaigns ?? []).map((c: import('../../types').MetaCampaignInsight) => {
    const spend = parseFloat(c.spend ?? '0')
    const leads = parseInt((c.actions ?? []).find((a: import('../../types').MetaAction) => a.action_type === 'lead')?.value ?? '0')
    const clicks = parseInt(c.clicks ?? '0')
    const impressions = parseInt(c.impressions ?? '0')
    const ctr = impressions > 0 ? clicks / impressions : 0
    const cpl = leads > 0 ? spend / leads : 0
    const details = (meta?.campaignDetails ?? []).find((d: any) => String(d.id) === String(c.campaign_id));
    const status = (details?.status || 'UNKNOWN') as any;
    return { campaignId: c.campaign_id, campaignName: c.campaign_name, status, score: calcScore({ spend, leads, cpl, ctr }), spend, leads, cpl, ctr, roas: 0, impressions, clicks }
  }), [meta])

  const ruleInsights = useMemo(() => generateInsights(campaigns, filteredLeads.length, totalSpend), [campaigns, filteredLeads.length, totalSpend])

  const allInsights = useMemo(() =>
    [...deepInsights, ...ruleInsights].filter(i => !dismissed.has(i.id)),
    [deepInsights, ruleInsights, dismissed]
  )

  const filtered = useMemo(() =>
    filterType === 'all' ? allInsights : allInsights.filter(i => i.type === filterType),
    [allInsights, filterType]
  )

  async function runDeep() {
    setDeepLoading(true)
    try {
      const res = await fetch('/api/bi/intelligence')
      if (res.ok) {
        setDeepInsights(insightsFromIntelligence(await res.json()))
      }
    } catch { /* ignore */ }
    finally { setDeepLoading(false) }
  }

  const counts = useMemo(() => ({
    all: allInsights.length,
    critical: allInsights.filter(i => i.type === 'critical').length,
    warning: allInsights.filter(i => i.type === 'warning').length,
    opportunity: allInsights.filter(i => i.type === 'opportunity').length,
    success: allInsights.filter(i => i.type === 'success').length,
    info: allInsights.filter(i => i.type === 'info').length,
  }), [allInsights])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Cpu size={18} className="text-purple-400" />
            Assistente de IA — Ações Recomendadas
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {allInsights.length} insights ativos · {deepInsights.length} da análise profunda
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dismissed.size > 0 && (
            <button onClick={() => setDismissed(new Set())}
              className="flex items-center gap-1 h-8 px-3 rounded-full text-xs text-zinc-500 hover:text-zinc-300 border border-white/[0.07] bg-white/[0.02] transition-all">
              <RefreshCw size={11} /> Restaurar {dismissed.size}
            </button>
          )}
          <button onClick={runDeep} disabled={deepLoading}
            className="flex items-center gap-2 h-9 px-4 rounded-full text-xs font-bold bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 text-purple-300 hover:from-purple-600/30 transition-all disabled:opacity-50">
            <Sparkles size={13} className={deepLoading ? 'animate-spin' : ''} />
            {deepLoading ? 'Analisando…' : 'Análise Profunda (Atribuição)'}
          </button>
        </div>
      </div>

      {/* Filtros por tipo */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { key: 'all',         label: `Todos (${counts.all})` },
          { key: 'critical',    label: `🔴 Críticos (${counts.critical})` },
          { key: 'warning',     label: `🟡 Atenção (${counts.warning})` },
          { key: 'opportunity', label: `⚡ Oportunidades (${counts.opportunity})` },
          { key: 'success',     label: `✅ Positivos (${counts.success})` },
        ] as const).map(f => (
          <button key={f.key} onClick={() => setFilterType(f.key)}
            className={`h-7 px-3 rounded-full text-[11px] font-semibold border transition-all ${filterType === f.key ? 'bg-purple-500/15 border-purple-500/30 text-purple-300' : 'bg-white/[0.02] border-white/[0.07] text-zinc-500 hover:text-zinc-200'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista de insights */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <CheckCircle2 size={32} className="text-emerald-700" />
            <p className="text-zinc-400 text-sm font-semibold">Tudo certo! Sem alertas ativos.</p>
            <p className="text-xs text-zinc-600">
              Clique em &quot;Análise Profunda&quot; para gerar insights de atribuição (gasto × leads × receita).
            </p>
          </div>
        ) : (
          filtered.map(insight => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onDismiss={id => setDismissed(prev => new Set([...prev, id]))}
            />
          ))
        )}
      </div>
    </div>
  )
}
