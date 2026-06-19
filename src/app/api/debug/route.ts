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
    
    // Busca todos os leads do Postgres
    const rows = await sql`SELECT raw FROM leads`;
    const leads = rows.map((r: any) => typeof r.raw === 'object' ? r.raw : JSON.parse(r.raw));
    
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
      postgresTotalCount: leads.length,
      totalSalesFoundInDb: sales.length,
      salesWithDataVendaCount: sales.filter(s => s.data_venda != null && s.data_venda !== '').length,
      salesReport
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
