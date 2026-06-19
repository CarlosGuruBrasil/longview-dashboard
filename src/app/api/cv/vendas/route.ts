import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-longview-key';
const CACHE_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4h

async function verifyAuth(): Promise<any | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch { return null; }
}

async function readVendasFromCache(): Promise<any[] | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();
    const rows = await sql`SELECT data FROM project_state WHERE key = 'cvdw_vendas_cache' LIMIT 1`;
    if (!rows[0]) return null;
    const d = rows[0].data as any;
    if (d?.updatedAt && Date.now() - new Date(d.updatedAt).getTime() > CACHE_MAX_AGE_MS) return null;
    return d?.vendas ?? null;
  } catch { return null; }
}

async function fetchAllCvdwVendas(): Promise<any[]> {
  const email = process.env.CV_CRM_EMAIL!;
  const token = process.env.CV_CRM_TOKEN!;
  const headers = { email, token, Accept: 'application/json' };
  const base = 'https://longviewempreendimentos.cvcrm.com.br/api/v1/cvdw/vendas';

  try {
    // Primeira chamada para obter total de páginas
    const first = await axios.get(base, {
      params: { pagina: 1, registros_por_pagina: 500 },
      headers,
      timeout: 15000,
    });

    const totalPaginas = first.data?.total_de_paginas ?? 1;
    const allVendas = [...(first.data?.dados ?? [])];

    if (totalPaginas > 1) {
      const pages = Array.from({ length: totalPaginas - 1 }, (_, i) => i + 2);
      const results = await Promise.allSettled(
        pages.map(p =>
          axios.get(base, {
            params: { pagina: p, registros_por_pagina: 500 },
            headers,
            timeout: 15000,
          })
        )
      );
      results.forEach((r: any) => {
        if (r.status === 'fulfilled') {
          allVendas.push(...(r.value.data?.dados ?? []));
        }
      });
    }

    return allVendas;
  } catch (err: any) {
    console.warn('[/api/cv/vendas] Erro ao buscar CVDW vendas:', err.message);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const authUser = await verifyAuth();
  if (!authUser) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Tenta cache primeiro
  if (!forceRefresh) {
    const cached = await readVendasFromCache();
    if (cached) {
      return NextResponse.json({ vendas: cached, total: cached.length, _cached: true });
    }
  }

  // Busca ao vivo
  const vendas = await fetchAllCvdwVendas();

  // Salva no cache em background
  if (vendas.length > 0 && process.env.DATABASE_URL) {
    import('@/lib/pg').then(({ sql }) =>
      sql`INSERT INTO project_state (key, data)
          VALUES ('cvdw_vendas_cache', ${JSON.stringify({ vendas, updatedAt: new Date().toISOString() })})
          ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data`.catch(() => {})
    );
  }

  return NextResponse.json({ vendas, total: vendas.length, _cached: false });
}
