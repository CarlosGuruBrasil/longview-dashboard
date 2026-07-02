'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, DollarSign, Target, AlertTriangle, Lightbulb, Users, BarChart3, ThumbsUp, MessageCircle, Globe } from 'lucide-react'
import GlassCard from '../ui/GlassCard'

// ── Types (copied from API response) ─────────────────────────────────────────

interface CampaignAttr {
  campaignId: string; campaignName: string; status: string
  spend: number; impressions: number; clicks: number
  leadsFromAds: number; leadsInCrm: number; salesInCrm: number
  revenue: number; cpl: number; roas: number
}

interface DevIntel {
  nome: string; leads: number; visits: number; sales: number
  vgv: number; avgTicket: number; conversionPct: number
  topCampaigns: string[]; avgDaysToSale: number | null
  campaignsCount?: number; activeCampaigns?: number
  spend?: number; metaLeads?: number
  impressions?: number; clicks?: number
  cpl?: number; roas?: number
}

interface SocialPost {
  id: string; platform: 'facebook' | 'instagram'
  mediaType?: string; caption?: string; message?: string
  permalink?: string; mediaUrl?: string; thumbnailUrl?: string
  createdAt: string; likes: number; comments: number
  engagementRate: number
}

interface AudienceItem {
  gender: string; age: string; impressions: number
  spend: number; reach: number; percentage: number
}

interface ChannelPerf {
  channel: string; spend: number; leads: number
  sales: number; revenue: number; roas: number; cpl: number
}

interface IntelData {
  summary: { totalSpend: number; totalLeads: number; totalSales: number; totalRevenue: number; overallRoas: number; overallCpl: number; activeCampaigns: number; totalCampaigns: number }
  campaignAttribution: CampaignAttr[]
  developmentIntelligence: DevIntel[]
  channelPerformance: ChannelPerf[]
  socialMedia: { totalPosts: number; totalEngagement: number; avgEngagementRate: number; bestPost: SocialPost | null; posts?: SocialPost[]; postsByPlatform: { facebook: number; instagram: number } }
  audience: AudienceItem[]
  investmentRecommendations: { campanhasParaEscalar: string[]; campanhasParaPausar: string[]; canaisMaisEficientes: string[]; oportunidadesIdentificadas: string[] }
}

function fmt(v: number) { return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) }
function fmtK(v: number) {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `R$${Math.round(v / 1_000)}k`
  return `R$${Math.round(v)}`
}
function fmtPct(v: number) { return `${(v * 100).toFixed(1)}%` }
function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR')
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-1 overflow-hidden min-w-0">
      <span className="text-[11px] font-medium text-zinc-500 truncate">{label}</span>
      <span className="text-2xl font-bold truncate" style={{ color }}>{value}</span>
      {sub && <span className="text-[11px] text-zinc-600 truncate">{sub}</span>}
    </div>
  )
}

function CampaignRow({ c }: { c: CampaignAttr }) {
  const roasColor = c.roas >= 2 ? '#10b981' : c.roas >= 1 ? '#f59e0b' : '#ef4444'
  return (
    <tr className="border-t border-white/5 hover:bg-white/5 transition-colors text-xs">
      <td className="py-2 px-2 max-w-[180px] truncate text-zinc-100">{c.campaignName}</td>
      <td className="py-2 px-2">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${c.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-500/20 text-zinc-400'}`}>
          {c.status}
        </span>
      </td>
      <td className="py-2 px-2 text-amber-400 font-semibold whitespace-nowrap">{fmtK(c.spend)}</td>
      <td className="py-2 px-2 text-zinc-300">{fmt(c.leadsInCrm)}</td>
      <td className="py-2 px-2 text-zinc-300">{fmt(c.salesInCrm)}</td>
      <td className="py-2 px-2 text-emerald-400 font-semibold whitespace-nowrap">{fmtK(c.revenue)}</td>
      <td className="py-2 px-2 font-semibold whitespace-nowrap" style={{ color: roasColor }}>{c.roas.toFixed(1)}x</td>
      <td className="py-2 px-2 text-zinc-400 whitespace-nowrap">{fmtK(c.cpl)}</td>
    </tr>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function IntelligenceView() {
  const [data, setData] = useState<IntelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [campaignSort, setCampaignSort] = useState<'roas' | 'spend' | 'leadsInCrm'>('roas')
  const [postSort, setPostSort] = useState<'recent' | 'engagement'>('engagement')
  const [activeTab, setActiveTab] = useState<'attribution' | 'social' | 'audience' | 'devs'>('attribution')

  useEffect(() => {
    let active = true
    fetch('/api/bi/intelligence')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (active) setData(d) })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: '60vh' }}>
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-zinc-400">Gerando inteligência de marketing...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: '60vh' }}>
        <AlertTriangle size={32} className="text-amber-400" />
        <p className="text-sm text-zinc-400">Não foi possível carregar dados de inteligência</p>
      </div>
    )
  }

  const { summary, campaignAttribution, developmentIntelligence, channelPerformance, socialMedia, audience, investmentRecommendations } = data

  // Sort campaigns
  const sortedCampaigns = [...campaignAttribution].sort((a, b) => {
    if (campaignSort === 'roas') return b.roas - a.roas
    if (campaignSort === 'spend') return b.spend - a.spend
    return b.leadsInCrm - a.leadsInCrm
  })

  // Best/worst devs
  const topDev = developmentIntelligence[0]
  const worstDev = developmentIntelligence[developmentIntelligence.length - 1]

  return (
    <div className="flex flex-col gap-6">

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="Investimento Total" value={fmtK(summary.totalSpend)} sub={`${summary.activeCampaigns}/${summary.totalCampaigns} campanhas ativas`} color="#f59e0b" />
        <StatBox label="Leads" value={fmt(summary.totalLeads)} sub={`${summary.overallCpl > 0 ? `CPL médio ${fmtK(summary.overallCpl)}` : 'Sem dados de spend'}`} color="#0ea5e9" />
        <StatBox label="Vendas" value={fmt(summary.totalSales)} sub={`Receita: ${fmtK(summary.totalRevenue)}`} color="#10b981" />
        <StatBox label="ROAS Geral" value={summary.overallRoas > 0 ? `${summary.overallRoas.toFixed(1)}x` : '—'} sub={summary.overallRoas >= 2 ? '✅ Acima da meta (2x)' : summary.overallRoas > 0 ? '⚠ Abaixo da meta' : 'Sem dados'} color={summary.overallRoas >= 2 ? '#10b981' : '#f59e0b'} />
      </div>

      {/* Investment Recommendations */}
      {investmentRecommendations.oportunidadesIdentificadas.length > 0 && (
        <GlassCard title="🎯 Oportunidades e Alertas">
          <div className="flex flex-col gap-2">
            {investmentRecommendations.oportunidadesIdentificadas.map((op, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                <Lightbulb size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <span>{op}</span>
              </div>
            ))}
            {investmentRecommendations.campanhasParaEscalar.length > 0 && (
              <div className="flex items-start gap-2 text-sm text-emerald-300 mt-1">
                <TrendingUp size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>Escalar campanhas: {investmentRecommendations.campanhasParaEscalar.join(', ')}</span>
              </div>
            )}
            {investmentRecommendations.campanhasParaPausar.length > 0 && (
              <div className="flex items-start gap-2 text-sm text-red-300 mt-1">
                <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <span>Avaliar pausa: {investmentRecommendations.campanhasParaPausar.join(', ')}</span>
              </div>
            )}
            {investmentRecommendations.canaisMaisEficientes.length > 0 && (
              <div className="flex items-start gap-2 text-sm text-sky-300 mt-1">
                <Target size={14} className="text-sky-400 shrink-0 mt-0.5" />
                <span>Canais + eficientes: {investmentRecommendations.canaisMaisEficientes.join(', ')}</span>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 pb-0 overflow-x-auto">
        {[
          { key: 'attribution' as const, label: 'Campanhas × ROAS', icon: DollarSign },
          { key: 'social' as const, label: 'Redes Sociais', icon: Globe },
          { key: 'audience' as const, label: 'Público', icon: Users },
          { key: 'devs' as const, label: 'Empreendimentos', icon: BarChart3 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px shrink-0 ${
              activeTab === key
                ? 'border-orange-400 text-orange-400 bg-orange-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Campaign Attribution */}
      {activeTab === 'attribution' && (
        <div className="flex flex-col gap-4">
          {/* Sort toggles */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Ordenar por:</span>
            {([
              { key: 'roas' as const, label: 'ROAS' },
              { key: 'spend' as const, label: 'Gasto' },
              { key: 'leadsInCrm' as const, label: 'Leads' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setCampaignSort(key)}
                className={`px-2 py-1 rounded-md transition-colors ${
                  campaignSort === key
                    ? 'bg-orange-500/20 text-orange-400 font-semibold'
                    : 'bg-white/5 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Campaign table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 text-[10px] uppercase font-semibold">
                  <th className="text-left py-2 px-2">Campanha</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-right py-2 px-2">Gasto</th>
                  <th className="text-right py-2 px-2">Leads CRM</th>
                  <th className="text-right py-2 px-2">Vendas</th>
                  <th className="text-right py-2 px-2">Receita</th>
                  <th className="text-right py-2 px-2">ROAS</th>
                  <th className="text-right py-2 px-2">CPL</th>
                </tr>
              </thead>
              <tbody>
                {sortedCampaigns.map(c => (
                  <CampaignRow key={c.campaignId} c={c} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Channel performance */}
          {channelPerformance.length > 0 && (
            <GlassCard title="Performance por Canal (Origem)">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-500 text-[10px] uppercase font-semibold">
                      <th className="text-left py-2 px-2">Canal</th>
                      <th className="text-right py-2 px-2">Leads</th>
                      <th className="text-right py-2 px-2">Vendas</th>
                      <th className="text-right py-2 px-2">Receita</th>
                      <th className="text-right py-2 px-2">ROAS</th>
                      <th className="text-right py-2 px-2">CPL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channelPerformance.filter(c => c.leads > 0).map(ch => (
                      <tr key={ch.channel} className="border-t border-white/5 text-xs hover:bg-white/5">
                        <td className="py-2 px-2 text-zinc-100 max-w-[140px] truncate">{ch.channel}</td>
                        <td className="py-2 px-2 text-right text-zinc-300">{fmt(ch.leads)}</td>
                        <td className="py-2 px-2 text-right text-zinc-300">{fmt(ch.sales)}</td>
                        <td className="py-2 px-2 text-right text-emerald-400 font-semibold">{fmtK(ch.revenue)}</td>
                        <td className="py-2 px-2 text-right font-semibold" style={{ color: ch.roas >= 2 ? '#10b981' : '#f59e0b' }}>{ch.roas.toFixed(1)}x</td>
                        <td className="py-2 px-2 text-right text-zinc-400">{fmtK(ch.cpl)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* Tab: Social Media */}
      {activeTab === 'social' && (
        <div className="flex flex-col gap-4">
          {/* Social summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Total Posts" value={fmt(socialMedia.totalPosts)} sub={`${socialMedia.postsByPlatform.facebook} FB · ${socialMedia.postsByPlatform.instagram} IG`} color="#a855f7" />
            <StatBox label="Engajamento Total" value={fmt(socialMedia.totalEngagement)} sub="likes + comentários" color="#06b6d4" />
            <StatBox label="Taxa Média" value={fmtPct(socialMedia.avgEngagementRate)} sub="engajamento / alcance estimado" color="#10b981" />
            {socialMedia.bestPost && (
              <StatBox label="Melhor Post" value={`${socialMedia.bestPost.likes + socialMedia.bestPost.comments} interações`} sub={fmtPct(socialMedia.bestPost.engagementRate)} color="#f59e0b" />
            )}
          </div>

          {/* Posts */}
          {(socialMedia.totalPosts > 0) && (
            <GlassCard
              title={`Posts (${socialMedia.totalPosts})`}
              action={
                <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
                  {([['engagement', 'Engajamento'], ['recent', 'Recentes']] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setPostSort(key)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        postSort === key ? 'bg-orange-500/20 text-orange-400' : 'text-zinc-500 hover:text-zinc-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="flex flex-col gap-3 max-h-[560px] overflow-y-auto pr-1">
                {[...(socialMedia.posts ?? (socialMedia.bestPost ? [socialMedia.bestPost] : []))]
                  .sort((a, b) => postSort === 'recent'
                    ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    : (b.likes + b.comments) - (a.likes + a.comments))
                  .map(post => {
                  const isBest = socialMedia.bestPost?.id === post.id
                  return (
                    <div key={post.id} className={`rounded-xl border p-3 flex items-start gap-3 ${isBest ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-white/5'}`}>
                      {post.thumbnailUrl ? (
                        <img src={post.thumbnailUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                      ) : post.mediaType === 'VIDEO' ? (
                        <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs shrink-0">🎬</div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs shrink-0">
                          {post.platform === 'instagram' ? <Globe size={16} className="text-pink-400" /> : <Globe size={16} className="text-sky-400" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold uppercase ${post.platform === 'instagram' ? 'text-pink-400' : 'text-sky-400'}`}>
                            {post.platform}
                          </span>
                          {isBest && <span className="text-[10px] font-bold text-amber-400">⭐ MELHOR</span>}
                          <span className="text-[10px] text-zinc-600 ml-auto">{fmtDate(post.createdAt)}</span>
                        </div>
                        <p className="text-xs text-zinc-300 mt-1 line-clamp-2">{post.message || post.caption || '(sem texto)'}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                          <span className="flex items-center gap-1 text-zinc-400"><ThumbsUp size={11} /> {fmt(post.likes)}</span>
                          <span className="flex items-center gap-1 text-zinc-400"><MessageCircle size={11} /> {fmt(post.comments)}</span>
                          <span className="text-zinc-600">{fmtPct(post.engagementRate)} engaj.</span>
                          {post.permalink && (
                            <a
                              href={post.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto text-sky-400 hover:text-sky-300 font-medium"
                            >
                              Ver post ↗
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </GlassCard>
          )}

          {socialMedia.totalPosts === 0 && (
            <GlassCard title="Redes Sociais">
              <p className="text-sm text-zinc-500 py-6 text-center">
                Nenhum post encontrado. Conecte a página do Facebook e conta do Instagram nas configurações do Meta.
              </p>
            </GlassCard>
          )}
        </div>
      )}

      {/* Tab: Audience */}
      {activeTab === 'audience' && (
        <div className="flex flex-col gap-4">
          {audience.length > 0 && (() => {
            const sorted = [...audience].sort((a, b) => b.impressions - a.impressions)
            const top = sorted[0]
            const byGender = new Map<string, number>()
            audience.forEach(a => byGender.set(a.gender, (byGender.get(a.gender) ?? 0) + a.impressions))
            const totalImp = audience.reduce((s, a) => s + a.impressions, 0)
            const genderSplit = Array.from(byGender.entries())
              .map(([g, imp]) => `${g}: ${totalImp > 0 ? Math.round((imp / totalImp) * 100) : 0}%`)
              .join(' · ')
            return (
              <div className="bg-sky-500/5 border border-sky-500/20 rounded-2xl p-4">
                <p className="text-[10px] font-semibold uppercase text-sky-400 tracking-wider">🎯 Seu público principal</p>
                <p className="text-lg font-bold text-white mt-1">
                  {top.gender}, {top.age} anos <span className="text-sm font-medium text-zinc-400">({top.percentage.toFixed(1)}% das impressões)</span>
                </p>
                <p className="text-xs text-zinc-400 mt-1">{genderSplit}</p>
                <p className="text-xs text-zinc-500 mt-0.5">Use esse recorte para criar campanhas segmentadas e criativos direcionados.</p>
              </div>
            )
          })()}
          {audience.length > 0 ? (
            <GlassCard title="Distribuição por Gênero e Idade">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-500 text-[10px] uppercase font-semibold">
                      <th className="text-left py-2 px-2">Gênero</th>
                      <th className="text-left py-2 px-2">Idade</th>
                      <th className="text-right py-2 px-2">Impressões</th>
                      <th className="text-right py-2 px-2">%</th>
                      <th className="text-right py-2 px-2">Gasto</th>
                      <th className="text-right py-2 px-2">Alcance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...audience].sort((a, b) => b.impressions - a.impressions).map((a, i) => (
                      <tr key={i} className="border-t border-white/5 text-xs hover:bg-white/5">
                        <td className="py-2 px-2 text-zinc-100">{a.gender}</td>
                        <td className="py-2 px-2 text-zinc-300">{a.age}</td>
                        <td className="py-2 px-2 text-right text-zinc-300">{fmt(a.impressions)}</td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2 justify-end">
                            <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden shrink-0">
                              <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(a.percentage, 100)}%` }} />
                            </div>
                            <span className="text-zinc-400 w-10 text-right">{a.percentage.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right text-amber-400">{fmtK(a.spend)}</td>
                        <td className="py-2 px-2 text-right text-zinc-300">{fmt(a.reach)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          ) : (
            <GlassCard title="Público-Alvo">
              <p className="text-sm text-zinc-500 py-6 text-center">
                Dados demográficos não disponíveis. Execute campanhas no Meta Ads para coletar dados de audiência.
              </p>
            </GlassCard>
          )}
        </div>
      )}

      {/* Tab: Developments */}
      {activeTab === 'devs' && (
        <div className="flex flex-col gap-4">
          {/* Um card completo por empreendimento: comercial + marketing lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {developmentIntelligence.map(d => {
              const isTop = d.nome === topDev?.nome
              const convColor = d.conversionPct >= 5 ? '#10b981' : d.conversionPct >= 2 ? '#f59e0b' : '#ef4444'
              return (
                <div key={d.nome} className={`rounded-2xl p-4 border ${isTop ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/5 border-white/10'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-lg font-bold text-white truncate">{isTop && '🏆 '}{d.nome}</p>
                    <span className="text-[11px] font-semibold shrink-0" style={{ color: convColor }}>{d.conversionPct}% conv.</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase text-zinc-500">Leads</p>
                      <p className="text-base font-bold text-sky-400 truncate">{fmt(d.leads)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase text-zinc-500">Visitas</p>
                      <p className="text-base font-bold text-zinc-200 truncate">{fmt(d.visits)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase text-zinc-500">Vendas</p>
                      <p className="text-base font-bold text-emerald-400 truncate">{fmt(d.sales)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase text-zinc-500">VGV</p>
                      <p className="text-base font-bold text-emerald-400 truncate">{fmtK(d.vgv)}</p>
                    </div>
                  </div>

                  <div className="border-t border-white/10 mt-3 pt-3 grid grid-cols-4 gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase text-zinc-500">Campanhas</p>
                      <p className="text-base font-bold text-zinc-200 truncate">
                        {d.campaignsCount ?? 0}
                        {(d.activeCampaigns ?? 0) > 0 && <span className="text-[10px] font-medium text-emerald-400 ml-1">({d.activeCampaigns} ativas)</span>}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase text-zinc-500">Investido</p>
                      <p className="text-base font-bold text-amber-400 truncate">{fmtK(d.spend ?? 0)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase text-zinc-500">CPL</p>
                      <p className="text-base font-bold text-zinc-200 truncate">{(d.cpl ?? 0) > 0 ? fmtK(d.cpl!) : '—'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase text-zinc-500">ROAS</p>
                      <p className="text-base font-bold truncate" style={{ color: (d.roas ?? 0) >= 2 ? '#10b981' : '#f59e0b' }}>
                        {(d.roas ?? 0) > 0 ? `${d.roas!.toFixed(1)}x` : '—'}
                      </p>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-500 mt-2.5 truncate">
                    {fmt(d.impressions ?? 0)} impressões · {fmt(d.clicks ?? 0)} cliques · {fmt(d.metaLeads ?? 0)} leads Meta
                    {d.avgDaysToSale ? ` · ciclo ${d.avgDaysToSale}d` : ''}
                    {d.avgTicket > 0 ? ` · ticket ${fmtK(d.avgTicket)}` : ''}
                  </p>
                  {d.topCampaigns.length > 0 && (
                    <p className="text-[11px] text-zinc-600 mt-0.5 truncate" title={d.topCampaigns.join(', ')}>
                      Principais mídias: {d.topCampaigns.join(', ')}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          {worstDev && worstDev.nome !== topDev?.nome && worstDev.leads >= 30 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3 text-xs text-amber-300">
              ⚠ <strong>{worstDev.nome}</strong> tem a pior relação leads→vendas ({worstDev.conversionPct}% em {fmt(worstDev.leads)} leads) — alinhar marketing e comercial sobre qualidade e follow-up.
            </div>
          )}

          {/* Dev table */}
          <GlassCard title="Comparativo — Comercial × Marketing">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 text-[10px] uppercase font-semibold">
                    <th className="text-left py-2 px-2">Empreendimento</th>
                    <th className="text-right py-2 px-2">Campanhas</th>
                    <th className="text-right py-2 px-2">Investido</th>
                    <th className="text-right py-2 px-2">Leads</th>
                    <th className="text-right py-2 px-2">CPL</th>
                    <th className="text-right py-2 px-2">Visitas</th>
                    <th className="text-right py-2 px-2">Vendas</th>
                    <th className="text-right py-2 px-2">VGV</th>
                    <th className="text-right py-2 px-2">ROAS</th>
                    <th className="text-right py-2 px-2">Conv.</th>
                    <th className="text-right py-2 px-2">Ciclo</th>
                  </tr>
                </thead>
                <tbody>
                  {developmentIntelligence.map(d => {
                    const convColor = d.conversionPct >= 5 ? '#10b981' : d.conversionPct >= 2 ? '#f59e0b' : '#ef4444'
                    return (
                      <tr key={d.nome} className="border-t border-white/5 text-xs hover:bg-white/5">
                        <td className="py-2 px-2 text-zinc-100 max-w-[160px] truncate">{d.nome}</td>
                        <td className="py-2 px-2 text-right text-zinc-300">{d.campaignsCount ?? 0}</td>
                        <td className="py-2 px-2 text-right text-amber-400">{fmtK(d.spend ?? 0)}</td>
                        <td className="py-2 px-2 text-right text-zinc-300">{fmt(d.leads)}</td>
                        <td className="py-2 px-2 text-right text-zinc-300">{(d.cpl ?? 0) > 0 ? fmtK(d.cpl!) : '—'}</td>
                        <td className="py-2 px-2 text-right text-zinc-300">{fmt(d.visits)}</td>
                        <td className="py-2 px-2 text-right text-zinc-300">{fmt(d.sales)}</td>
                        <td className="py-2 px-2 text-right text-emerald-400 font-semibold">{fmtK(d.vgv)}</td>
                        <td className="py-2 px-2 text-right font-semibold" style={{ color: (d.roas ?? 0) >= 2 ? '#10b981' : '#f59e0b' }}>{(d.roas ?? 0) > 0 ? `${d.roas!.toFixed(1)}x` : '—'}</td>
                        <td className="py-2 px-2 text-right font-semibold" style={{ color: convColor }}>{d.conversionPct}%</td>
                        <td className="py-2 px-2 text-right text-zinc-400">{d.avgDaysToSale ? `${d.avgDaysToSale}d` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  )
}
