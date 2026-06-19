import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';

export async function GET(request: NextRequest) {
  try {
    await ensureSchema();
    
    // Consulta todos os leads com status de Venda decodificando do JSON
    const rows = await sql`
      SELECT id, nome, raw->'situacao'->>'nome' as status_nome, raw->>'data_venda' as data_venda, raw->>'valor_venda' as valor_venda, raw->>'valor_negocio' as valor_negocio
      FROM leads 
      WHERE raw->'situacao'->>'nome' ILIKE '%venda%' OR raw->'situacao'->>'nome' ILIKE '%ganho%'
    `;
    
    const sample = rows.slice(0, 10).map((r: any) => ({
      id: r.id,
      nome: r.nome,
      status: r.status_nome,
      data_venda: r.data_venda,
      valor_venda: r.valor_venda,
      valor_negocio: r.valor_negocio
    }));
    
    return NextResponse.json({
      totalSalesInDb: rows.length,
      sampleSales: sample,
      allKeysPresent: rows.length > 0 ? Object.keys(rows[0]) : []
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
