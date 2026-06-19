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
    
    // Busca a linha inteira do primeiro lead do Postgres
    const rows = await sql`
      SELECT id, nome, status, raw
      FROM leads
      LIMIT 1
    `;
    
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Nenhum lead encontrado no Postgres de produção' });
    }
    
    const lead = rows[0];
    const rawObj = typeof lead.raw === 'string' ? JSON.parse(lead.raw) : lead.raw;
    
    return NextResponse.json({
      id: lead.id,
      nome: lead.nome,
      statusColumn: lead.status,
      rawKeys: Object.keys(rawObj || {}),
      rawSample: rawObj
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
