import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { readKv } from '@/lib/db-kv';
import type { PresenceEntry } from '../heartbeat/route';

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutos

/** GET /api/user/presence — retorna usuários ativos nos últimos 5 min */
export async function GET() {
  const auth = await verifyAuth();
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const store = await readKv<Record<string, PresenceEntry>>('user_presence', {});
  const now   = Date.now();

  const online = Object.values(store).filter(
    e => now - new Date(e.lastSeen).getTime() < ONLINE_THRESHOLD_MS
  );

  return NextResponse.json({ online, count: online.length });
}
