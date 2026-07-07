'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Info,
  Lightbulb, Users, DollarSign, Target, Clock, ShoppingCart,
  BarChart3, Activity, Globe, ArrowRight, Layers, HelpCircle,
  Megaphone, Compass, Eye, MousePointerClick, ChevronDown
} from 'lucide-react'
import { useData } from '../../context/DataContext'
import { generateInsights, type Insight } from '../../utils/insights'
import { isSale, getLeadValueNumber, getStatusColor, getOrigin } from '../../utils/leads'
import { formatCurrency, formatNumber } from '../../utils/formatters'
import GlassCard from '../ui/GlassCard'
import FilterBar from '../ui/FilterBar'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { BiInsights } from '../../types'
import logger from '@/lib/logger'


const TICK = '#71717a'
const GRID = 'rgba(255,255,255,0.05)'
const PALETTE = ['#0ea5e9', '#a855f7', '#f59e0b', '#10b981', '#f43f5e', '#64748b', '#06b6d4', '#ec4899']

const EMPREENDIMENTOS_KEYWORDS = [
  { id: 3, nome: 'HUB Beira Mar', keywords: ['hub', 'beira mar', 'beiramar', 'beira-mar'] },
  { id: 4, nome: 'Nautic', keywords: ['nautic'] },
  { id: 5, nome: 'Infiniti', keywords: ['infiniti'] },
  { id: 6, nome: 'Campeche', keywords: ['campeche'] },
  { id: 7, nome: 'Floripa', keywords: ['floripa'] }
]

function formatK(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}k`
  return formatCurrency(v)
}

// ── Alert Card ──
function AlertCard({ insight }: { insight: Insight }) {
  const colors = {
    critical: { border: '#ef4444', bg: 'rgba(239,68,68,0.08)', icon: AlertTriangle, iconColor: '#ef4444' },
    warning: { border: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: AlertTriangle, iconColor: '#f59e0b' },
    positive: { border: '#10b981', bg: 'rgba(16,185,129,0.08)', icon: CheckCircle2, iconColor: '#10b981' },
    info: { border: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', icon: Info, iconColor: '#0ea5e9' },
  }
  const c = colors[insight.type]

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2.5 border"
      style={{ background: c.bg, borderColor: c.border }}
    >
      <div className="flex items-start gap-2.5">
        <c.icon size={18} style={{ color: c.iconColor, marginTop: 1 }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{insight.title}</p>
          {insight.description && (
            <p className="text-xs text-zinc-400 mt-0.5">{insight.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-start gap-2 pl-[26px]">
        <Lightbulb size={13} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-300 leading-relaxed">{insight.action}</p>
      </div>
    </div>
  )
}

// ── KPI Card Clicável ──
function SmartKpi({
  icon: Icon, label, value, sub, color, onClick
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string; onClick?: () => void
}) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col gap-2 relative overflow-hidden min-w-0 transition-all ${
        onClick ? 'cursor-pointer hover:bg-white/[0.08] hover:border-orange-500/40 hover:scale-[1.01] active:scale-[0.99]' : ''
      }`}
      style={{ backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 100%)' }}
    >
      <div className="flex items-center justify-between min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}20` }}>
            <Icon size={15} style={{ color }} />
          </div>
          <span className="text-[12px] text-zinc-400 font-medium truncate">{label}</span>
        </div>
      </div>
      <p className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white truncate" title={String(value)}>{value}</p>
      {sub && <p className="text-[11px] text-zinc-500 truncate" title={sub}>{sub}</p>}
      {onClick && (
        <div className="absolute right-3 top-3 text-zinc-500 opacity-60">
          <ArrowRight size={12} />
        </div>
      )}
    </div>
  )
}

export default function DashboardView() {
  const { allLeads, filteredLeads, crmTotal, loading, metaData, metaValidation, setActiveView, setLeadFilters } = useData()
  const [biData, setBiData] = useState<BiInsights | null>(null)
  const [, setBiLoading] = useState(true)
  const [empFilterStage, setEmpFilterStage] = useState<string>('')

  useEffect(() => {
    let active = true
    fetch('/api/bi/insights')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (active) setBiData(d) })
      .catch(() => logger.warn('[DashboardView] BI insights falhou'))
      .finally(() => { if (active) setBiLoading(false) })
    return () => { active = false }
  }, [])

  // Função de navegação por filtros
  const filterAndNavigate = (filters: { origem?: string; situacao?: string; empreendimento?: string }) => {
    setLeadFilters(filters)
    setActiveView('leads')
  }

  // Identifica leads pagos do Meta de forma extremamente segura e abrangente
  const metaLeads = useMemo(() => {
    return filteredLeads.filter(l => {
      const orig = getOrigin(l).toLowerCase();
      const midia = String(l.midia_principal || l.midia_visita || '').toLowerCase();
      const rawOrigem = String(l.raw?.origem || '').toLowerCase();
      const rawMidia = String(l.raw?.midia_principal || '').toLowerCase();

      return orig.includes('facebook') || orig.includes('instagram') || orig.includes('meta') || orig.includes('anúncio') || orig.includes('ads') ||
             midia.includes('facebook') || midia.includes('instagram') || midia.includes('meta') || midia.includes('anúncio') || midia.includes('ads') ||
             rawOrigem.includes('facebook') || rawOrigem.includes('meta') || rawOrigem.includes('ads') ||
             rawMidia.includes('facebook') || rawMidia.includes('meta') || rawMidia.includes('ads') ||
             l.origem === 'Meta Lead Ads';
    });
  }, [filteredLeads]);

  // Identifica leads de outros canais
  const outrosLeads = useMemo(() => {
    return filteredLeads.filter(l => !metaLeads.some(ml => ml.id === l.id));
  }, [filteredLeads, metaLeads]);

  // Gasto total (Meta) no período
  const totalSpend = useMemo(() => {
    const campaigns = metaData?.campaigns || [];
    return campaigns.reduce((sum, c) => sum + Number(c.spend ?? 0), 0);
  }, [metaData]);

  // CPL médio do Meta Ads
  const avgCpl = metaLeads.length > 0 ? totalSpend / metaLeads.length : 0;

  // 1. Classificação e cruzamento inteligente de campanhas do Meta com leads do CRM por e-mail/telefone ou empreendimento
  const activeCampaignsData = useMemo(() => {
    const campaigns = metaData?.campaigns || [];
    return campaigns
      .map(c => {
        const spendVal = Number(c.spend ?? 0);
        const impressionsVal = Number(c.impressions ?? 0);
        const clicksVal = Number(c.clicks ?? 0);
        
        const cName = c.campaign_name || '';
        const cId = String(c.campaign_id || '').toLowerCase().trim();
        const target = cName.toLowerCase().trim();

        // Encontra a palavra-chave de empreendimento correspondente no nome da campanha
        const empMatch = EMPREENDIMENTOS_KEYWORDS.find(e => 
          e.keywords.some(kw => target.includes(kw))
        );
        const matchedEmpName = empMatch ? empMatch.nome : 'Outros / Geral';

        // Filtra leads do Meta para essa campanha usando correspondência direta ou semântica por empreendimento/tags
        const campLeads = metaLeads.filter(l => {
          if (!target || target.length < 3) return false;
          
          // 1. Match direto por campanha/utm no raw do lead (webhook/sync)
          const lCampName = String(l.raw?.campanha || l.raw?.utm_campaign || '').toLowerCase().trim();
          const lCampId = String(l.raw?.idcampanha || l.raw?.utm_campaign_id || '').toLowerCase().trim();
          if (cId && lCampId && (lCampId.includes(cId) || cId.includes(lCampId))) return true;
          if (lCampName && (lCampName.includes(target) || target.includes(lCampName))) return true;

          // 2. Match semântico por Empreendimento de Interesse do lead no CRM
          const lEmps = Array.isArray(l.empreendimento)
            ? l.empreendimento.map(e => (e.nome || '').toLowerCase())
            : [String((l.empreendimento as { nome?: string } | undefined)?.nome || '').toLowerCase()];

          const hasEmpMatch = empMatch 
            ? lEmps.some(le => le.includes(empMatch.nome.toLowerCase()) || empMatch.keywords.some(kw => le.includes(kw)))
            : false;

          // 3. Match semântico por Tags do lead no CRM
          const tags = Array.isArray(l.tags) ? l.tags.map(t => typeof t === 'string' ? t.toLowerCase() : (t.nome || '').toLowerCase()) : [];
          const hasTagMatch = empMatch
            ? tags.some(t => t.includes(empMatch.nome.toLowerCase()) || empMatch.keywords.some(kw => t.includes(kw)))
            : false;

          return hasEmpMatch || hasTagMatch;
        });

        // Obtém o status da campanha dos detalhes
        const details = metaData?.campaignDetails?.find(d => String(d.id) === String(c.campaign_id));
        const status = details?.status || 'ACTIVE';

        return {
          id: c.campaign_id,
          name: cName,
          status,
          empreendimento: matchedEmpName,
          spend: spendVal,
          impressions: impressionsVal,
          clicks: clicksVal,
          leadsCount: campLeads.length,
          cpl: campLeads.length > 0 ? spendVal / campLeads.length : spendVal,
          ctr: impressionsVal > 0 ? (clicksVal / impressionsVal) * 100 : 0
        };
      })
      // Lista as campanhas que tiveram investimento (spend) ou impressões no período
      .filter(c => c.spend > 0 || c.impressions > 0 || c.leadsCount > 0)
      .sort((a, b) => b.spend - a.spend);
  }, [metaData, metaLeads]);

  // 2. Classificação de leads em outras origens / canais orgânicos
  const outrosCanaisData = useMemo(() => {
    const map = new Map<string, number>();
    outrosLeads.forEach(l => {
      const orig = getOrigin(l);
      map.set(orig, (map.get(orig) ?? 0) + 1);
    });

    const total = outrosLeads.length;
    return Array.from(map.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);
  }, [outrosLeads]);

  // Lista amigável de onde vêm os leads orgânicos para o subtítulo
  const outrosCanaisSub = useMemo(() => {
    if (outrosCanaisData.length === 0) return 'Canais não-pagos no período';
    return outrosCanaisData
      .slice(0, 3)
      .map(c => `${c.name}: ${c.count}`)
      .join(' · ');
  }, [outrosCanaisData]);

  // 3. Classificação de leads por Etapas Reais do CRM
  const empOptions = useMemo(() => {
    const set = new Set<string>()
    filteredLeads.forEach(l => {
      const emp = l.empreendimento?.[0]?.nome
      if (emp) set.add(emp)
    })
    return Array.from(set).sort()
  }, [filteredLeads])

  const stageLeads = useMemo(() =>
    empFilterStage
      ? filteredLeads.filter(l => l.empreendimento?.[0]?.nome === empFilterStage)
      : filteredLeads,
    [filteredLeads, empFilterStage]
  )

  const etapasCrmData = useMemo(() => {
    const map = new Map<string, { count: number; colorObj: ReturnType<typeof getStatusColor> }>();
    stageLeads.forEach(l => {
      const stageName = l.situacao?.nome || 'Sem etapa';
      const existing = map.get(stageName) ?? { count: 0, colorObj: getStatusColor(l) };
      existing.count += 1;
      map.set(stageName, existing);
    });

    const total = stageLeads.length;
    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        percentage: total > 0 ? Math.round((data.count / total) * 100) : 0,
        colorObj: data.colorObj
      }))
      .sort((a, b) => b.count - a.count);
  }, [stageLeads]);

  // Crescimento de leads (mês atual vs mês anterior, baseado em allLeads)
  const crescimento = useMemo(() => {
    const now = new Date()
    const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const currMonth = ym(now)
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonth = ym(prevDate)

    let curr = 0, prev = 0
    for (const l of allLeads) {
      const d = l.data_cad ?? l.data_cadastro ?? l.data_cadastramento ?? ''
      if (!d) continue
      const m = d.slice(0, 7)
      if (m === currMonth) curr++
      else if (m === prevMonth) prev++
    }
    const pct = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null
    return { curr, prev, pct }
  }, [allLeads])

  // Mix de leads (mídia paga Meta vs orgânicos)
  const mixData = useMemo(() => [
    { name: 'Meta Ads', value: metaLeads.length, color: '#3b82f6' },
    { name: 'Canais Orgânicos / Outros', value: outrosLeads.length, color: '#a855f7' }
  ], [metaLeads, outrosLeads]);

  const insights = useMemo(() => generateInsights(biData, allLeads, metaData), [biData, allLeads, metaData])

  if (loading && allLeads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: '60vh' }}>
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <div className="absolute inset-0 rounded-full border-2 border-t-sky-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        </div>
        <p className="text-[15px] font-medium text-zinc-300">Carregando Smart Dashboard</p>
        <p className="text-[13px] text-zinc-500">Sincronizando dados e cruzando campanhas…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Filtros ── */}
      <FilterBar />

      {/* ── Alerta Vermelho de Leads Órfãos do Meta ── */}
      {metaValidation && metaValidation.orphanedLeads?.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="shrink-0 text-red-500 mt-0.5" size={18} />
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-sm text-white">Leads do Meta Ads Perdidos (Não Integrados)</span>
              <span className="text-xs text-zinc-400">
                Identificamos <strong>{metaValidation.orphanedLeads.length} leads</strong> captados em formulários do Meta que não constam no CV CRM.
              </span>
            </div>
          </div>
          <button
            onClick={() => setActiveView('leads')}
            className="shrink-0 h-9 px-4 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 hover:scale-[1.01]"
          >
            Ver no painel de validação <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* ── KPIs Principais com Comparação ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <SmartKpi
          icon={Users} label="Total de Leads Gerados" value={formatNumber(filteredLeads.length)}
          sub="Todos os canais no período" color="#0ea5e9"
          onClick={() => filterAndNavigate({})}
        />
        <SmartKpi
          icon={DollarSign} label="Investimento Meta Ads" value={formatCurrency(totalSpend)}
          sub="Valor gasto em mídia paga" color="#10b981"
          onClick={() => setActiveView('marketing')}
        />
        <SmartKpi
          icon={Megaphone} label="Leads Meta Ads" value={formatNumber(metaLeads.length)}
          sub="Leads vindos do Meta" color="#3b82f6"
          onClick={() => filterAndNavigate({ origem: 'facebook' })}
        />
        <SmartKpi
          icon={Compass} label="Outros Canais (Orgânicos)" value={formatNumber(outrosLeads.length)}
          sub={outrosCanaisSub} color="#a855f7"
          onClick={() => filterAndNavigate({ origem: 'Painel' })}
        />
        <SmartKpi
          icon={Target} label="Custo por Lead (CPL)" value={avgCpl > 0 ? formatCurrency(avgCpl) : '—'}
          sub="Valor gasto ÷ leads Meta" color="#f43f5e"
        />
      </div>

      {/* ── Seção A: Campanhas Meta Ads Ativas ── */}
      <GlassCard title={`Campanhas Meta Ads Ativas (${activeCampaignsData.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-zinc-500 text-xs uppercase font-semibold">
                <th className="text-left py-3 px-3">Status</th>
                <th className="text-left py-3 px-3">Campanha</th>
                <th className="text-left py-3 px-3">Empreendimento</th>
                <th className="text-right py-3 px-3">Investido (Spend)</th>
                <th className="text-right py-3 px-3">Views (Impressões)</th>
                <th className="text-right py-3 px-3">Cliques</th>
                <th className="text-right py-3 px-3">Leads Gerados</th>
                <th className="text-right py-3 px-3">CPL</th>
                <th className="text-right py-3 px-3">CTR</th>
              </tr>
            </thead>
            <tbody>
              {activeCampaignsData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-zinc-500 text-sm">
                    Nenhuma campanha do Meta Ads ativa ou com veiculação no período.
                  </td>
                </tr>
              ) : (
                activeCampaignsData.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => filterAndNavigate({ origem: c.name })}
                    className="border-b border-white/5 hover:bg-white/[0.04] cursor-pointer transition-colors text-zinc-300"
                  >
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center w-2 h-2 rounded-full ${
                        c.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'
                      }`} title={c.status === 'ACTIVE' ? 'Campanha Veiculando' : 'Campanha Inativa'} />
                    </td>
                    <td className="py-3 px-3 font-medium text-white">
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate max-w-[240px] font-semibold text-zinc-200" title={c.name}>{c.name}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">ID: {c.id}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="bg-orange-500/10 border border-orange-500/20 text-orange-400 px-2 py-0.5 rounded text-[11px] font-semibold">
                        {c.empreendimento}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-white">{formatCurrency(c.spend)}</td>
                    <td className="py-3 px-3 text-right font-mono text-xs text-zinc-400">{formatNumber(c.impressions)}</td>
                    <td className="py-3 px-3 text-right font-mono text-xs text-zinc-400">{formatNumber(c.clicks)}</td>
                    <td className="py-3 px-3 text-right font-bold text-orange-400">{c.leadsCount}</td>
                    <td className="py-3 px-3 text-right font-medium text-red-400">
                      {c.leadsCount > 0 ? formatCurrency(c.cpl) : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs text-sky-400">{c.ctr.toFixed(2)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Grid de Funil CRM & Canais Orgânicos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ── Seção B: Funil de Vendas e Etapas do CRM ── */}
        <GlassCard title="Etapas do Funil de Leads">
          <div className="flex flex-col gap-3">

            {/* Crescimento + filtro por empreendimento */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Crescimento */}
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Crescimento mês atual</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xl font-bold text-white">{stageLeads.length}</span>
                    {crescimento.pct !== null && (
                      <span className={`flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${
                        crescimento.pct >= 0
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-red-500/15 text-red-400'
                      }`}>
                        {crescimento.pct >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {crescimento.pct >= 0 ? '+' : ''}{crescimento.pct}%
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-600">vs {crescimento.prev} no mês anterior</span>
                  </div>
                </div>
              </div>

              {/* Filtro empreendimento */}
              <div className="relative">
                <select
                  value={empFilterStage}
                  onChange={e => setEmpFilterStage(e.target.value)}
                  className="appearance-none h-8 pl-3 pr-7 text-xs bg-white/[0.04] border border-white/[0.09] rounded-xl text-zinc-300 focus:outline-none focus:border-orange-500/40 transition-all cursor-pointer"
                >
                  <option value="">Todos os empreendimentos</option>
                  {empOptions.map(emp => (
                    <option key={emp} value={emp}>{emp}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>
            </div>

            {/* Barras de etapas */}
            <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
              {etapasCrmData.length === 0 ? (
                <p className="text-zinc-500 text-center text-xs py-8">Sem leads para distribuir nas etapas.</p>
              ) : (
                etapasCrmData.map(e => (
                  <div
                    key={e.name}
                    onClick={() => filterAndNavigate({ situacao: e.name, ...(empFilterStage ? { empreendimento: empFilterStage } : {}) })}
                    className="flex flex-col gap-1.5 p-3 rounded-xl bg-white/[0.01] border border-white/5 hover:bg-white/5 cursor-pointer transition-all"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-zinc-200 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.colorObj.bg }} />
                        {e.name}
                      </span>
                      <span className="text-zinc-400">
                        <strong className="text-white font-bold">{e.count}</strong> lead{e.count !== 1 ? 's' : ''} <span className="text-zinc-600">({e.percentage}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${e.percentage}%`, backgroundColor: e.colorObj.bg }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </GlassCard>

        {/* Coluna Direita: Donut Chart + Lista de Canais Orgânicos */}
        <div className="flex flex-col gap-6">
          
          {/* 📊 Novo Gráfico: Mix de Captação */}
          <GlassCard title="Mix de Captação (Mídia Paga vs Orgânico)">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2 min-h-[140px] relative">
              <div className="w-[120px] h-[120px] flex-shrink-0 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mixData}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={54}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {mixData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '11px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Texto Centralizado */}
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-white leading-none">{formatNumber(filteredLeads.length)}</span>
                  <span className="text-[8px] text-zinc-500 font-semibold uppercase mt-0.5">Leads</span>
                </div>
              </div>

              {/* Legenda Detalhada */}
              <div className="flex flex-col gap-2 text-xs">
                {mixData.map(d => {
                  const pct = filteredLeads.length > 0 ? ((d.value / filteredLeads.length) * 100).toFixed(1) : '0.0';
                  return (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <div className="flex flex-col">
                        <span className="text-zinc-200 font-semibold leading-tight">{d.name}</span>
                        <span className="text-[10px] text-zinc-500">{formatNumber(d.value)} leads ({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </GlassCard>

          {/* ── Seção C: Outros Canais de Captação (Orgânicos / Manuais) ── */}
          <GlassCard title={`Captação Orgânica & Outros Canais (${outrosLeads.length} leads)`}>
            <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-1">
              {outrosCanaisData.length === 0 ? (
                <p className="text-zinc-500 text-center text-xs py-8">Nenhum lead captado fora do tráfego pago no período.</p>
              ) : (
                outrosCanaisData.map((c, i) => (
                  <div
                    key={c.name}
                    onClick={() => filterAndNavigate({ origem: c.name })}
                    className="flex flex-col gap-1.5 p-3 rounded-xl bg-white/[0.01] border border-white/5 hover:bg-white/5 cursor-pointer transition-all"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-zinc-200 flex items-center gap-2">
                        <Compass size={14} className="text-zinc-500 shrink-0" />
                        {c.name}
                      </span>
                      <span className="text-zinc-400">
                        <strong className="text-white font-bold">{c.count}</strong> lead{c.count !== 1 ? 's' : ''} ({c.percentage}%)
                      </span>
                    </div>
                    {/* Barra de Progresso com Paleta */}
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ width: `${c.percentage}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassCard>

        </div>

      </div>

      {/* ── Alertas Inteligentes (AI) ── */}
      {insights.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-zinc-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Insights Analíticos & Recomendações
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {insights.slice(0, 4).map((insight, i) => (
              <AlertCard key={i} insight={insight} />
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-zinc-700 text-center mt-4">
        Smart Dashboard · Mapeamento integrado em tempo real · Clique em qualquer bloco para filtrar leads
      </p>
    </div>
  )
}
