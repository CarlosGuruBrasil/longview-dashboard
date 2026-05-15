const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const incomingLead = req.body;
    console.log("Recebido Webhook do CRM para o Lead:", incomingLead.id || incomingLead.id_lead);

    // 1. Buscar os dados atuais do cache
    const cachedData = await kv.get('dashboard_data');
    
    if (!cachedData) {
      console.log("Banco de dados ainda vazio. Ignorando webhook por enquanto.");
      return res.status(200).json({ status: 'ignored', message: 'DB is empty, first sync needed' });
    }

    // 2. Localizar e atualizar o lead na lista
    let leads = cachedData.leads.leads || [];
    const leadId = incomingLead.id || incomingLead.id_lead;
    
    const index = leads.findIndex(l => (l.id || l.id_lead) == leadId);

    if (index !== -1) {
      // Atualiza lead existente
      leads[index] = { ...leads[index], ...incomingLead };
      console.log("Lead atualizado no banco via Webhook.");
    } else {
      // Adiciona novo lead no início
      leads.unshift(incomingLead);
      console.log("Novo lead adicionado ao banco via Webhook.");
    }

    // 3. Salvar de volta no Redis
    cachedData.leads.leads = leads;
    cachedData.updatedAt = new Date().toISOString();
    
    await kv.set('dashboard_data', cachedData);

    return res.status(200).json({ status: 'success', message: 'Data updated' });
  } catch (error) {
    console.error("Erro no Webhook:", error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
