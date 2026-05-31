import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { kv } from '@vercel/kv';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-longview-key';

// TTLs de cache por tipo de dado (em segundos)
const CACHE_TTL = {
  full:          21600, // 6h  — cache completo (leads + estoque + meta)
  leads:          1800, // 30min — somente leads CRM
  estoque:        3600, // 1h  — estoque de unidades
  meta:           3600, // 1h  — dados Meta Ads
} as const;

// Helper para validar JWT via cookie
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
  // 1. Autenticação
  const authUser = await verifyAuth();
  if (!authUser) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  // 2. Rate limiting: 30 req/min por IP para esta rota pesada
  const ip = getClientIp(request);
  const rl = await rateLimit(`data:${ip}`, 30, 60);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde antes de atualizar novamente.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.reset),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const isMetaOnly   = searchParams.get('type') === 'meta';
    const startDate    = searchParams.get('start');
    const endDate      = searchParams.get('end');
    const forceRefresh = searchParams.get('refresh') === 'true';

    // 3. Cache: usa chave específica conforme parâmetros
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

    // 4. Credenciais das APIs externas
    const CV_CRM_TOKEN = process.env.CV_CRM_TOKEN;
    const CV_CRM_EMAIL = process.env.CV_CRM_EMAIL;
    const META_TOKEN   = process.env.META_TOKEN;
    const META_ACT_ID  = process.env.META_ACT_ID;

    console.log(`[/api/data] Buscando dados frescos — MetaOnly: ${isMetaOnly}, Filtros: ${startDate} - ${endDate}`);

    // 5. Busca de leads CRM com paginação paralelizada
    const fetchAllCRMLeads = async () => {
      if (isMetaOnly) return { leads: [], total: 0 };

      const limit = 500;
      const initialResponse = await axios.get(
        'https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads',
        {
          params: { limit: 1 },
          headers: { email: CV_CRM_EMAIL, token: CV_CRM_TOKEN, Accept: 'application/json' },
          timeout: 15000,
        }
      );

      const totalLeads  = initialResponse.data.total || 0;
      const maxLeads    = Math.min(totalLeads, 5000);
      const totalPages  = Math.ceil(maxLeads / limit);

      const promises = Array.from({ length: totalPages }, (_, i) =>
        axios.get('https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads', {
          params: { limit, offset: i * limit },
          headers: { email: CV_CRM_EMAIL, token: CV_CRM_TOKEN, Accept: 'application/json' },
          timeout: 15000,
        })
      );

      const results = await Promise.all(promises);
      const allLeads = results.flatMap((res: any) => res.data.leads || []);
      return { leads: allLeads, total: allLeads.length };
    };

    // 6. Empreendimentos e estoque
    const fetchAllCVCRMProjects = async () => {
      if (isMetaOnly) return [];
      try {
        const response = await axios.get(
          'https://longviewempreendimentos.cvcrm.com.br/api/v1/cadastros/empreendimentos',
          {
            headers: { email: CV_CRM_EMAIL, token: CV_CRM_TOKEN, Accept: 'application/json' },
            timeout: 15000,
          }
        );
        return Array.isArray(response.data) ? response.data : [];
      } catch (err: any) {
        console.error('[/api/data] Erro ao buscar empreendimentos:', err.message);
        return [];
      }
    };

    const fetchCVCRMEstoque = async (idEmpreendimento: string) => {
      if (isMetaOnly) return null;
      try {
        const response = await axios.get(
          `https://longviewempreendimentos.cvcrm.com.br/api/v1/cadastros/empreendimentos/${idEmpreendimento}`,
          {
            params: { limite_dados_unidade: 1000 },
            headers: { email: CV_CRM_EMAIL, token: CV_CRM_TOKEN, Accept: 'application/json' },
            timeout: 15000,
          }
        );
        return { id: idEmpreendimento, data: response.data };
      } catch (err: any) {
        console.error(`[/api/data] Erro ao buscar estoque ${idEmpreendimento}:`, err.message);
        return { id: idEmpreendimento, data: null };
      }
    };

    // Buscar projetos ativos para montar lista de estoques
    const activeProjects   = await fetchAllCVCRMProjects();
    const activeProjectIds = activeProjects.map((p: any) => p.idempreendimento).filter(Boolean);

    // 7. Parâmetros de tempo para o Meta Ads
    let timeParams: Record<string, string> = { date_preset: 'maximum' };
    if (startDate && endDate) {
      timeParams = { time_range: JSON.stringify({ since: startDate, until: endDate }) };
    } else if (startDate) {
      const today = new Date().toISOString().split('T')[0];
      timeParams = { time_range: JSON.stringify({ since: startDate, until: today }) };
    } else if (endDate) {
      timeParams = { time_range: JSON.stringify({ since: '2020-01-01', until: endDate }) };
    }

    // 8. Disparar todas as chamadas em paralelo
    const metaBase = `https://graph.facebook.com/v18.0/${META_ACT_ID}`;
    const metaHeaders = { access_token: META_TOKEN };

    const [
      crmResult,
      metaCampResult,
      metaDemoResult,
      metaRegionResult,
      metaGlobalResult,
      metaPlatformResult,
      metaCampDetailsResult,
      estoqueResults,
    ] = await Promise.allSettled([
      fetchAllCRMLeads(),
      axios.get(`${metaBase}/insights`, {
        params: { level: 'campaign', fields: 'campaign_id,campaign_name,spend,impressions,clicks,actions,date_start,date_stop', ...timeParams, limit: 500, ...metaHeaders },
        timeout: 20000,
      }),
      axios.get(`${metaBase}/insights`, {
        params: { level: 'account', fields: 'clicks,impressions,spend', breakdowns: 'gender,age', ...timeParams, ...metaHeaders },
        timeout: 20000,
      }),
      axios.get(`${metaBase}/insights`, {
        params: { level: 'account', fields: 'clicks,impressions,spend', breakdowns: 'region', ...timeParams, ...metaHeaders },
        timeout: 20000,
      }),
      axios.get(`${metaBase}/insights`, {
        params: { level: 'account', fields: 'clicks,impressions,spend,actions', ...timeParams, ...metaHeaders },
        timeout: 20000,
      }),
      axios.get(`${metaBase}/insights`, {
        params: { level: 'account', fields: 'clicks,impressions,spend', breakdowns: 'publisher_platform', ...timeParams, ...metaHeaders },
        timeout: 20000,
      }),
      axios.get(`${metaBase}/campaigns`, {
        params: { fields: 'id,name,created_time,start_time,stop_time,status,objective,buying_type', limit: 1000, ...metaHeaders },
        timeout: 20000,
      }),
      Promise.all(activeProjectIds.map((id: string) => fetchCVCRMEstoque(id))),
    ]);

    // 9. Extrair resultados com fallback seguro
    const crmData           = crmResult.status === 'fulfilled' ? crmResult.value : { leads: [], total: 0 };
    const metaCampRes       = metaCampResult.status === 'fulfilled' ? (metaCampResult.value as any) : { data: { data: [] } };
    const metaDemoRes       = metaDemoResult.status === 'fulfilled' ? (metaDemoResult.value as any) : { data: { data: [] } };
    const metaRegionRes     = metaRegionResult.status === 'fulfilled' ? (metaRegionResult.value as any) : { data: { data: [] } };
    const metaGlobalRes     = metaGlobalResult.status === 'fulfilled' ? (metaGlobalResult.value as any) : { data: { data: [] } };
    const metaPlatformRes   = metaPlatformResult.status === 'fulfilled' ? (metaPlatformResult.value as any) : { data: { data: [] } };
    const metaCampDetailsRes = metaCampDetailsResult.status === 'fulfilled' ? (metaCampDetailsResult.value as any) : { data: { data: [] } };
    const rawEstoque        = estoqueResults.status === 'fulfilled' ? estoqueResults.value : [];

    // 10. Montar mapa de estoque
    const estoqueMap: Record<string, any> = {};
    if (Array.isArray(rawEstoque)) {
      rawEstoque.forEach((item: any) => {
        if (item?.id && item?.data) estoqueMap[item.id] = item.data;
      });
    }

    // 11. Montar payload final
    const fullData = {
      leads:     crmData,
      meta: {
        campaigns:       metaCampRes.data?.data ?? [],
        campaignDetails: metaCampDetailsRes.data?.data ?? [],
        demographics:    metaDemoRes.data?.data ?? [],
        regions:         metaRegionRes.data?.data ?? [],
        platforms:       metaPlatformRes.data?.data ?? [],
        global:          metaGlobalRes.data?.data?.[0] ?? null,
      },
      estoque:   estoqueMap,
      updatedAt: new Date().toISOString(),
      _cached:   false,
    };

    // 12. Salvar no cache KV (apenas requests sem filtros de data)
    if (!isMetaOnly && !startDate && !endDate) {
      try {
        await kv.set('dashboard_data', fullData, { ex: CACHE_TTL.full });
        console.log(`[/api/data] Cache salvo: dashboard_data (TTL ${CACHE_TTL.full}s)`);
      } catch (err: any) {
        console.warn('[/api/data] Erro ao salvar cache KV:', err.message);
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
