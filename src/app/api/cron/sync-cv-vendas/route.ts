import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/pg';
import { isCronAuthorized, unauthorizedJson } from '@/lib/internal-auth';
import { syncReservas } from '@/lib/cv-sync';
import logger from '@/lib/logger';

export const maxDuration = 300;
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) return unauthorizedJson();

  const email = process.env.CV_CRM_EMAIL;
  const token = process.env.CV_CRM_TOKEN;
  if (!email || !token) {
    return NextResponse.json({ error: 'CV_CRM_EMAIL ou CV_CRM_TOKEN não configurados' }, { status: 503 });
  }

  try {
    await ensureSchema();
    const count = await syncReservas(email, token);
    logger.info(`[cron/sync-cv-vendas] ${count} reservas sincronizadas`);
    return NextResponse.json({ ok: true, message: 'Vendas sincronizadas', count });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error({ msg }, '[cron/sync-cv-vendas]');
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
