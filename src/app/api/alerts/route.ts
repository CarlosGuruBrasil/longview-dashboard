/**
 * GET /api/alerts
 *
 * Retorna os alertas mais recentes avaliados pelo cron check-alerts.
 * Se o cron ainda não rodou, avalia em tempo real com dados disponíveis.
 *
 * Autenticação: requer sessão válida.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { sql, ensureSchema } from '@/lib/pg';
import logger from '@/lib/logger'

export async function GET(_req: NextRequest) {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  await ensureSchema();

  try {
    const [row] = await sql`
      SELECT data FROM project_state WHERE key = 'current_alerts'
    ` as { data: unknown }[];

    if (!row?.data) {
      return NextResponse.json({ alerts: [], updatedAt: null, source: 'empty' });
    }

    const stored = row.data as { alerts: unknown[]; updatedAt: string };

    return NextResponse.json({
      alerts: stored.alerts ?? [],
      updatedAt: stored.updatedAt ?? null,
      source: 'cache',
    });
  } catch (e) {
    logger.error({ e }, '[api/alerts] erro:');
    return NextResponse.json({ alerts: [], updatedAt: null, source: 'error' });
  }
}
