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
    
    // 1. Agrupa e conta por raw->'situacao'->>'nome' no Postgres
    const rawSituacoes = await sql`
      SELECT raw->'situacao'->>'nome' as situacao_nome, COUNT(*) as qtd
      FROM leads
      GROUP BY raw->'situacao'->>'nome'
      ORDER BY qtd DESC
    `;
    
    // 2. Agrupa e conta pela coluna 'status' no Postgres
    const colStatus = await sql`
      SELECT status, COUNT(*) as qtd
      FROM leads
      GROUP BY status
      ORDER BY qtd DESC
    `;
    
    // 3. Mostra uma amostra de 3 leads quaisquer do Postgres
    const sampleLeads = await sql`
      SELECT id, nome, status, raw->'situacao' as situacao_raw, raw->>'data_venda' as data_venda, raw->>'valor_venda' as valor_venda
      FROM leads
      LIMIT 3
    `;
    
    return NextResponse.json({
      postgresCount: sampleLeads.length > 0 ? (await sql`SELECT COUNT(*) AS count FROM leads`)[0].count : 0,
      rawSituacoesCount: rawSituacoes,
      colStatusCount: colStatus,
      sampleLeads
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
