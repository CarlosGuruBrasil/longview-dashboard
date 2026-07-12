'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Info,
  Lightbulb, Users, DollarSign, Target, Clock, ShoppingCart,
  BarChart3, Activity, Globe, ArrowRight, ArrowDown, Layers, HelpCircle,
  Megaphone, Compass, Eye, MousePointerClick, ChevronDown
} from 'lucide-react'
import { useData } from '../../context/DataContext'
import FilterBar from '../ui/FilterBar'
import FunnelVisualization from '../ui/FunnelVisualization'
import { generateInsights, type Insight } from '../../utils/insights'
import { isSale, getLeadValueNumber, getStatusColor, getOrigin, toISODate } from '../../utils/leads'
import { funnelCounts } from '../../utils/funnel'
import LogoLoader from '@/components/ui/LogoLoader'
import { formatCurrency, formatNumber } from '../../utils/formatters'
import GlassCard from '../ui/GlassCard'
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
  const { allLeads, crmTotal, loading, metaData, metaValidation, setActiveView, setLeadFilters } = useData()

  // Smart Dashboard usa sempre mês atual (não depende do filtro global)
  const currentMonthLeads = useMemo(() => {
    const ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    return allLeads.filter(l => {
      const dtStr = String(l.data_cad ?? l.data_cadastro ?? l.data_cadastramento ?? '')
      const iso = dtStr.includes('/') ? toISODate(dtStr) : dtStr
      return iso.slice(0, 7) === ym
    })
  }, [allLeads])
  const [biData, setBiData] = useState<BiInsights | null>(null)
  const [, setBiLoading] = useState(true)
  
  // Filtros locais e independentes do Funil de Leads
  const [funnelStart, setFunnelStart] = useState('')
  const [funnelEnd, setFunnelEnd] = useState('')
  const [funnelCorretor, setFunnelCorretor] = useState('')
  const [funnelImobiliaria, setFunnelImobiliaria] = useState('')
  const [funnelGestor, setFunnelGestor] = useState('')
  const [funnelEmpreendimento, setFunnelEmpreendimento] = useState('')

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
    return currentMonthLeads.filter(l => {
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
  }, [currentMonthLeads]);

  // Identifica leads de outros canais
  const outrosLeads = useMemo(() => {
    return currentMonthLeads.filter(l => !metaLeads.some(ml => ml.id === l.id));
  }, [currentMonthLeads, metaLeads]);

  // Gasto total (Meta) no mês atual (cruza com os leads do mês atual)
  const totalSpend = useMemo(() => {
    const ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const daily = metaData?.daily || [];
    return daily.reduce((sum, d) => {
      const dateStr = String(d.date_start || '');
      if (dateStr.startsWith(ym)) return sum + Number(d.spend ?? 0);
      return sum;
    }, 0);
  }, [metaData]);

  // CPL médio do Meta Ads no mês atual
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
        const status = details?.effective_status || details?.status || 'UNKNOWN';

        const metaActions = c.actions ?? [];
        const leadAction = (metaActions as any[]).find(a => a.action_type === 'lead');
        const metaLeadsCount = leadAction ? parseInt(leadAction.value, 10) : 0;

        return {
          id: c.campaign_id,
          name: cName,
          status,
          empreendimento: matchedEmpName,
          spend: spendVal,
          impressions: impressionsVal,
          clicks: clicksVal,
          leadsCount: metaLeadsCount,
          crmLeadsCount: campLeads.length,
          cpl: metaLeadsCount > 0 ? spendVal / metaLeadsCount : spendVal,
          ctr: impressionsVal > 0 ? (clicksVal / impressionsVal) * 100 : 0
        };
      })
      // Apenas campanhas ATIVAS no Meta (não exibe históricas pausadas)
      .filter(c => c.status === 'ACTIVE')
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

  // 3. Classificação e Filtros do Funil de Leads (Independentes de Data Global)
  const funnelOptions = useMemo(() => {
    const corretores = new Set<string>()
    const imobiliarias = new Set<string>()
    const gestores = new Set<string>()
    const empreendimentos = new Set<string>()

    allLeads.forEach(l => {
      const c = l.corretor
      const cName = typeof c === 'object' && c ? c.nome : (typeof c === 'string' ? c : '')
      if (cName) corretores.add(cName)

      const imob = l.imobiliaria
      const iName = typeof imob === 'object' && imob ? imob.nome : (typeof imob === 'string' ? imob : '')
      if (iName) imobiliarias.add(iName)

      const g = l.gestor
      const gName = typeof g === 'object' && g ? g.nome : (typeof g === 'string' ? g : '')
      if (gName) gestores.add(gName)

      const emp = l.empreendimento
      const empList = Array.isArray(emp) ? emp.map(e => e.nome) : []
      empList.forEach(e => { if (typeof e === 'string' && e) empreendimentos.add(e) })
    })

    return {
      corretores: Array.from(corretores).sort(),
      imobiliarias: Array.from(imobiliarias).sort(),
      gestores: Array.from(gestores).sort(),
      empreendimentos: Array.from(empreendimentos).sort(),
    }
  }, [allLeads])

  const stageLeads = useMemo(() => {
    let result = allLeads

    // Filtro de data local
    if (funnelStart || funnelEnd) {
      result = result.filter(l => {
        const raw = l.data_cad || l.data_cadastro || l.data_cadastramento
        if (!raw) return false
        const d = String(raw).trim().split(' ')[0].split('T')[0]
        if (funnelStart && d < funnelStart) return false
        if (funnelEnd && d > funnelEnd) return false
        return true
      })
    }

    // Filtros locais adicionais
    if (funnelCorretor) {
      result = result.filter(l => {
        const c = l.corretor
        const name = typeof c === 'object' && c ? c.nome : (typeof c === 'string' ? c : '')
        return name === funnelCorretor
      })
    }
    if (funnelImobiliaria) {
      result = result.filter(l => {
        const imob = l.imobiliaria
        const name = typeof imob === 'object' && imob ? imob.nome : (typeof imob === 'string' ? imob : '')
        return name === funnelImobiliaria
      })
    }
    if (funnelGestor) {
      result = result.filter(l => {
        const g = l.gestor
        const name = typeof g === 'object' && g ? g.nome : (typeof g === 'string' ? g : '')
        return name === funnelGestor
      })
    }
    if (funnelEmpreendimento) {
      result = result.filter(l => {
        const emp = l.empreendimento
        const empList = Array.isArray(emp) ? emp.map(e => e.nome) : []
        return empList.includes(funnelEmpreendimento)
      })
    }

    return result
  }, [allLeads, funnelStart, funnelEnd, funnelCorretor, funnelImobiliaria, funnelGestor, funnelEmpreendimento])

  const funnelConsolidated = useMemo(() => {
    // Etapas e contagens vêm de utils/funnel.ts — mesma fonte do FunnelVisualization
    const c = funnelCounts(stageLeads)
    const { ativos: cNovos, atendimento: cAtend, visita: cVisita, reserva: cReserva, venda: cVenda } = c

    const pct  = (n: number) => cNovos > 0 ? Math.round((n / cNovos) * 100) : 0
    const conv = (n: number, d: number) => d > 0 ? Math.round((n / d) * 100) : 0

    const getStatus = (val: number, meta: number) => {
      if (val >= meta)         return { label: 'Excelente (Meta batida)', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' }
      if (val >= meta * 0.7)  return { label: 'Bom', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' }
      if (val >= meta * 0.45) return { label: 'Regular', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' }
      return                         { label: 'Abaixo da meta', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' }
    }

    return [
      { name: '1. Captação (Ativos)',       count: cNovos,   pctOfTotal: 100,          convRate: 100,                   diag: { label: 'Início', color: 'text-zinc-400', bg: 'bg-zinc-800/40 border-zinc-700' } },
      { name: '2. Em Atendimento',          count: cAtend,   pctOfTotal: pct(cAtend),  convRate: conv(cAtend, cNovos),  diag: getStatus(conv(cAtend, cNovos), 75) },
      { name: '3. Visita Realizada',        count: cVisita,  pctOfTotal: pct(cVisita), convRate: conv(cVisita, cAtend), diag: getStatus(conv(cVisita, cAtend), 30) },
      { name: '4. Com Reserva',             count: cReserva, pctOfTotal: pct(cReserva),convRate: conv(cReserva, cVisita),diag: getStatus(conv(cReserva, cVisita), 25) },
      { name: '5. Venda (Leads Convertidos)', count: cVenda,   pctOfTotal: pct(cVenda),  convRate: conv(cVenda, cReserva),diag: getStatus(conv(cVenda, cReserva), 70) },
    ]
  }, [stageLeads])

  // Crescimento de leads (mês atual vs mês anterior, baseado nos leads filtrados do funil)
  const crescimento = useMemo(() => {
    const now = new Date()
    const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const currMonth = ym(now)
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonth = ym(prevDate)

    let curr = 0, prev = 0
    for (const l of stageLeads) {
      const d = l.data_cad ?? l.data_cadastro ?? l.data_cadastramento ?? ''
      if (!d) continue
      const m = String(d).slice(0, 7)
      if (m === currMonth) curr++
      else if (m === prevMonth) prev++
    }
    const pct = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null
    return { curr, prev, pct }
  }, [stageLeads])

  // Origens dos Leads (mês atual)
  const origensData = useMemo(() => {
    const map = new Map<string, number>()
    for (const lead of currentMonthLeads) {
      const origem = getOrigin(lead)
      map.set(origem, (map.get(origem) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.name !== 'Não informado' || d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [currentMonthLeads]);

  const insights = useMemo(() => generateInsights(biData, allLeads, metaData), [biData, allLeads, metaData])

  if (loading && allLeads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12" style={{ minHeight: '60vh' }}>
        <LogoLoader module="marketing" text="Sincronizando dados e cruzando campanhas..." />
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
          icon={Users} label="Leads no Mês Atual" value={formatNumber(currentMonthLeads.length)}
          sub="Todos os canais — mês corrente" color="#0ea5e9"
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

      {/* ── Seção B: Funil de Vendas e Etapas do CRM ── */}
      <GlassCard title="Etapas do Funil de Leads">
        <div className="flex flex-col gap-4">

          {/* ── FILTROS INDEPENDENTES DO FUNIL ── */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Filtros Locais do Funil</span>
              <button
                onClick={() => {
                  setFunnelStart('')
                  setFunnelEnd('')
                  setFunnelCorretor('')
                  setFunnelImobiliaria('')
                  setFunnelGestor('')
                  setFunnelEmpreendimento('')
                }}
                className="text-[10px] text-zinc-500 hover:text-orange-400 font-medium transition-colors"
              >
                Limpar Filtros
              </button>
            </div>

            {/* Grid de seletores */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {/* Data Início */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-zinc-500">De</span>
                <input
                  type="date"
                  value={funnelStart}
                  onChange={e => setFunnelStart(e.target.value)}
                  className="h-7 px-2 text-[11px] bg-white/[0.04] border border-white/[0.09] rounded-lg text-zinc-300 focus:outline-none focus:border-orange-500/40 w-full"
                />
              </div>

              {/* Data Fim */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-zinc-500">Até</span>
                <input
                  type="date"
                  value={funnelEnd}
                  onChange={e => setFunnelEnd(e.target.value)}
                  className="h-7 px-2 text-[11px] bg-white/[0.04] border border-white/[0.09] rounded-lg text-zinc-300 focus:outline-none focus:border-orange-500/40 w-full"
                />
              </div>

              {/* Empreendimento */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-zinc-500">Empreendimento</span>
                <select
                  value={funnelEmpreendimento}
                  onChange={e => setFunnelEmpreendimento(e.target.value)}
                  className="h-7 px-2 text-[11px] bg-[#121214] border border-white/[0.09] rounded-lg text-zinc-300 focus:outline-none focus:border-orange-500/40 w-full cursor-pointer"
                >
                  <option value="">Todos</option>
                  {funnelOptions.empreendimentos.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              {/* Corretor */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-zinc-500">Corretor</span>
                <select
                  value={funnelCorretor}
                  onChange={e => setFunnelCorretor(e.target.value)}
                  className="h-7 px-2 text-[11px] bg-[#121214] border border-white/[0.09] rounded-lg text-zinc-300 focus:outline-none focus:border-orange-500/40 w-full cursor-pointer"
                >
                  <option value="">Todos</option>
                  {funnelOptions.corretores.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Imobiliária */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-zinc-500">Imobiliária</span>
                <select
                  value={funnelImobiliaria}
                  onChange={e => setFunnelImobiliaria(e.target.value)}
                  className="h-7 px-2 text-[11px] bg-[#121214] border border-white/[0.09] rounded-lg text-zinc-300 focus:outline-none focus:border-orange-500/40 w-full cursor-pointer"
                >
                  <option value="">Todos</option>
                  {funnelOptions.imobiliarias.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              {/* Gestor */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-zinc-500">Gestor</span>
                <select
                  value={funnelGestor}
                  onChange={e => setFunnelGestor(e.target.value)}
                  className="h-7 px-2 text-[11px] bg-[#121214] border border-white/[0.09] rounded-lg text-zinc-300 focus:outline-none focus:border-orange-500/40 w-full cursor-pointer"
                >
                  <option value="">Todos</option>
                  {funnelOptions.gestores.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── INDICADORES GERAIS DO FUNIL FILTRADO ── */}
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-white/5 pb-3">
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Crescimento mês atual (funil filtrado)</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xl font-bold text-white">{stageLeads.length}</span>
                {crescimento.pct !== null && (
                  <span className={`flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    crescimento.pct >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                  }`}>
                    {crescimento.pct >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {crescimento.pct >= 0 ? '+' : ''}{crescimento.pct}%
                  </span>
                )}
                <span className="text-[10px] text-zinc-600">vs {crescimento.prev} no mês anterior</span>
              </div>
            </div>
          </div>

          {/* ── FUNIL VISUAL (USANDO COMPONENTE PADRÃO) ── */}
            <FunnelVisualization leads={stageLeads} />
          </div>
        </GlassCard>

      {/* ── Seção C: Origem dos Leads (Círculos) ── */}
      <GlassCard title="Origem dos Leads (Top 10 do Mês)">
        <div className="flex flex-wrap items-center justify-center gap-4 py-8 px-4">
          {origensData.length === 0 ? (
            <p className="text-zinc-500 text-center text-xs py-8">Nenhum lead encontrado no mês atual.</p>
          ) : (
            origensData.map((origem, i) => {
              const color = PALETTE[i % PALETTE.length]
              return (
                <div
                  key={origem.name}
                  onClick={() => filterAndNavigate({ origem: origem.name })}
                  className="flex items-center gap-3 px-5 py-2.5 rounded-full border-2 bg-white/[0.02] hover:bg-white/[0.06] hover:scale-105 cursor-pointer transition-all duration-300 shadow-sm"
                  style={{ borderColor: color }}
                >
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider whitespace-nowrap">
                    {origem.name}
                  </span>
                  <div 
                    className="flex items-center justify-center px-2.5 py-0.5 rounded-full"
                    style={{ backgroundColor: `${color}20` }}
                  >
                    <span className="text-base font-black" style={{ color }}>{formatNumber(origem.value)}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </GlassCard>

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
