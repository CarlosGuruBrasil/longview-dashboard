const axios = require('axios');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.auth_token;
  const JWT_SECRET = process.env.JWT_SECRET || 'secret-longview-key';

  try {
    jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    const isMetaOnly = req.query.type === 'meta';
    const startDate = req.query.start;
    const endDate = req.query.end;

    // Verificar se existe cache no Redis (Vercel KV) Apenas para o dashboard global
    const forceRefresh = req.query.refresh === 'true';
    if (!forceRefresh && !isMetaOnly && !startDate && !endDate) {
      const cachedData = await kv.get('dashboard_data');
      if (cachedData) {
        console.log("Servindo dados do Cache (Redis)");
        return res.status(200).json(cachedData);
      }
    }

    // Tokens (Devem estar configurados no Vercel Dashboard)
    const CV_CRM_TOKEN = process.env.CV_CRM_TOKEN;
    const CV_CRM_EMAIL = process.env.CV_CRM_EMAIL;
    const META_TOKEN = process.env.META_TOKEN;
    const META_ACT_ID = process.env.META_ACT_ID;

    console.log(`Buscando dados frescos das APIs... (MetaOnly: ${isMetaOnly}, Filtros: ${startDate} - ${endDate})`);

    // 1. CRM Leads - Função para buscar TUDO com paginação (Pula se for só Meta)
    const fetchAllCRMLeads = async () => {
      if (isMetaOnly) return { leads: [], total: 0 };
      
      let allLeads = [];
      let page = 1;
      let hasMore = true;
      const limit = 500;

      console.log("Iniciando varredura completa de leads...");

      while (hasMore) {
        const response = await axios.get(`https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads`, {
          params: { limit, offset: (page - 1) * limit },
          headers: { "email": CV_CRM_EMAIL, "token": CV_CRM_TOKEN, "Accept": "application/json" }
        });

        const leads = response.data.leads || [];
        allLeads = allLeads.concat(leads);

        if (leads.length < limit || allLeads.length >= 5000) { 
          hasMore = false;
        } else {
          page++;
        }
      }
      return { leads: allLeads, total: allLeads.length };
    };

    const crmPromise = fetchAllCRMLeads();

    // Lógica de tempo para o Meta Ads
    let timeParams = { date_preset: 'maximum' };
    if (startDate && endDate) {
      timeParams = { time_range: JSON.stringify({ since: startDate, until: endDate }) };
    } else if (startDate) {
      // Se tiver só start, bota until como hoje
      const today = new Date().toISOString().split('T')[0];
      timeParams = { time_range: JSON.stringify({ since: startDate, until: today }) };
    } else if (endDate) {
      // Se tiver só end, bota start bem pra trás
      timeParams = { time_range: JSON.stringify({ since: '2020-01-01', until: endDate }) };
    }

    // 2. Meta Ads - Campanhas (Insights)
    const metaCampPromise = axios.get(`https://graph.facebook.com/v18.0/${META_ACT_ID}/insights`, {
      params: {
        level: 'campaign',
        fields: 'campaign_id,campaign_name,spend,impressions,clicks,actions,date_start,date_stop',
        ...timeParams,
        limit: 500,
        access_token: META_TOKEN
      }
    });

    // 2.1 Meta Ads - Detalhes da Campanha (Para datas reais de início/fim)
    // Aumentamos o limite para 1000 para garantir que pegamos TUDO do histórico
    const metaCampDetailsPromise = axios.get(`https://graph.facebook.com/v18.0/${META_ACT_ID}/campaigns`, {
      params: {
        fields: 'id,name,created_time,start_time,stop_time,status',
        limit: 1000,
        access_token: META_TOKEN
      }
    });

    // 3. Meta Ads - Demográficos (Gênero/Idade)
    const metaDemoPromise = axios.get(`https://graph.facebook.com/v18.0/${META_ACT_ID}/insights`, {
      params: {
        level: 'account',
        fields: 'clicks,impressions,spend',
        breakdowns: 'gender,age',
        ...timeParams,
        access_token: META_TOKEN
      }
    });

    // 4. Meta Ads - Região
    const metaRegionPromise = axios.get(`https://graph.facebook.com/v18.0/${META_ACT_ID}/insights`, {
      params: {
        level: 'account',
        fields: 'clicks,impressions,spend',
        breakdowns: 'region',
        ...timeParams,
        access_token: META_TOKEN
      }
    });

    // 5. Meta Ads - Totais Globais
    const metaGlobalPromise = axios.get(`https://graph.facebook.com/v18.0/${META_ACT_ID}/insights`, {
      params: {
        level: 'account',
        fields: 'clicks,impressions,spend,actions',
        ...timeParams,
        access_token: META_TOKEN
      }
    });

    // 6. Meta Ads - Plataforma (Facebook vs Instagram)
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
      crmPromise, metaCampPromise, metaDemoPromise, metaRegionPromise, metaGlobalPromise, metaPlatformPromise, metaCampDetailsPromise
    ]);

    const crmData = results[0].status === 'fulfilled' ? results[0].value : { leads: [] };
    const metaCampRes = results[1].status === 'fulfilled' ? results[1].value : { data: { data: [] } };
    const metaDemoRes = results[2].status === 'fulfilled' ? results[2].value : { data: { data: [] } };
    const metaRegionRes = results[3].status === 'fulfilled' ? results[3].value : { data: { data: [] } };
    const metaGlobalRes = results[4].status === 'fulfilled' ? results[4].value : { data: { data: [] } };

    if (results.some(r => r.status === 'rejected')) {
        console.warn("Algumas APIs falharam:", results.filter(r => r.status === 'rejected').map(r => r.reason ? r.reason.message : 'Unknown'));
    }

    const fullData = {
      leads: crmData,
      meta: {
        campaigns: metaCampRes.data.data || [],
        campaignDetails: results[6].status === 'fulfilled' ? results[6].value.data.data : [],
        demographics: metaDemoRes.data.data || [],
        regions: metaRegionRes.data.data || [],
        platforms: results[5].status === 'fulfilled' ? results[5].value.data.data : [],
        global: metaGlobalRes.data.data ? metaGlobalRes.data.data[0] : null
      },
      updatedAt: new Date().toISOString()
    };

    // Só salvar no cache se NÃO for um request filtrado ou exclusivo do meta
    if (!isMetaOnly && !startDate && !endDate) {
      await kv.set('dashboard_data', fullData);
    }

    res.status(200).json(fullData);
  } catch (error) {
    console.error("Erro ao sincronizar dados:", error.response ? error.response.data : error.message);
    res.status(500).json({ error: "Erro na sincronização", details: error.message });
  }
};

