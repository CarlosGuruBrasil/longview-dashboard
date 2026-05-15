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

  // Verificar se existe cache no Redis (Vercel KV)
  const forceRefresh = req.query.refresh === 'true';
  if (!forceRefresh) {
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

  try {
    console.log("Buscando dados frescos dos APIs...");

    // 1. CRM Leads - Função para buscar TUDO com paginação
    const fetchAllCRMLeads = async () => {
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

        // Se trouxer menos que o limite, significa que chegamos ao fim
        if (leads.length < limit || allLeads.length >= 5000) { // Limitador de segurança em 5k para evitar timeout extremo
          hasMore = false;
        } else {
          page++;
        }
      }
      return { leads: allLeads, total: allLeads.length };
    };

    const crmPromise = fetchAllCRMLeads();

    // 2. Meta Ads - Campanhas
    const metaCampPromise = axios.get(`https://graph.facebook.com/v18.0/${META_ACT_ID}/insights`, {
      params: {
        level: 'campaign',
        fields: 'campaign_name,spend,impressions,clicks,actions,date_start,date_stop',
        date_preset: 'maximum',
        limit: 100,
        access_token: META_TOKEN
      }
    });

    // 3. Meta Ads - Demográficos (Gênero/Idade)
    const metaDemoPromise = axios.get(`https://graph.facebook.com/v18.0/${META_ACT_ID}/insights`, {
      params: {
        level: 'account',
        fields: 'clicks,impressions,spend',
        breakdowns: 'gender,age',
        date_preset: 'maximum',
        access_token: META_TOKEN
      }
    });

    // 4. Meta Ads - Região
    const metaRegionPromise = axios.get(`https://graph.facebook.com/v18.0/${META_ACT_ID}/insights`, {
      params: {
        level: 'account',
        fields: 'clicks,impressions,spend',
        breakdowns: 'region',
        date_preset: 'maximum',
        access_token: META_TOKEN
      }
    });

    // 5. Meta Ads - Global Insights (Account Level)
    const metaGlobalPromise = axios.get(`https://graph.facebook.com/v18.0/${META_ACT_ID}/insights`, {
      params: {
        level: 'account',
        fields: 'spend,impressions,clicks,cpc,cpm,ctr,actions',
        date_preset: 'maximum',
        access_token: META_TOKEN
      }
    });

    const results = await Promise.allSettled([
      crmPromise, metaCampPromise, metaDemoPromise, metaRegionPromise, metaGlobalPromise
    ]);

    // crmPromise agora retorna o objeto de dados diretamente, não o objeto Axios
    const crmData = results[0].status === 'fulfilled' ? results[0].value : { leads: [] };
    const metaCampRes = results[1].status === 'fulfilled' ? results[1].value : { data: { data: [] } };
    const metaDemoRes = results[2].status === 'fulfilled' ? results[2].value : { data: { data: [] } };
    const metaRegionRes = results[3].status === 'fulfilled' ? results[3].value : { data: { data: [] } };
    const metaGlobalRes = results[4].status === 'fulfilled' ? results[4].value : { data: { data: [] } };

    if (results.some(r => r.status === 'rejected')) {
        console.warn("Algumas APIs falharam:", results.filter(r => r.status === 'rejected').map(r => r.reason.message));
    }

    const fullData = {
      leads: crmData,
      meta: {
        campaigns: metaCampRes.data.data || [],
        demographics: metaDemoRes.data.data || [],
        regions: metaRegionRes.data.data || [],
        global: metaGlobalRes.data.data ? metaGlobalRes.data.data[0] : null
      },
      updatedAt: new Date().toISOString()
    };

    // Salvar no Banco de Dados (Redis) por 1 hora (3600 segundos)
    await kv.set('dashboard_data', fullData, { ex: 3600 });

    res.status(200).json(fullData);
  } catch (error) {
    console.error("Erro ao sincronizar dados:", error.response ? error.response.data : error.message);
    res.status(500).json({ error: "Erro na sincronização", details: error.message });
  }
};
