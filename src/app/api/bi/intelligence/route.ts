/**
 * GET /api/bi/intelligence
 *
 * Marketing Intelligence Engine
 * Cruza dados reais de: Meta Ads (cache) × CRM (leads) × CVDW (vendas)
 * Produz atribuição de campanhas, ROAS real, inteligência por empreendimento,
 * análise de redes sociais, e recomendações de investimento.
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { sql, ensureSchema } from '@/lib/pg';
import type { MetaData, Lead, CvdwVenda } from '@/app/marketing-vision/types';
import { getOrigin } from '@/app/marketing-vision/utils/leads';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-longview-key';
export const runtime = 'nodejs';
export const revalidate = 0;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function verifyAuth(): Promise<Record<string, unknown> | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
  } catch { return null; }
}

// ── Tipos de retorno ──────────────────────────────────────────────────────────

interface CampaignAttribution {
  campaignId: string
  campaignName: string
  status: string
  spend: number
  impressions: number
  clicks: number
  leadsFromAds: number
  leadsInCrm: number
  salesInCrm: number
  revenue: number
  cpl: number
  roas: number
}

interface DevelopmentIntelligence {
  nome: string
  leads: number
  visits: number
  sales: number
  vgv: number
  avgTicket: number
  conversionPct: number
  topCampaigns: string[]
  avgDaysToSale: number | null
}

interface SocialMediaPost {
  id: string
  platform: 'facebook' | 'instagram'
  mediaType?: string
  caption?: string
  message?: string
  permalink?: string
  mediaUrl?: string
  thumbnailUrl?: string
  createdAt: string
  likes: number
  comments: number
  engagementRate: number
}

interface AudienceInsight {
  gender: string
  age: string
  impressions: number
  spend: number
  reach: number
  percentage: number
}

interface ChannelPerformance {
  channel: string
  spend: number
  impressions: number
  clicks: number
  leads: number
  sales: number
  revenue: number
  roas: number
  cpl: number
}

interface MarketingIntelligence {
  summary: {
    totalSpend: number
    totalLeads: number
    totalSales: number
    totalRevenue: number
    overallRoas: number
    overallCpl: number
    activeCampaigns: number
    totalCampaigns: number
  }
  campaignAttribution: CampaignAttribution[]
  developmentIntelligence: DevelopmentIntelligence[]
  channelPerformance: ChannelPerformance[]
  socialMedia: {
    totalPosts: number
    totalEngagement: number
    avgEngagementRate: number
    bestPost: SocialMediaPost | null
    postsByPlatform: { facebook: number; instagram: number }
  }
  audience: AudienceInsight[]
  investmentRecommendations: {
    campanhasParaEscalar: string[]
    campanhasParaPausar: string[]
    canaisMaisEficientes: string[]
    oportunidadesIdentificadas: string[]
  }
  updatedAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcEngagementRate(likes: number, comments: number, _reach?: number): number {
  const estimatedReach = _reach || likes * 10 + comments * 5
  return estimatedReach > 0 ? (likes + comments) / estimatedReach : 0
}

function getLeadValue(lead: Lead): number {
  const raw = lead.valor_venda ?? lead.valor_negocio ?? 0
  if (typeof raw === 'number') return raw
  const cleaned = String(raw).replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

function getEmpreendimentoNome(lead: Lead): string {
  const emp = lead.empreendimento
  if (Array.isArray(emp)) return emp[0]?.nome || ''
  if (emp && typeof emp === 'object') return (emp as { nome?: string }).nome || ''
  return ''
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET() {
  const authUser = await verifyAuth();
  if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    await ensureSchema();

    // 1. Buscar Meta Cache
    const cacheRows = await sql`SELECT data FROM project_state WHERE key = 'meta_cache' LIMIT 1`;
    const metaCache = cacheRows.length > 0
      ? (cacheRows[0] as { data: { data?: Partial<MetaData> } }).data
      : null;
    const metaData: Partial<MetaData> | null = metaCache?.data ?? null;

    // 2. Buscar leads do Postgres
    const leadRows = await sql`SELECT raw FROM leads ORDER BY data_cadastro DESC NULLS LAST`;
    const allLeads: Lead[] = (leadRows as unknown as { raw: unknown }[]).map(r =>
      typeof r.raw === 'object' ? r.raw as Lead : JSON.parse(String(r.raw))
    );

    // 3. Buscar vendas do CVDW
    const vendaRows = await sql`SELECT raw FROM cv_vendas ORDER BY data_venda DESC NULLS LAST`;
    const allVendas: CvdwVenda[] = (vendaRows as unknown as { raw: unknown }[]).map(r =>
      typeof r.raw === 'object' ? r.raw as CvdwVenda : JSON.parse(String(r.raw))
    );

    // 4. Construir mapa de midia por lead
    const midiaToLeads = new Map<string, Lead[]>()
    for (const lead of allLeads) {
      const midia = getOrigin(lead)
      if (midia !== 'Desconhecido') {
        const arr = midiaToLeads.get(midia) ?? []
        arr.push(lead)
        midiaToLeads.set(midia, arr)
      }
    }

    // 5. Construir mapa de midia por venda (CVDW)
    const midiaToVendas = new Map<string, CvdwVenda[]>()
    for (const venda of allVendas) {
      const midia = venda.midia || 'Desconhecido'
      const arr = midiaToVendas.get(midia) ?? []
      arr.push(venda)
      midiaToVendas.set(midia, arr)
    }

    // 6. Campaign attribution: cruzar campanhas Meta com leads e vendas
    const campaigns = metaData?.campaigns ?? []
    const campaignDetails = metaData?.campaignDetails ?? []
    const detailsMap = new Map(campaignDetails.map(d => [d.id, d]))

    const campaignAttribution: CampaignAttribution[] = campaigns.map(c => {
      const detail = detailsMap.get(c.campaign_id)
      const status = detail?.status || 'UNKNOWN'
      const spend = Number(c.spend ?? 0)
      const impressions = Number(c.impressions ?? 0)
      const clicks = Number(c.clicks ?? 0)

      // Leads do próprio ads (action_type = 'lead')
      const adsLeads = Math.round(
        (c.actions ?? []).filter(a => a.action_type === 'lead' || a.action_type === 'onsite_conversion.lead_grouped')
          .reduce((s, a) => s + Number(a.value || 0), 0)
      )

      // Cruzar com CRM pelo nome da campanha / midia
      const campaignName = c.campaign_name.toLowerCase()
      const matchingLeads = allLeads.filter(l => {
        const origin = getOrigin(l).toLowerCase()
        return origin.includes(campaignName) || origin.includes('meta') || origin.includes('facebook') || origin.includes('instagram')
      })
      const matchingSales = matchingLeads.filter(l => {
        const sit = l.situacao
        const nome = (typeof sit === 'object' && sit ? sit.nome : sit) || ''
        return nome.toLowerCase().includes('venda') || nome.toLowerCase().includes('negócio') || nome.toLowerCase().includes('negocio')
      })
      const revenue = matchingSales.reduce((s, l) => s + getLeadValue(l), 0)

      return {
        campaignId: c.campaign_id,
        campaignName: c.campaign_name,
        status,
        spend,
        impressions,
        clicks,
        leadsFromAds: adsLeads,
        leadsInCrm: matchingLeads.length,
        salesInCrm: matchingSales.length,
        revenue,
        cpl: matchingLeads.length > 0 ? spend / matchingLeads.length : 0,
        roas: spend > 0 ? revenue / spend : 0,
      }
    })

    // 7. Channel performance (por midia_principal)
    const midias = new Set<string>()
    for (const lead of allLeads) {
      const origin = getOrigin(lead)
      if (origin !== 'Desconhecido') midias.add(origin)
    }
    for (const venda of allVendas) {
      if (venda.midia) midias.add(venda.midia)
    }

    const channelPerformance: ChannelPerformance[] = Array.from(midias).map(midia => {
      const leads = midiaToLeads.get(midia) ?? []
      const vendas = midiaToVendas.get(midia) ?? []
      const salesCount = leads.filter(l => {
        const sit = l.situacao
        const nome = (typeof sit === 'object' && sit ? sit.nome : sit) || ''
        return nome.toLowerCase().includes('venda') || nome.toLowerCase().includes('negócio') || nome.toLowerCase().includes('negocio')
      }).length
      const revenue = vendas.reduce((s, v) => s + (v.valor_contrato ?? 0), 0)

      // Estimar spend: rateio proporcional ao número de leads se não tiver dados exatos
      const leadShare = allLeads.length > 0 ? leads.length / allLeads.length : 0
      const estimatedSpend = (metaData?.global?.spend ? Number(metaData.global.spend) : 0) * leadShare

      return {
        channel: midia,
        spend: estimatedSpend,
        impressions: 0,
        clicks: 0,
        leads: leads.length,
        sales: salesCount,
        revenue,
        roas: estimatedSpend > 0 ? revenue / estimatedSpend : 0,
        cpl: leads.length > 0 ? estimatedSpend / leads.length : 0,
      }
    }).sort((a, b) => b.revenue - a.revenue)

    // 8. Development intelligence
    const devMap = new Map<string, Lead[]>()
    for (const lead of allLeads) {
      const nome = getEmpreendimentoNome(lead)
      if (nome) {
        const arr = devMap.get(nome) ?? []
        arr.push(lead)
        devMap.set(nome, arr)
      }
    }

    const developmentIntelligence: DevelopmentIntelligence[] = Array.from(devMap.entries()).map(([nome, leads]) => {
      const visits = leads.filter(l => {
        const stage = l.situacao?.nome?.toLowerCase() || ''
        return stage.includes('visita') || stage.includes('simula') || stage.includes('reserva') || stage.includes('proposta')
      }).length
      const sales = leads.filter(l => {
        const sit = l.situacao
        const nomeSit = (typeof sit === 'object' && sit ? sit.nome : sit) || ''
        return nomeSit.toLowerCase().includes('venda') || nomeSit.toLowerCase().includes('negócio') || nomeSit.toLowerCase().includes('negocio')
      })
      const vgv = sales.reduce((s, l) => s + getLeadValue(l), 0)
      const avgTicket = sales.length > 0 ? vgv / sales.length : 0

      // Top campaigns for this development
      const campaignCounts = new Map<string, number>()
      for (const lead of leads) {
        const origin = getOrigin(lead)
        campaignCounts.set(origin, (campaignCounts.get(origin) ?? 0) + 1)
      }
      const topCampaigns = Array.from(campaignCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name)

      // Avg days to sale
      const daysArray = sales.map(l => {
        const cad = l.data_cad || l.data_cadastro || l.data_cadastramento
        const venda = l.data_venda
        if (!cad || !venda) return null
        const d1 = new Date(cad.replace(' ', 'T'))
        const d2 = new Date(venda.replace(' ', 'T'))
        if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null
        return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
      }).filter((d): d is number => d !== null)

      return {
        nome,
        leads: leads.length,
        visits,
        sales: sales.length,
        vgv,
        avgTicket,
        conversionPct: leads.length > 0 ? Math.round((sales.length / leads.length) * 100) : 0,
        topCampaigns,
        avgDaysToSale: daysArray.length > 0 ? Math.round(daysArray.reduce((s, d) => s + d, 0) / daysArray.length) : null,
      }
    }).sort((a, b) => b.vgv - a.vgv)

    // 9. Audience insights (from Meta demographics)
    const demographics = metaData?.demographics ?? []
    const totalDemoImpressions = demographics.reduce((s, d) => s + Number(d.impressions ?? 0), 0)
    const audience: AudienceInsight[] = demographics.map(d => ({
      gender: d.gender === 'male' ? 'Masculino' : d.gender === 'female' ? 'Feminino' : d.gender || 'Outro',
      age: d.age || 'N/A',
      impressions: Number(d.impressions ?? 0),
      spend: Number(d.spend ?? 0),
      reach: Number(d.reach ?? 0),
      percentage: totalDemoImpressions > 0 ? (Number(d.impressions ?? 0) / totalDemoImpressions) * 100 : 0,
    }))

    // 10. Social media — buscar posts
    const socialPosts: SocialMediaPost[] = []
    try {
      const pageToken = process.env.META_TOKEN
      const PAGE_ID = '259079394232614'

      // Facebook posts
      const fbRes = await fetch(
        `https://graph.facebook.com/v21.0/${PAGE_ID}/feed?fields=id,message,story,created_time,full_picture,permalink_url,likes.summary(true),comments.summary(true)&limit=20&access_token=${pageToken}`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (fbRes.ok) {
        const fbData = await fbRes.json()
        const fbPosts: SocialMediaPost[] = (fbData.data ?? []).map((p: Record<string, unknown>) => {
          const likes = (p.likes as { summary?: { total_count?: number } })?.summary?.total_count ?? 0
          const comments = (p.comments as { summary?: { total_count?: number } })?.summary?.total_count ?? 0
          return {
            id: p.id as string,
            platform: 'facebook' as const,
            message: (p.message as string) || (p.story as string) || '',
            permalink: p.permalink_url as string,
            thumbnailUrl: p.full_picture as string,
            createdAt: p.created_time as string,
            likes,
            comments,
            engagementRate: calcEngagementRate(likes, comments),
          }
        })
        socialPosts.push(...fbPosts)
      }

      // Instagram posts
      const igAcctRes = await fetch(
        `https://graph.facebook.com/v21.0/${PAGE_ID}?fields=instagram_business_account&access_token=${pageToken}`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (igAcctRes.ok) {
        const igAcctData = await igAcctRes.json()
        const igId = igAcctData.instagram_business_account?.id
        if (igId) {
          const igRes = await fetch(
            `https://graph.facebook.com/v21.0/${igId}/media?fields=id,media_type,media_url,permalink,thumbnail_url,timestamp,caption,like_count,comments_count&limit=20&access_token=${pageToken}`,
            { signal: AbortSignal.timeout(8000) }
          )
          if (igRes.ok) {
            const igData = await igRes.json()
            const igPosts: SocialMediaPost[] = (igData.data ?? []).map((p: Record<string, unknown>) => {
              const likes = (p.like_count as number) || 0
              const comments = (p.comments_count as number) || 0
              return {
                id: p.id as string,
                platform: 'instagram' as const,
                mediaType: p.media_type as string,
                caption: p.caption as string,
                permalink: p.permalink as string,
                mediaUrl: p.media_url as string,
                thumbnailUrl: p.thumbnail_url as string,
                createdAt: p.timestamp as string,
                likes,
                comments,
                engagementRate: calcEngagementRate(likes, comments),
              }
            })
            socialPosts.push(...igPosts)
          }
        }
      }
    } catch (e) {
      console.warn('[bi/intelligence] Erro ao buscar posts:', errorMessage(e))
    }

    // Sort posts by engagement
    socialPosts.sort((a, b) => b.engagementRate - a.engagementRate)
    const totalEngagement = socialPosts.reduce((s, p) => s + p.likes + p.comments, 0)
    const avgEngagementRate = socialPosts.length > 0
      ? socialPosts.reduce((s, p) => s + p.engagementRate, 0) / socialPosts.length
      : 0

    // 11. Investment recommendations
    const activeCampaigns = campaignAttribution.filter(c => c.status === 'ACTIVE')
    const campanhasParaEscalar = activeCampaigns
      .filter(c => c.roas > 1.5 && c.cpl < 80)
      .sort((a, b) => b.roas - a.roas)
      .slice(0, 5)
      .map(c => c.campaignName)

    const campanhasParaPausar = activeCampaigns
      .filter(c => c.roas < 0.5 && c.spend > 100)
      .sort((a, b) => a.roas - b.roas)
      .slice(0, 5)
      .map(c => c.campaignName)

    const canaisMaisEficientes = channelPerformance
      .filter(c => c.roas > 1 && c.sales > 0)
      .sort((a, b) => b.roas - a.roas)
      .slice(0, 5)
      .map(c => c.channel)

    const oportunidadesIdentificadas: string[] = []
    if (developmentIntelligence.length > 0) {
      const worstDev = developmentIntelligence[developmentIntelligence.length - 1]
      if (worstDev && worstDev.conversionPct < 3) {
        oportunidadesIdentificadas.push(`Baixa conversão em "${worstDev.nome}": apenas ${worstDev.conversionPct}% — revisar abordagem comercial`)
      }
      const bestDev = developmentIntelligence[0]
      if (bestDev && bestDev.avgDaysToSale && bestDev.avgDaysToSale < 30) {
        oportunidadesIdentificadas.push(`"${bestDev.nome}" tem o ciclo de venda mais rápido (${bestDev.avgDaysToSale}d) — usar como referência`)
      }
    }
    const zeroSalesCampaigns = campaignAttribution.filter(c => c.spend > 500 && c.salesInCrm === 0)
    if (zeroSalesCampaigns.length > 0) {
      oportunidadesIdentificadas.push(`${zeroSalesCampaigns.length} campanha(s) com gasto > R$500 e zero vendas — revisar segmentação e formulário`)
    }
    const lowAttendanceChannels = channelPerformance.filter(c => c.leads > 20 && c.sales === 0)
    if (lowAttendanceChannels.length > 0) {
      oportunidadesIdentificadas.push(`${lowAttendanceChannels.length} canal(is) geram leads mas zero vendas — avaliar qualidade do lead e atendimento`)
    }

    const totalSpend = campaignAttribution.reduce((s, c) => s + c.spend, 0)
    const totalLeads = campaignAttribution.reduce((s, c) => s + c.leadsInCrm, 0)
    const totalSales = campaignAttribution.reduce((s, c) => s + c.salesInCrm, 0)
    const totalRevenue = campaignAttribution.reduce((s, c) => s + c.revenue, 0)

    const response: MarketingIntelligence = {
      summary: {
        totalSpend,
        totalLeads,
        totalSales,
        totalRevenue,
        overallRoas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
        overallCpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
        activeCampaigns: campaignAttribution.filter(c => c.status === 'ACTIVE').length,
        totalCampaigns: campaignAttribution.length,
      },
      campaignAttribution,
      developmentIntelligence,
      channelPerformance,
      socialMedia: {
        totalPosts: socialPosts.length,
        totalEngagement,
        avgEngagementRate,
        bestPost: socialPosts[0] ?? null,
        postsByPlatform: {
          facebook: socialPosts.filter(p => p.platform === 'facebook').length,
          instagram: socialPosts.filter(p => p.platform === 'instagram').length,
        },
      },
      audience,
      investmentRecommendations: {
        campanhasParaEscalar,
        campanhasParaPausar,
        canaisMaisEficientes,
        oportunidadesIdentificadas,
      },
      updatedAt: new Date().toISOString(),
    }

    return NextResponse.json(response)

  } catch (err: unknown) {
    console.error('[bi/intelligence] Erro:', errorMessage(err))
    return NextResponse.json({ error: 'Erro ao gerar inteligência de marketing' }, { status: 500 })
  }
}
