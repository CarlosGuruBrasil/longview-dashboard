import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { kv } from '@vercel/kv';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

const JWT_SECRET       = process.env.JWT_SECRET || 'secret-longview-key';
const META_API_VERSION = 'v21.0';
const META_PAGE_ID     = '259079394232614';

const CACHE_TTL = {
  full:  21600,
  meta:   3600,
  stale: 86400,
} as const;

const HARD_TIMEOUT_MS = 55000;

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

async function fetchAllCRMLeads(email: string, token: string) {
  const headers = { email, token, Accept: 'application/json' };
  const base    = 'https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads';
  try {
    const initial = await axios.get(base, { params: { limit: 1 }, headers, timeout: 8000 });
    const maxLeads   = Math.min(initial.data.total || 0, 3000);
    const limit      = 500;
    const totalPages = Math.ceil(maxLeads / limit);
    const results = await Promise.allSettled(
      Array.from({ length: totalPages }, (_, i) =>
        axios.get(base, { params: { limit, offset: i * limit }, headers, timeout: 12000 })
      )
    );
    const allLeads = results
      .filter(r => r.status === 'fulfilled')
      .flatMap((r: any) => r.value.data?.leads || []);
    return { leads: allLeads, total: allLeads.length };
  } catch (err: any) {
    console.warn('[/api/data] CRM leads falhou:', err.message);
    return { leads: [], total: 0 };
  }
}

async function fetchCVCRMProjects(email: string, token: string) {
  try {
    const r = await axios.get(
      'https://longviewempreendimentos.cvcrm.com.br/api/v1/cadastros/empreendimentos',
      { headers: { email, token, Accept: 'application/json' }, timeout: 10000 }
    );
    return Array.isArray(r.data) ? r.data : [];
  } catch (err: any) {
    console.warn('[/api/data] Projetos falhou:', err.message);
    return [];
  }
}

async function fetchCVCRMEstoque(id: string, email: string, token: string) {
  try {
    const r = await axios.get(
      `https://longviewempreendimentos.cvcrm.com.br/api/v1/cadastros/empreendimentos/${id}`,
      { params: { limite_dados_unidade: 1000 }, headers: { email, token, Accept: 'application/json' }, timeout: 10000 }
    );
    return { id, data: r.data };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const authUser = await verifyAuth();
  if (!authUser) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const ip = getClientIp(request);
  const rl = await rateLimit(`data:${ip}`, 30, 60);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde antes de atualizar novamente.' },
      { status: 429, headers: { 'Retry-After': String(rl.reset) } }
    );
  }

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

  const staleCacheKey = `stale_${cacheKey}`;

  // Tentar cache válido
  if (!forceRefresh) {
    try {
      const cachedData = await kv.get<any>(cacheKey);
      if (cachedData?.estoque || cachedData?.meta) {
        console.log(`[/api/data] Cache hit: ${cacheKey}`);
        return NextResponse.json({ ...cachedData, _cached: true });
      }
    } catch (err: any) {
      console.warn('[/api/data] Erro cache KV:', err.message);
    }
  }

  // Carregar stale como fallback
  let staleData: any = null;
  try { staleData = await kv.get<any>(staleCacheKey); } catch { /* silencioso */ }

  const CV_CRM_TOKEN = process.env.CV_CRM_TOKEN!;
  const CV_CRM_EMAIL = process.env.CV_CRM_EMAIL!;
  const META_TOKEN   = process.env.META_TOKEN!;
  const META_ACT_ID  = process.env.META_ACT_ID!;

  console.log(`[/api/data] Buscando dados frescos — MetaOnly: ${isMetaOnly}`);

  try {
    const hardTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), HARD_TIMEOUT_MS)
    );

    const fetchAll = (async () => {
      let timeParams: Record<string, string> = { date_preset: 'maximum' };
      if (startDate && endDate) timeParams = { time_range: JSON.stringify({ since: startDate, until: endDate }) };
      else if (startDate) timeParams = { time_range: JSON.stringify({ since: startDate, until: new Date().toISOString().split('T')[0] }) };
      else if (endDate) timeParams = { time_range: JSON.stringify({ since: '2020-01-01', until: endDate }) };

      const metaBase = `https://graph.facebook.com/${META_API_VERSION}/${META_ACT_ID}`;
      const metaAuth = { access_token: META_TOKEN };

      // TUDO em paralelo — CRM + projetos + 9 chamadas Meta simultaneamente
      const [
        crmResult, projectsResult,
        metaGlobalResult, metaCampResult, metaCampDetailsResult,
        metaAdsetResult, metaDemoResult, metaRegionResult,
        metaPlatformResult, metaDeviceResult, metaDailyResult,
        leadFormsResult, pageResult,
      ] = await Promise.allSettled([
        fetchAllCRMLeads(CV_CRM_EMAIL, CV_CRM_TOKEN),
        fetchCVCRMProjects(CV_CRM_EMAIL, CV_CRM_TOKEN),
        axios.get(`${metaBase}/insights`, { params: { level: 'account', fields: 'spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,cpp,actions,cost_per_action_type', ...timeParams, ...metaAuth }, timeout: 15000 }),
        axios.get(`${metaBase}/insights`, { params: { level: 'campaign', fields: 'campaign_id,campaign_name,spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,actions,cost_per_action_type,date_start,date_stop', ...timeParams, limit: 500, ...metaAuth }, timeout: 15000 }),
        axios.get(`${metaBase}/campaigns`, { params: { fields: 'id,name,created_time,start_time,stop_time,status,objective,buying_type,daily_budget,lifetime_budget,spend_cap', limit: 1000, ...metaAuth }, timeout: 15000 }),
        axios.get(`${metaBase}/insights`, { params: { level: 'adset', fields: 'campaign_id,campaign_name,adset_id,adset_name,spend,impressions,clicks,reach,cpc,cpm,ctr,actions,cost_per_action_type', ...timeParams, limit: 500, ...metaAuth }, timeout: 15000 }),
        axios.get(`${metaBase}/insights`, { params: { level: 'account', fields: 'clicks,impressions,spend,reach', breakdowns: 'gender,age', ...timeParams, ...metaAuth }, timeout: 15000 }),
        axios.get(`${metaBase}/insights`, { params: { level: 'account', fields: 'clicks,impressions,spend,reach', breakdowns: 'region', ...timeParams, ...metaAuth }, timeout: 15000 }),
        axios.get(`${metaBase}/insights`, { params: { level: 'account', fields: 'clicks,impressions,spend,reach', breakdowns: 'publisher_platform', ...timeParams, ...metaAuth }, timeout: 15000 }),
        axios.get(`${metaBase}/insights`, { params: { level: 'account', fields: 'clicks,impressions,spend,reach', breakdowns: 'device_platform', ...timeParams, ...metaAuth }, timeout: 15000 }),
        axios.get(`${metaBase}/insights`, { params: { level: 'account', fields: 'spend,impressions,clicks,reach,actions', time_increment: 1, ...(startDate || endDate ? timeParams : { date_preset: 'last_30d' }), limit: 90, ...metaAuth }, timeout: 15000 }),
        axios.get(`https://graph.facebook.com/${META_API_VERSION}/${META_PAGE_ID}/leadgen_forms`, { params: { fields: 'id,name,status,leads_count,created_time', limit: 50, ...metaAuth }, timeout: 10000 }),
        axios.get(`https://graph.facebook.com/${META_API_VERSION}/${META_PAGE_ID}`, { params: { fields: 'id,name,fan_count,followers_count,instagram_business_account', ...metaAuth }, timeout: 8000 }),
      ]);

      // Buscar estoque após ter os projetos
      const projects   = projectsResult.status === 'fulfilled' ? projectsResult.value : [];
      const projectIds = projects.map((p: any) => p.idempreendimento).filter(Boolean);
      const estoqueItems = await Promise.allSettled(
        projectIds.map((id: string) => fetchCVCRMEstoque(id, CV_CRM_EMAIL, CV_CRM_TOKEN))
      );

      // Extrair
      const crmData        = crmResult.status === 'fulfilled' ? crmResult.value : { leads: [], total: 0 };
      const metaGlobalRes  = metaGlobalResult.status === 'fulfilled' ? (metaGlobalResult.value as any) : { data: { data: [] } };
      const metaCampRes    = metaCampResult.status === 'fulfilled' ? (metaCampResult.value as any) : { data: { data: [] } };
      const metaCampDetRes = metaCampDetailsResult.status === 'fulfilled' ? (metaCampDetailsResult.value as any) : { data: { data: [] } };
      const metaAdsetRes   = metaAdsetResult.status === 'fulfilled' ? (metaAdsetResult.value as any) : { data: { data: [] } };
      const metaDemoRes    = metaDemoResult.status === 'fulfilled' ? (metaDemoResult.value as any) : { data: { data: [] } };
      const metaRegionRes  = metaRegionResult.status === 'fulfilled' ? (metaRegionResult.value as any) : { data: { data: [] } };
      const metaPlatRes    = metaPlatformResult.status === 'fulfilled' ? (metaPlatformResult.value as any) : { data: { data: [] } };
      const metaDevRes     = metaDeviceResult.status === 'fulfilled' ? (metaDeviceResult.value as any) : { data: { data: [] } };
      const metaDailyRes   = metaDailyResult.status === 'fulfilled' ? (metaDailyResult.value as any) : { data: { data: [] } };
      const leadFormsRes   = leadFormsResult.status === 'fulfilled' ? (leadFormsResult.value as any) : null;
      const pageDataRes    = pageResult.status === 'fulfilled' ? (pageResult.value as any) : null;

      const estoqueMap: Record<string, any> = {};
      estoqueItems.forEach((r: any) => {
        if (r.status === 'fulfilled' && r.value?.id && r.value?.data) {
          estoqueMap[r.value.id] = r.value.data;
        }
      });

      return {
        leads:     crmData,
        meta: {
          global:          metaGlobalRes.data?.data?.[0] ?? null,
          campaigns:       metaCampRes.data?.data ?? [],
          campaignDetails: metaCampDetRes.data?.data ?? [],
          adsets:          metaAdsetRes.data?.data ?? [],
          demographics:    metaDemoRes.data?.data ?? [],
          regions:         metaRegionRes.data?.data ?? [],
          platforms:       metaPlatRes.data?.data ?? [],
          devices:         metaDevRes.data?.data ?? [],
          daily:           metaDailyRes.data?.data ?? [],
        },
        estoque:   estoqueMap,
        leadForms: leadFormsRes?.data?.data ?? [],
        page:      pageDataRes?.data ?? null,
        updatedAt: new Date().toISOString(),
        _cached:   false,
      };
    })();

    const fullData = await Promise.race([fetchAll, hardTimeout]);

    // Salvar cache normal + stale
    if (!isMetaOnly && !startDate && !endDate) {
      Promise.all([
        kv.set('dashboard_data', fullData, { ex: CACHE_TTL.full }),
        kv.set(staleCacheKey, fullData, { ex: CACHE_TTL.stale }),
      ]).then(() => console.log('[/api/data] Cache salvo')).catch(() => {});
    } else if (isMetaOnly) {
      kv.set(cacheKey, fullData, { ex: CACHE_TTL.meta }).catch(() => {});
    }

    return NextResponse.json(fullData);

  } catch (error: any) {
    const isTimeout = error.message === 'TIMEOUT';
    console.error(`[/api/data] ${isTimeout ? 'Timeout' : 'Erro crítico'}:`, error.message);

    if (staleData) {
      console.log('[/api/data] Retornando cache stale');
      return NextResponse.json({ ...staleData, _cached: true, _stale: true });
    }

    return NextResponse.json(
      { error: 'Erro na sincronização das APIs externas.', details: error.message },
      { status: 500 }
    );
  }
}
