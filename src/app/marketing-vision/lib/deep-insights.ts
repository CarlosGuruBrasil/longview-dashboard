import type { AIInsight } from '../types'

// Converte a resposta do /api/bi/intelligence (GET) em cards de insight.
// A "Análise Profunda" usa a atribuição real gasto × leads × receita do BI —
// não há LLM envolvido; o rótulo na UI deve dizer isso honestamente.
type IntelligencePayload = {
  investmentRecommendations?: {
    campanhasParaEscalar?: string[]
    campanhasParaPausar?: string[]
    canaisMaisEficientes?: string[]
    oportunidadesIdentificadas?: string[]
  }
  updatedAt?: string
}

export function insightsFromIntelligence(data: IntelligencePayload): AIInsight[] {
  const rec = data.investmentRecommendations
  if (!rec) return []
  const now = data.updatedAt ?? new Date().toISOString()
  const out: AIInsight[] = []

  rec.campanhasParaPausar?.forEach((nome, i) => out.push({
    id: `deep-pausar-${i}`,
    type: 'critical',
    title: `Pausar: "${nome}"`,
    description: 'A análise de atribuição (gasto × leads × receita) indica desempenho abaixo do aceitável para esta campanha.',
    action: 'pause_campaign',
    actionLabel: 'Ir para Gestão de Ads',
    generatedAt: now,
    source: 'rule',
  }))

  rec.campanhasParaEscalar?.forEach((nome, i) => out.push({
    id: `deep-escalar-${i}`,
    type: 'opportunity',
    title: `Escalar: "${nome}"`,
    description: 'Campanha com atribuição de receita e CPL eficientes — candidata a aumento de orçamento.',
    action: 'increase_budget',
    actionLabel: 'Ir para Gestão de Ads',
    generatedAt: now,
    source: 'rule',
  }))

  if (rec.canaisMaisEficientes?.length) {
    out.push({
      id: 'deep-canais',
      type: 'success',
      title: `Canais mais eficientes: ${rec.canaisMaisEficientes.join(', ')}`,
      description: 'Canais com melhor relação investimento × conversão no período analisado.',
      generatedAt: now,
      source: 'rule',
    })
  }

  rec.oportunidadesIdentificadas?.forEach((texto, i) => out.push({
    id: `deep-oportunidade-${i}`,
    type: 'info',
    title: texto,
    description: 'Oportunidade identificada pela análise profunda de atribuição de marketing.',
    generatedAt: now,
    source: 'rule',
  }))

  return out
}
