import type { BiInsights } from '../types';
import type { MetaData, Lead } from '../types';

export interface Insight {
  type: 'critical' | 'warning' | 'positive' | 'info'
  title: string
  description: string
  action: string
  metric: string
  priority: number
}

const META_CONV_RATE = 3
const META_ROAS = 2
const META_CPL = 80

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

function lastTwoMonths(series: BiInsights['monthlySeries']): { current: number; previous: number } {
  const withLeads = series.filter(s => s.leads > 0)
  if (withLeads.length < 2) return { current: 0, previous: 0 }
  const cur = withLeads[withLeads.length - 1]
  const prev = withLeads[withLeads.length - 2]
  return {
    current: cur.leads,
    previous: prev.leads,
  }
}

function lastTwoMonthsVGV(series: BiInsights['monthlySeries']): { current: number; previous: number } {
  const withVGV = series.filter(s => s.vgv > 0)
  if (withVGV.length < 2) return { current: 0, previous: 0 }
  const cur = withVGV[withVGV.length - 1]
  const prev = withVGV[withVGV.length - 2]
  return { current: cur.vgv, previous: prev.vgv }
}

export function generateInsights(
  bi: BiInsights | null,
  allLeads: Lead[],
  metaData: MetaData | null,
): Insight[] {
  const insights: Insight[] = []

  if (!bi || bi.summary.totalLeads === 0) {
    insights.push({
      type: 'info',
      title: 'Bem-vindo ao Smart Dashboard',
      description: 'Carregue dados do CRM para gerar insights inteligentes.',
      action: 'Verifique se o ETL BI foi executado e se há leads no sistema.',
      metric: 'status',
      priority: 0,
    })
    return insights
  }

  const { summary, monthlySeries, perDevelopment, funnel } = bi

  // ── 1. Lead volume trend ──────────────────────────────────────
  const lm = lastTwoMonths(monthlySeries)
  if (lm.previous > 0) {
    const change = pctChange(lm.current, lm.previous)
    if (change < -15) {
      insights.push({
        type: 'critical',
        title: `Queda de ${Math.abs(change)}% na geração de leads`,
        description: `Mês atual: ${lm.current} leads vs ${lm.previous} no mês anterior.`,
        action: 'Revise campanhas Meta com maior redução de entrega. Verifique segmentação e budget. Considere aumentar investimento nas campanhas com melhor CPL.',
        metric: 'leads',
        priority: 100,
      })
    } else if (change > 15) {
      insights.push({
        type: 'positive',
        title: `Crescimento de ${change}% na geração de leads`,
        description: `Mês atual: ${lm.current} leads vs ${lm.previous} no mês anterior.`,
        action: 'Identifique quais campanhas estão performando melhor e considere realocar budget para maximizar resultados.',
        metric: 'leads',
        priority: 70,
      })
    }
  }

  // ── 2. Conversion rate ───────────────────────────────────────
  const convRate = summary.totalLeads > 0
    ? Math.round((summary.totalSales / summary.totalLeads) * 100)
    : 0
  if (convRate > 0 && convRate < META_CONV_RATE) {
    insights.push({
      type: 'warning',
      title: `Taxa de conversão baixa: ${convRate}% (meta ${META_CONV_RATE}%)`,
      description: `${summary.totalSales} vendas de ${summary.totalLeads} leads.`,
      action: 'Priorize leads quentes (score > 80) para atendimento imediato. Analise etapa do funil com maior gargalo. Considere treinamento de corretores em técnicas de fechamento.',
      metric: 'conversão',
      priority: 90,
    })
  } else if (convRate >= META_CONV_RATE) {
    insights.push({
      type: 'positive',
      title: `Taxa de conversão saudável: ${convRate}%`,
      description: `Meta: ${META_CONV_RATE}%. ${summary.totalSales} vendas no período.`,
      action: 'Mantenha a estratégia de qualificação. Busque aumentar volume mantendo a qualidade.',
      metric: 'conversão',
      priority: 40,
    })
  }

  // ── 3. VGV trend ────────────────────────────────────────────
  const vgv = lastTwoMonthsVGV(monthlySeries)
  if (vgv.previous > 0) {
    const change = pctChange(vgv.current, vgv.previous)
    if (change < -10) {
      insights.push({
        type: 'warning',
        title: `VGV caiu ${Math.abs(change)}% em relação ao mês anterior`,
        description: `Atual: ${formatRaw(vgv.current)} vs ${formatRaw(vgv.previous)}.`,
        action: 'Analise estoque de unidades vendíveis. Verifique se há unidades de alto valor disponíveis. Considere campanhas focadas em empreendimentos premium.',
        metric: 'vgv',
        priority: 80,
      })
    } else if (change > 15) {
      insights.push({
        type: 'positive',
        title: `VGV cresceu ${change}% em relação ao mês anterior`,
        description: `Atual: ${formatRaw(vgv.current)} vs ${formatRaw(vgv.previous)}. Ticket médio em alta.`,
        action: 'Identifique quais empreendimentos impulsionaram o crescimento e replique a estratégia.',
        metric: 'vgv',
        priority: 60,
      })
    }
  }

  // ── 4. Ticket médio ─────────────────────────────────────────
  if (summary.avgTicket > 0) {
    const ticketAntes = monthlySeries.length >= 2
      ? monthlySeries
          .filter(m => m.sales > 0)
          .slice(-2)
          .reduce((acc, m) => m.vgv / m.sales, 0)
      : 0
    if (ticketAntes > 0) {
      const ticketChange = pctChange(summary.avgTicket, ticketAntes)
      if (ticketChange > 5) {
        insights.push({
          type: 'positive',
          title: `Ticket médio subiu ${ticketChange}%`,
          description: `Atual: ${formatRaw(summary.avgTicket)}.`,
          action: 'Clientes estão comprando unidades de maior valor. Mantenha segmentação de qualidade.',
          metric: 'ticket',
          priority: 50,
        })
      } else if (ticketChange < -5) {
        insights.push({
          type: 'warning',
          title: `Ticket médio caiu ${Math.abs(ticketChange)}%`,
          description: `Atual: ${formatRaw(summary.avgTicket)}.`,
          action: 'Analise se há aumento de vendas de unidades menores. Considere campanhas para empreendimentos de alto padrão.',
          metric: 'ticket',
          priority: 60,
        })
      }
    }
  }

  // ── 5. Conversion time ──────────────────────────────────────
  if (summary.avgConversionDays > 0) {
    if (summary.avgConversionDays > 60) {
      insights.push({
        type: 'warning',
        title: `Ciclo de venda longo: ${summary.avgConversionDays} dias`,
        description: 'Leads estão demorando para converter.',
        action: 'Implemente follow-up automatizado nos primeiros 7 dias. Leads sem contato em 48h devem ser reativados. Crie campanhas de nutrição para leads frios.',
        metric: 'cycle',
        priority: 70,
      })
    } else if (summary.avgConversionDays < 15) {
      insights.push({
        type: 'positive',
        title: `Ciclo de venda rápido: ${summary.avgConversionDays} dias`,
        description: 'Leads estão convertendo rapidamente.',
        action: 'Processo de vendas eficiente. Considere aumentar volume de leads para maximizar receita.',
        metric: 'cycle',
        priority: 40,
      })
    }
  }

  // ── 6. ROAS analysis ────────────────────────────────────────
  if (summary.roas > 0) {
    if (summary.roas < META_ROAS) {
      insights.push({
        type: 'warning',
        title: `ROAS abaixo da meta: ${summary.roas.toFixed(1)}x (meta ${META_ROAS}x)`,
        description: summary.cac > 0
          ? `CAC: ${formatRaw(summary.cac)} | CPL: ${formatRaw(summary.cpl)}`
          : '',
        action: 'Revise campanhas com maior gasto e menor retorno. Realoque budget para as de melhor ROAS. Considere pausar campanhas com ROAS < 1.',
        metric: 'roas',
        priority: 85,
      })
    } else if (summary.roas >= META_ROAS * 1.5) {
      insights.push({
        type: 'positive',
        title: `ROAS excelente: ${summary.roas.toFixed(1)}x`,
        description: 'Retorno sobre investimento em mídia muito acima da meta.',
        action: 'Considere aumentar budget nas campanhas atuais para escalar resultados. Teste novos públicos similares.',
        metric: 'roas',
        priority: 60,
      })
    }
  }

  // ── 7. CPL analysis ─────────────────────────────────────────
  if (summary.cpl > 0) {
    if (summary.cpl > META_CPL) {
      insights.push({
        type: 'warning',
        title: `CPL elevado: ${formatRaw(summary.cpl)} (meta ${formatRaw(META_CPL)})`,
        description: 'Custo por lead acima do ideal.',
        action: 'Otimize segmentação nas campanhas. Remova públicos de baixa performance. Teste criativos com maior taxa de conversão.',
        metric: 'cpl',
        priority: 75,
      })
    } else if (summary.cpl < META_CPL * 0.5) {
      insights.push({
        type: 'positive',
        title: `CPL baixo: ${formatRaw(summary.cpl)}`,
        description: 'Custo por lead eficiente.',
        action: 'Aproveite para escalar volume mantendo a segmentação atual.',
        metric: 'cpl',
        priority: 40,
      })
    }
  }

  // ── 8. Social media insights ───────────────────────────────
  if (metaData?.page?.fan_count) {
    const followers = metaData.page.fan_count
    const instagram = metaData.page.instagram_business_account ? 'conectado' : 'não conectado'
    insights.push({
      type: 'info',
      title: `Panorama Redes Sociais`,
      description: `Facebook: ${followers.toLocaleString('pt-BR')} seguidores. Instagram: ${instagram}.`,
      action: instagram === 'não conectado'
        ? 'Conecte a conta do Instagram Business para métricas orgânicas completas.'
        : 'Publique conteúdo orgânico consistente. Use os insights de alcance para planejar posts. Responda comentários em até 1h para aumentar engajamento.',
      metric: 'social',
      priority: 30,
    })
  }

  if (metaData?.global?.spend && metaData?.daily?.length) {
    const dailySpend = metaData.daily
    const recentDays = dailySpend.slice(-7)
    const avgDailySpend = recentDays.reduce((s, d) => s + (parseFloat(d.spend ?? '0')), 0) / recentDays.length
    if (avgDailySpend > 0) {
      const monthlyBurn = avgDailySpend * 30
      insights.push({
        type: 'info',
        title: `Burn rate de mídia: ${formatRaw(monthlyBurn)}/mês`,
        description: `Média diária: ${formatRaw(avgDailySpend)} nos últimos 7 dias.`,
        action: monthlyBurn > summary.totalSpend * 1.1
          ? 'Gasto acelerou vs períodos anteriores. Verifique se o ROAS acompanhou o aumento.'
          : 'Gasto estável. Acompanhe ROAS semanalmente para evitar desperdício.',
        metric: 'spend',
        priority: 35,
      })
    }
  }

  // ── 9. Development performance ─────────────────────────────
  if (perDevelopment.length > 0) {
    const top = perDevelopment
      .filter(d => d.conversionPct > 0)
      .sort((a, b) => b.conversionPct - a.conversionPct)
      .slice(0, 1)[0]
    const bottom = perDevelopment
      .filter(d => d.leads > 5 && d.conversionPct > 0)
      .sort((a, b) => a.conversionPct - b.conversionPct)
      .slice(0, 1)[0]

    if (top) {
      insights.push({
        type: 'positive',
        title: `Destaque: ${top.nome}`,
        description: `Melhor taxa de conversão (${top.conversionPct}%) com ${top.sales} vendas e VGV de ${formatRaw(top.vgv)}.`,
        action: 'Analise o que está funcionando neste empreendimento e aplique nos demais: perfil de cliente, abordagem de vendas, canais de aquisição.',
        metric: 'performance',
        priority: 55,
      })
    }
    if (bottom) {
      insights.push({
        type: 'warning',
        title: `Atenção: ${bottom.nome}`,
        description: `Menor taxa de conversão (${bottom.conversionPct}%) com ${bottom.leads} leads.`,
        action: 'Revise o processo de vendas deste empreendimento. Verifique se os leads estão sendo acompanhados. Considere treinamento da equipe ou ajuste de precificação.',
        metric: 'performance',
        priority: 65,
      })
    }
  }

  // ── 10. Funnel bottlenecks ─────────────────────────────────
  if (funnel.length > 2) {
    const stages = funnel
    const lostStages = stages.filter(s =>
      s.name.toLowerCase().includes('perdid') ||
      s.name.toLowerCase().includes('cancel') ||
      s.name.toLowerCase().includes('desist')
    )
    const lostTotal = lostStages.reduce((s, st) => s + st.value, 0)
    const funnelTop = stages[0]?.value ?? 1
    const lossRate = Math.round((lostTotal / funnelTop) * 100)
    if (lossRate > 20) {
      insights.push({
        type: 'warning',
        title: `Perda de ${lossRate}% dos leads no funil`,
        description: `${lostTotal} leads perdidos/cancelados.`,
        action: 'Analise motivos de cancelamento. Se for por crédito, fortaleça parceria com bancos. Se for por desistência, melhore o follow-up pós-visita.',
        metric: 'funnel',
        priority: 65,
      })
    }
  }

  // ── 11. Lead distribution alert ─────────────────────────────
  if (funnel.length > 0) {
    const sitting = funnel.filter(s => {
      const n = s.name.toLowerCase()
      return !n.includes('perdid') && !n.includes('cancel') && !n.includes('desist') &&
        !n.includes('venda') && !n.includes('negócio') && !n.includes('negocio') &&
        !n.includes('vendid')
    })
    const activeTotal = sitting.reduce((s, st) => s + st.value, 0)
    if (activeTotal > 0 && bi.summary.totalSales > 0) {
      const pipelineValue = activeTotal * summary.avgTicket
      if (pipelineValue > summary.totalVGV * 2) {
        insights.push({
          type: 'info',
          title: `Pipeline de ${formatRaw(pipelineValue)} em leads ativos`,
          description: `${activeTotal} leads em estágio de negociação. Valor potencial 2x maior que VGV realizado.`,
          action: 'Foco em acelerar conversões. Priorize leads em estágio de proposta e simulação.',
          metric: 'pipeline',
          priority: 45,
        })
      }
    }
  }

  // ── Sort by priority ───────────────────────────────────────
  return insights.sort((a, b) => b.priority - a.priority)
}

function formatRaw(v: number): string {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `R$${Math.round(v / 1_000)}k`
  if (v < 10) return v.toFixed(1)
  return v.toLocaleString('pt-BR')
}
