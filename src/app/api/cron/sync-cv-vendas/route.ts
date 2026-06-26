import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { sql, ensureSchema } from '@/lib/pg';
import { isCronAuthorized, unauthorizedJson } from '@/lib/internal-auth';

export const maxDuration = 300;
export const runtime = 'nodejs';

async function fetchAllCvdwVendas(): Promise<any[]> {
  const email = process.env.CV_CRM_EMAIL!;
  const token = process.env.CV_CRM_TOKEN!;
  const headers = { email, token, Accept: 'application/json' };
  const base = 'https://longviewempreendimentos.cvcrm.com.br/api/v1/cvdw/vendas';

  try {
    const first = await axios.get(base, { params: { pagina: 1, registros_por_pagina: 500 }, headers, timeout: 15000 });
    const totalPaginas = first.data?.total_de_paginas ?? 1;
    const allVendas = [...(first.data?.dados ?? [])];

    if (totalPaginas > 1) {
      const pages = Array.from({ length: totalPaginas - 1 }, (_, i) => i + 2);
      const results = await Promise.allSettled(
        pages.map(p => axios.get(base, { params: { pagina: p, registros_por_pagina: 500 }, headers, timeout: 15000 }))
      );
      results.forEach((r: any) => {
        if (r.status === 'fulfilled') allVendas.push(...(r.value.data?.dados ?? []));
      });
    }
    return allVendas;
  } catch (err: any) {
    console.error('[/cron/sync-cv-vendas] Erro ao buscar CVDW vendas:', err.message);
    return [];
  }
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) return unauthorizedJson();

  await ensureSchema();
  
  const vendas = await fetchAllCvdwVendas();
  let upserted = 0;

  if (vendas.length > 0) {
    for (const v of vendas) {
      if (!v.idvenda) continue;
      const dVenda = v.data_venda ? new Date(v.data_venda) : null;
      const valor = v.valor_venda ? parseFloat(v.valor_venda) : null;

      await sql`
        INSERT INTO cv_vendas (
          id, id_empreendimento, id_unidade, valor, data_venda, status, raw, synced_at
        ) VALUES (
          ${v.idvenda},
          ${v.idempreendimento ?? null},
          ${v.idunidade ?? null},
          ${valor},
          ${dVenda},
          ${v.situacao ?? null},
          ${JSON.stringify(v)},
          NOW()
        ) ON CONFLICT (id) DO UPDATE SET
          id_empreendimento = EXCLUDED.id_empreendimento,
          id_unidade = EXCLUDED.id_unidade,
          valor = EXCLUDED.valor,
          data_venda = EXCLUDED.data_venda,
          status = EXCLUDED.status,
          raw = EXCLUDED.raw,
          synced_at = EXCLUDED.synced_at
      `;
      upserted++;
    }
  }

  return NextResponse.json({ ok: true, message: 'Vendas sincronizadas', count: upserted });
}
