import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';
import axios from 'axios';

// Helper isSale idêntico ao do frontend
function isSale(lead: any): boolean {
  if (!lead.situacao?.nome) return false;
  const s = lead.situacao.nome.toLowerCase().trim();
  return (
    s === 'venda realizada' ||
    s.includes('negócio ganho') ||
    s.includes('negocio ganho') ||
    s.includes('vendid') ||
    s.includes('venda real')
  );
}

export async function GET(request: NextRequest) {
  try {
    await ensureSchema();
    
    // 1. Conta registros no Postgres
    const [countRow] = await sql`SELECT COUNT(*) AS count FROM leads`;
    const pgCount = parseInt(countRow?.count ?? '0', 10);
    
    // 2. Busca leads ao vivo do CV CRM
    const email = process.env.CV_CRM_EMAIL;
    const token = process.env.CV_CRM_TOKEN;
    if (!email || !token) {
      return NextResponse.json({ error: 'Faltam credenciais do CV CRM no backend' });
    }
    
    const headers = { email, token, Accept: 'application/json' };
    const base = 'https://longviewempreendimentos.cvcrm.com.br/api/v1/comercial/leads';
    
    // Busca até 500 leads para garantir que pegamos as vendas
    const res = await axios.get(base, { params: { limit: 500 }, headers, timeout: 15000 });
    const leads = res.data?.leads || [];
    
    const sales = leads.filter(isSale);
    
    const salesReport = sales.map((l: any) => ({
      idlead: l.idlead,
      nome: l.nome,
      situacao: l.situacao?.nome,
      data_cad: l.data_cad,
      data_venda: l.data_venda,
      has_data_venda: l.data_venda != null && l.data_venda !== '',
      valor_venda: l.valor_venda,
      valor_negocio: l.valor_negocio,
      qtde_reservas: l.qtde_reservas_associadas
    }));
    
    return NextResponse.json({
      postgresCount: pgCount,
      totalLeadsLiveFetched: leads.length,
      totalSalesFound: sales.length,
      salesReport
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
