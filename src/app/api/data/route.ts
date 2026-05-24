import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { kv } from '@vercel/kv';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-longview-key';

// Helper para validar a assinatura e obter o token JWT na API
async function verifyAuth(): Promise<any | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const authUser = await verifyAuth();
  if (!authUser) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const isMetaOnly = searchParams.get('type') === 'meta';
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Verificar se existe cache no Redis (Vercel KV) apenas para a consulta geral
    if (!forceRefresh && !isMetaOnly && !startDate && !endDate) {
      try {
        const cachedData = await kv.get<any>('dashboard_data');
        if (cachedData && cachedData.estoque) {
          console.log("Servindo dados do Cache (Vercel KV) com estoque atualizado");
          return NextResponse.json(cachedData);
        }
      } catch (err: any) {
        console.warn("Erro ao buscar cache no Redis, continuando busca nas APIs:", err.message);
      }
    }

    // Configurações das APIs
    const CV_CRM_TOKEN = process.env.CV_CRM_TOKEN;
    const CV_CRM_EMAIL = process.env.CV_CRM_EMAIL;
    const META_TOKEN = process.env.META_TOKEN;
    const META_ACT_ID = process.env.META_ACT_ID;

    console.log(`Buscando dados frescos comercial... (MetaOnly: ${isMetaOnly}, Filtros: ${startDate} - ${endDate})`);

    // 1. CRM Leads com paginação paralelizada
    const fetchAllCRMLeads = async () => {
      if (isMetaOnly) return { leads: [], total: 0 };
      
      const limit = 500;
      
      // Primeira chamada leve para pegar o total
      const initialResponse = await axios.get(`https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads`, {
        params: { limit: 1 },
        headers: { "email": CV_CRM_EMAIL, "token": CV_CRM_TOKEN, "Accept": "application/json" }
      });
      
      const totalLeads = initialResponse.data.total || 0;
      
      // Limitar busca a 5000 por segurança
      const maxLeads = Math.min(totalLeads, 5000);
      const totalPages = Math.ceil(maxLeads / limit);
      
      const promises = [];
      for (let page = 1; page <= totalPages; page++) {
        promises.push(
          axios.get(`https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads`, {
            params: { limit, offset: (page - 1) * limit },
            headers: { "email": CV_CRM_EMAIL, "token": CV_CRM_TOKEN, "Accept": "application/json" }
          })
        );
      }
      
      const results = await Promise.all(promises);
      let allLeads: any[] = [];
      results.forEach((res: any) => {
        const leads = res.data.leads || [];
        allLeads = allLeads.concat(leads);
      });
      
      return { leads: allLeads, total: allLeads.length };
    };

    const crmPromise = fetchAllCRMLeads();

    // CRM Empreendimentos
    const fetchAllCVCRMProjects = async () => {
      if (isMetaOnly) return [];
      try {
        const response = await axios.get(`https://longviewempreendimentos.cvcrm.com.br/api/v1/cadastros/empreendimentos`, {
          headers: { "email": CV_CRM_EMAIL, "token": CV_CRM_TOKEN, "Accept": "application/json" }
        });
        return Array.isArray(response.data) ? response.data : [];
      } catch (err: any) {
        console.error("Erro ao buscar lista de empreendimentos:", err.message);
        return [];
      }
    };

    // Primeiro buscar os empreendimentos ativos para estoque
    const activeProjects = await fetchAllCVCRMProjects();
    const activeProjectIds = activeProjects.map((p: any) => p.idempreendimento).filter(Boolean);

    const fetchCVCRMEstoque = async (idEmpreendimento: string) => {
      if (isMetaOnly) return null;
      try {
        const response = await axios.get(`https://longviewempreendimentos.cvcrm.com.br/api/v1/cadastros/empreendimentos/${idEmpreendimento}`, {
          params: { limite_dados_unidade: 1000 },
          headers: { "email": CV_CRM_EMAIL, "token": CV_CRM_TOKEN, "Accept": "application/json" }
        });
        return { id: idEmpreendimento, data: response.data };
      } catch (err: any) {
        console.error(`Erro ao buscar estoque para empreendimento ${idEmpreendimento}:`, err.message);
        return { id: idEmpreendimento, data: null };
      }
    };

    // Estoques em paralelo
    const estoquePromises = Promise.all(activeProjectIds.map((id: string) => fetchCVCRMEstoque(id)));

    // Filtros de tempo para o Meta Ads
    let timeParams: any = { date_preset: 'maximum' };
    if (startDate && endDate) {
      timeParams = { time_range: JSON.stringify({ since: startDate, until: endDate }) };
    } else if (startDate) {
      const today = new Date().toISOString().split('T')[0];
      timeParams = { time_range: JSON.stringify({ since: startDate, until: today }) };
    } else if (endDate) {
      timeParams = { time_range: JSON.stringify({ since: '2020-01-01', until: endDate }) };
    }

    // Chamadas Meta Ads
    const metaCampPromise = axios.get(`https://graph.facebook.com/v18.0/${META_ACT_ID}/insights`, {
      params: {
        level: 'campaign',
        fields: 'campaign_id,campaign_name,spend,impressions,clicks,actions,date_start,date_stop',
        ...timeParams,
        limit: 500,
        access_token: META_TOKEN
      }
    });

    const metaCampDetailsPromise = axios.get(`https://graph.facebook.com/v18.0/${META_ACT_ID}/campaigns`, {
      params: {
        fields: 'id,name,created_time,start_time,stop_time,status,objective,buying_type',
        limit: 1000,
        access_token: META_TOKEN
      }
    });

    const metaDemoPromise = axios.get(`https://graph.facebook.com/v18.0/${META_ACT_ID}/insights`, {
      params: {
        level: 'account',
        fields: 'clicks,impressions,spend',
        breakdowns: 'gender,age',
        ...timeParams,
        access_token: META_TOKEN
      }
    });

    const metaRegionPromise = axios.get(`https://graph.facebook.com/v18.0/${META_ACT_ID}/insights`, {
      params: {
        level: 'account',
        fields: 'clicks,impressions,spend',
        breakdowns: 'region',
        ...timeParams,
        access_token: META_TOKEN
      }
    });

    const metaGlobalPromise = axios.get(`https://graph.facebook.com/v18.0/${META_ACT_ID}/insights`, {
      params: {
        level: 'account',
        fields: 'clicks,impressions,spend,actions',
        ...timeParams,
        access_token: META_TOKEN
      }
    });

    const metaPlatformPromise = axios.get(`https://graph.facebook.com/v18.0/${META_ACT_ID}/insights`, {
      params: {
        level: 'account',
        fields: 'clicks,impressions,spend',
        breakdowns: 'publisher_platform',
        ...timeParams,
        access_token: META_TOKEN
      }
    });

    const results = await Promise.allSettled([
      crmPromise,
      metaCampPromise,
      metaDemoPromise,
      metaRegionPromise,
      metaGlobalPromise,
      metaPlatformPromise,
      metaCampDetailsPromise,
      estoquePromises
    ]);

    const crmData = results[0].status === 'fulfilled' ? results[0].value : { leads: [] };
    const metaCampRes = results[1].status === 'fulfilled' ? (results[1].value as any) : { data: { data: [] } };
    const metaDemoRes = results[2].status === 'fulfilled' ? (results[2].value as any) : { data: { data: [] } };
    const metaRegionRes = results[3].status === 'fulfilled' ? (results[3].value as any) : { data: { data: [] } };
    const metaGlobalRes = results[4].status === 'fulfilled' ? (results[4].value as any) : { data: { data: [] } };
    const metaPlatformRes = results[5].status === 'fulfilled' ? (results[5].value as any) : { data: { data: [] } };
    const metaCampDetailsRes = results[6].status === 'fulfilled' ? (results[6].value as any) : { data: { data: [] } };
    const estoqueResults = results[7].status === 'fulfilled' ? results[7].value : [];

    const estoqueMap: Record<string, any> = {};
    if (Array.isArray(estoqueResults)) {
      estoqueResults.forEach((item: any) => {
        if (item && item.id && item.data) {
          estoqueMap[item.id] = item.data;
        }
      });
    }

    const fullData = {
      leads: crmData,
      meta: {
        campaigns: metaCampRes.data?.data || [],
        campaignDetails: metaCampDetailsRes.data?.data || [],
        demographics: metaDemoRes.data?.data || [],
        regions: metaRegionRes.data?.data || [],
        platforms: metaPlatformRes.data?.data || [],
        global: metaGlobalRes.data?.data ? metaGlobalRes.data.data[0] : null
      },
      estoque: estoqueMap,
      updatedAt: new Date().toISOString()
    };

    // Cache no Redis se NÃO for um request filtrado por data ou exclusivo do meta
    if (!isMetaOnly && !startDate && !endDate) {
      try {
        await kv.set('dashboard_data', fullData, { ex: 21600 }); // 6 horas
      } catch (err: any) {
        console.warn("Erro ao salvar dados de cache no Redis:", err.message);
      }
    }

    return NextResponse.json(fullData);
  } catch (error: any) {
    console.error("Erro ao sincronizar dados comercial:", error.response?.data || error.message);
    return NextResponse.json({ error: "Erro na sincronização das APIs.", details: error.message }, { status: 500 });
  }
}
