import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { sql, ensureSchema } from '@/lib/pg';
import { syncReservas } from '@/lib/cv-sync';
import logger from '@/lib/logger';

const JWT_SECRET = process.env.JWT_SECRET ?? (() => { throw new Error('[LongView] JWT_SECRET nao configurado. Defina no .env.local') })();
export const runtime = 'nodejs';
export const revalidate = 0;

type AuthUser = { role?: string; email?: string; name?: string };
type VendaRow = { raw: unknown };

async function verifyAuth(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const authUser = await verifyAuth();
  if (!authUser) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('refresh') === 'true';

  try {
    await ensureSchema();

    const email = process.env.CV_CRM_EMAIL;
    const token = process.env.CV_CRM_TOKEN;

    if (email && token) {
      const [freshness] = await sql<{ n: number; age_min: number | null }[]>`
        SELECT COUNT(*)::int AS n,
               EXTRACT(EPOCH FROM (NOW() - MAX(synced_at)))/60 AS age_min
        FROM cv_vendas
      `;
      const stale = !freshness?.n || (freshness.age_min ?? Infinity) > 360;
      if (forceRefresh || stale) {
        await syncReservas(email, token);
      }
    }

    const rows = await sql`SELECT raw FROM cv_vendas ORDER BY data_venda DESC NULLS LAST`;

    const parseItem = (value: unknown): unknown => {
      let current = value;
      while (typeof current === 'string' && (current.trim().startsWith('{') || current.trim().startsWith('['))) {
        try {
          const parsed = JSON.parse(current);
          if (parsed === current) break;
          current = parsed;
        } catch { break; }
      }
      return current;
    };

    const vendas = (rows as unknown as VendaRow[]).map((r) => parseItem(r.raw));
    return NextResponse.json({ vendas, total: vendas.length, _cached: false });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ msg }, '[/api/cv/vendas]');
    return NextResponse.json({ error: 'Erro ao buscar vendas', vendas: [], total: 0 }, { status: 500 });
  }
}
