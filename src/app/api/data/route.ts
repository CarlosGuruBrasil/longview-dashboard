import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { kv } from '@vercel/kv';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-longview-key';
const META_API_VERSION = 'v21.0'; // Atualizado de v18.0
const META_PAGE_ID = '259079394232614'; // Longview Empreendimentos

const CACHE_TTL = {
  full:   21600, // 6h
  meta:    3600, // 1h
} as const;

async function verifyAuth(): Promise<any | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const authUser = await verifyAuth();
  if (!authUser) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const ip = getClientIp(request);
  const rl = await rateLimit(`data:${ip}`, 30, 60);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde antes de atualizar novamente.' },
      { status: 429, headers: { 'Retry-After': String(rl.reset) } }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const isMetaOnly   = searchParams.get('type') === 'meta';
    const startDate    = searchParams.get('start');
    const endDate      = searchParams.get('end');
    const forceRefresh = searchParams.get('refresh') === 'true';

    const cacheKey = isMetaOnly
      ? `dashboard_meta_${startDate ?? 'all'}_${endDate ?? 'all'}`
      : startDate || endDate
        ? `dashboard_filtered_${startDate ?? ''}_${endDate ?? ''}`
        : 'dashboard_data';

    if (!forceRefresh) {
      try {
        const cachedData = await kv.get<any>(cacheKey);
        if (cachedData?.estoque || cachedData?.meta) {
          console.log(`[/api/data] Cache hit: ${cacheKey}`);
          return NextResponse.json({ ...cachedData, _cached: true });
        }
      } catch (err: any) {
        console.warn('[/api/data] Erro ao ler cache KV:', err.message);
      }
    }

    const CV_CRM_TOKEN = process.env.CV_CRM_TOKEN;
    const CV_CRM_EMAIL = process.env.CV_CRM_EMAIL;
    const META_TOKEN   = process.env.META_TOKEN;
    const META_ACT_ID  = process.env.META_ACT_ID;

    console.log(`[/api/data] Buscando dados frescos — MetaOnly: ${isMetaOnly}, Filtros: ${startDate} - ${endDate}`);

    // ─── CRM: Leads paginados ─────────────────────────────────────────────────
    const fetchAllCRMLeads = async () => {
      if (isMetaOnly) return { leads: [], total: 0 };
      const limit = 500;
      const initial = await axios.get(
        'https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads',
        { params: { limit: 1 }, headers: { email: CV_CRM_EMAIL, token: CV_CRM_TOKEN, Accept: 'application/json' }, timeout: 15000 }
      );
      const totalLeads = initial.data.total || 0;
      const maxLeads   = Math.min(totalLeads, 5000);
      const totalPages = Math.ceil(maxLeads / limit);
      const promises   = Array.from({ length: totalPages }, (_, i) =>
        axios.get('https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads', {
          params: { limit, offset: i * limit },
          headers: { email: CV_CRM_EMAIL, token: CV_CRM_TOKEN, Accept: 'application/json' },
          timeout: 15000,
        })
      );
      const results  = await Promise.all(promises);
      const allLeads = results.flatMap((res: any) => res.data.leads || []);
      return { leads: allLeads, total: allLeads.length };
    };

    // ─── CRM: Empreendimentos e Estoque ───────────────────────────────────────
    const fetchAllCVCRMProjects = async () => {
      if (isMetaOnly) return [];
      try {
        const r = await axios.get(
          'https://longviewempreendimentos.cvcrm.com.br/api/v1/cadastros/empreendimentos',
          { headers: { email: CV_CRM_EMAIL, token: CV_CRM_TOKEN, Accept: 'application/json' }, timeout: 15000 }
        );
        return Array.isArray(r.data) ? r.data : [];
      } catch (err: any) {
        console.error('[/api/data] Erro empreendimentos:', err.message);
        return [];
      }
    };

    const fetchCVCRMEstoque = async (id: string) => {
      if (isMetaOnly) return null;
      try {
        const r = await axios.get(
          `https://longviewempreendimentos.cvcrm.com.br/api/v1/cadastros/empreendimentos/${id}`,
          { params: { limite_dados_unidade: 1000 }, headers: { email: CV_CRM_EMAIL, token: CV_CRM_TOKEN, Accept: 'application/json' }, timeout: 15000 }
        );
        return { id, data: r.data };
      } catch (err: any) {
        console.error(`[/api/data] Erro estoque ${id}:`, err.message);
        return { id, data: null };
      }
    };

    const activeProjects   = await fetchAllCVCRMProjects();
    const activeProjectIds = activeProjects.map((p: any) => p.idempreendimento).filter(Boolean);

    // ─── Meta Ads: parâmetros de tempo ────────────────────────────────────────
    let timeParams: Record<string, string> = { date_preset: 'maximum' };
    if (startDate && endDate) {
      timeParams = { time_range: JSON.stringify({ since: startDate, until: endDate }) };
    } else if (startDate) {
      const today = new Date().toISOString().split('T')[0];
      timeParams = { time_range: JSON.stringify({ since: startDate, until: today }) };
    } else if (endDate) {
      timeParams = { time_range: JSON.stringify({ since: '2020-01-01', until: endDate }) };
    }

    const metaBase = `https://graph.facebook.com/${META_API_VERSION}/${META_ACT_ID}`;
    const metaAuth = { access_token: META_TOKEN };

    // ─── Meta Ads: todas as chamadas em paralelo ──────────────────────────────
    const [
      crmResult,

      // 1. KPIs globais da conta — agora com reach, frequency, cpc, cpm, ctr, cpp, cost_per_action_type
      metaGlobalResult,

      // 2. Campanhas com dados enriquecidos — reach, frequency, cpc, cpm, ctr, cpp
      metaCampResult,

      // 3. Detalhes das campanhas (datas reais, status, objetivo)
      metaCampDetailsResult,

      // 4. Adsets — granularidade entre campanha e anúncio
      metaAdsetResult,

      // 5. Demographic breakdown: gender + age
      metaDemoResult,

      // 6. Regional breakdown
      metaRegionResult,

      // 7. Platform breakdown (fb vs instagram vs audience_network)
      metaPlatformResult,

      // 8. Device breakdown (mobile vs desktop)
      metaDeviceResult,

      // 9. Daily breakdown — série temporal de spend/clicks/impressions
      metaDailyResult,

      // 10. Estoque por empreendimento
      estoqueResults,

      // 11. Formulários de leads Meta
      leadFormsResult,

      // 12. Dados da página Facebook
      pageResult,
    ] = await Promise.allSettled([
      fetchAllCRMLeads(),

      // Global — campos completos incluindo métricas calculadas pela Meta
      axios.get(`${metaBase}/insights`, {
        params: {
          level: 'account',
          fields: 'spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,cpp,actions,cost_per_action_type',
          ...timeParams,
          ...metaAuth,
        },
        timeout: 20000,
      }),

      // Campanhas enriquecidas
      axios.get(`${metaBase}/insights`, {
        params: {
          level: 'campaign',
          fields: 'campaign_id,campaign_name,spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,actions,cost_per_action_type,date_start,date_stop',
          ...timeParams,
          limit: 500,
          ...metaAuth,
        },
        timeout: 20000,
      }),

      // Detalhes estruturais das campanhas
      axios.get(`${metaBase}/campaigns`, {
        params: {
          fields: 'id,name,created_time,start_time,stop_time,status,objective,buying_type,daily_budget,lifetime_budget,spend_cap',
          limit: 1000,
          ...metaAuth,
        },
        timeout: 20000,
      }),

      // Adsets — granularidade intermediária
      axios.get(`${metaBase}/insights`, {
        params: {
          level: 'adset',
          fields: 'campaign_id,campaign_name,adset_id,adset_name,spend,impressions,clicks,reach,cpc,cpm,ctr,actions,cost_per_action_type,optimization_goal,targeting',
          ...timeParams,
          limit: 500,
          ...metaAuth,
        },
        timeout: 20000,
      }),

      // Demographic: gender + age
      axios.get(`${metaBase}/insights`, {
        params: {
          level: 'account',
          fields: 'clicks,impressions,spend,reach',
          breakdowns: 'gender,age',
          ...timeParams,
          ...metaAuth,
        },
        timeout: 20000,
      }),

      // Regional
      axios.get(`${metaBase}/insights`, {
        params: {
          level: 'account',
          fields: 'clicks,impressions,spend,reach',
          breakdowns: 'region',
          ...timeParams,
          ...metaAuth,
        },
        timeout: 20000,
      }),

      // Platform
      axios.get(`${metaBase}/insights`, {
        params: {
          level: 'account',
          fields: 'clicks,impressions,spend,reach',
          breakdowns: 'publisher_platform',
          ...timeParams,
          ...metaAuth,
        },
        timeout: 20000,
      }),

      // Device: mobile vs desktop
      axios.get(`${metaBase}/insights`, {
        params: {
          level: 'account',
          fields: 'clicks,impressions,spend,reach',
          breakdowns: 'device_platform',
          ...timeParams,
          ...metaAuth,
        },
        timeout: 20000,
      }),

      // Daily time series — evolução diária de spend, impressions, clicks, reach
      axios.get(`${metaBase}/insights`, {
        params: {
          level: 'account',
          fields: 'spend,impressions,clicks,reach,actions',
          time_increment: 1, // 1 = diário
          ...(startDate || endDate ? timeParams : { date_preset: 'last_30d' }), // default 30 dias para daily
          limit: 90, // máximo 90 dias de série diária
          ...metaAuth,
        },
        timeout: 20000,
      }),

      // Estoque
      Promise.all(activeProjectIds.map((id: string) => fetchCVCRMEstoque(id))),
    ]);

    // ─── Extrair resultados ───────────────────────────────────────────────────
    const crmData           = crmResult.status === 'fulfilled' ? crmResult.value : { leads: [], total: 0 };
    const metaGlobalRes     = metaGlobalResult.status === 'fulfilled' ? (metaGlobalResult.value as any) : { data: { data: [] } };
    const metaCampRes       = metaCampResult.status === 'fulfilled' ? (metaCampResult.value as any) : { data: { data: [] } };
    const metaCampDetailsRes = metaCampDetailsResult.status === 'fulfilled' ? (metaCampDetailsResult.value as any) : { data: { data: [] } };
    const metaAdsetRes      = metaAdsetResult.status === 'fulfilled' ? (metaAdsetResult.value as any) : { data: { data: [] } };
    const metaDemoRes       = metaDemoResult.status === 'fulfilled' ? (metaDemoResult.value as any) : { data: { data: [] } };
    const metaRegionRes     = metaRegionResult.status === 'fulfilled' ? (metaRegionResult.value as any) : { data: { data: [] } };
    const metaPlatformRes   = metaPlatformResult.status === 'fulfilled' ? (metaPlatformResult.value as any) : { data: { data: [] } };
    const metaDeviceRes     = metaDeviceResult.status === 'fulfilled' ? (metaDeviceResult.value as any) : { data: { data: [] } };
    const metaDailyRes      = metaDailyResult.status === 'fulfilled' ? (metaDailyResult.value as any) : { data: { data: [] } };
    const rawEstoque        = estoqueResults.status === 'fulfilled' ? estoqueResults.value : [];
    const leadFormsRes      = leadFormsResult.status === 'fulfilled' ? (leadFormsResult.value as any) : null;
    const pageDataRes       = pageResult.status === 'fulfilled' ? (pageResult.value as any) : null;

    // Log erros das chamadas Meta para diagnóstico
    [
      ['global', metaGlobalResult],
      ['campaigns', metaCampResult],
      ['campaignDetails', metaCampDetailsResult],
      ['adsets', metaAdsetResult],
      ['demographics', metaDemoResult],
      ['regions', metaRegionResult],
      ['platforms', metaPlatformResult],
      ['devices', metaDeviceResult],
      ['daily', metaDailyResult],
    ].forEach(([name, result]: any) => {
      if (result.status === 'rejected') {
        console.error(`[/api/data] Meta ${name} falhou:`, result.reason?.message);
      }
    });

    // ─── Montar mapa de estoque ───────────────────────────────────────────────
    const estoqueMap: Record<string, any> = {};
    if (Array.isArray(rawEstoque)) {
      rawEstoque.forEach((item: any) => {
        if (item?.id && item?.data) estoqueMap[item.id] = item.data;
      });
    }

    // ─── Payload final ────────────────────────────────────────────────────────
    const fullData = {
      leads:     crmData,
      meta: {
        // KPIs globais — agora com reach, frequency, cpc, cpm, ctr, cpp
        global:          metaGlobalRes.data?.data?.[0] ?? null,

        // Campanhas — agora com reach, frequency, cpc, cpm, ctr
        campaigns:       metaCampRes.data?.data ?? [],

        // Detalhes estruturais das campanhas (datas reais, orçamentos)
        campaignDetails: metaCampDetailsRes.data?.data ?? [],

        // Adsets — nova granularidade
        adsets:          metaAdsetRes.data?.data ?? [],

        // Breakdowns
        demographics:    metaDemoRes.data?.data ?? [],
        regions:         metaRegionRes.data?.data ?? [],
        platforms:       metaPlatformRes.data?.data ?? [],

        // Novo: breakdown por device (mobile vs desktop)
        devices:         metaDeviceRes.data?.data ?? [],

        // Novo: série temporal diária para gráfico de evolução
        daily:           metaDailyRes.data?.data ?? [],
      },
      estoque:   estoqueMap,
      // Formulários de leads Meta (via página)
      leadForms: leadFormsRes?.data?.data ?? [],
      // Dados básicos da página Facebook + Instagram ID
      page: pageDataRes?.data ?? null,
      updatedAt: new Date().toISOString(),
      _cached:   false,
    };

    // ─── Salvar no cache ──────────────────────────────────────────────────────
    if (!isMetaOnly && !startDate && !endDate) {
      try {
        await kv.set('dashboard_data', fullData, { ex: CACHE_TTL.full });
        console.log(`[/api/data] Cache salvo: dashboard_data`);
      } catch (err: any) {
        console.warn('[/api/data] Erro ao salvar cache:', err.message);
      }
    } else if (isMetaOnly) {
      try {
        await kv.set(cacheKey, fullData, { ex: CACHE_TTL.meta });
      } catch { /* non-critical */ }
    }

    return NextResponse.json(fullData);
  } catch (error: any) {
    console.error('[/api/data] Erro crítico:', error.response?.data || error.message);
    return NextResponse.json(
      { error: 'Erro na sincronização das APIs externas.', details: error.message },
      { status: 500 }
    );
  }
}
