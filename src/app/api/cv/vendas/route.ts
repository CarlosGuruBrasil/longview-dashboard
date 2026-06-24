import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { sql, ensureSchema } from '@/lib/pg';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-longview-key';
export const runtime = 'nodejs';
// Cache = 0 because we have a live postgres DB that handles the speed
export const revalidate = 0;

async function verifyAuth(): Promise<any | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const authUser = await verifyAuth();
  if (!authUser) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  try {
    await ensureSchema();
    
    // Buscar direto da tabela cv_vendas
    const rows = await sql`
      SELECT raw 
      FROM cv_vendas 
      ORDER BY data_venda DESC NULLS LAST
    `;
    
    const vendas = rows.map((r: any) => typeof r.raw === 'object' ? r.raw : JSON.parse(r.raw));

    return NextResponse.json({ vendas, total: vendas.length, _cached: false });
  } catch (err: any) {
    console.error('[/api/cv/vendas] Erro ao buscar vendas do postgres:', err.message);
    return NextResponse.json({ error: 'Erro ao buscar vendas', vendas: [], total: 0 }, { status: 500 });
  }
}
