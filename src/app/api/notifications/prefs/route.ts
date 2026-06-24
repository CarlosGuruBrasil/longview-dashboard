/**
 * GET  /api/notifications/prefs  — lê preferências do usuário logado
 * POST /api/notifications/prefs  — salva preferências do usuário logado
 *
 * Preferências ficam em project_state['notif_prefs']:
 *   { [userEmail]: { emergencial, critica, nova_tarefa, projeto_parado } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { sql, ensureSchema } from '@/lib/pg';
import type { UserNotifPrefs } from '@/app/api/cron/check-tasks/route';

const STATE_KEY = 'notif_prefs';

const DEFAULT_PREFS: UserNotifPrefs = {
  emergencial:    true,
  critica:        true,
  nova_tarefa:    true,
  projeto_parado: true,
};

async function readAllPrefs(): Promise<Record<string, UserNotifPrefs>> {
  const [row] = await sql`SELECT data FROM project_state WHERE key = ${STATE_KEY}` as { data: unknown }[];
  if (!row?.data) return {};
  return row.data as Record<string, UserNotifPrefs>;
}

async function writeAllPrefs(prefs: Record<string, UserNotifPrefs>): Promise<void> {
  await sql`
    INSERT INTO project_state (key, data)
    VALUES (${STATE_KEY}, ${JSON.stringify(prefs)})
    ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data
  `;
}

export async function GET(_req: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  await ensureSchema();
  const all = await readAllPrefs();
  const prefs = { ...DEFAULT_PREFS, ...(all[user.email.toLowerCase()] ?? {}) };

  return NextResponse.json({ prefs });
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  await ensureSchema();

  const body = await req.json().catch(() => ({}));
  const patch: Partial<UserNotifPrefs> = {};

  // Valida e extrai apenas as chaves conhecidas
  const keys: (keyof UserNotifPrefs)[] = ['emergencial', 'critica', 'nova_tarefa', 'projeto_parado'];
  for (const k of keys) {
    if (typeof body[k] === 'boolean') patch[k] = body[k];
  }

  const all  = await readAllPrefs();
  const prev = { ...DEFAULT_PREFS, ...(all[user.email.toLowerCase()] ?? {}) };
  all[user.email.toLowerCase()] = { ...prev, ...patch };

  await writeAllPrefs(all);

  return NextResponse.json({ ok: true, prefs: all[user.email.toLowerCase()] });
}
