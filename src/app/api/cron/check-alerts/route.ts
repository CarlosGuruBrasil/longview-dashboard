/**
 * GET /api/cron/check-alerts
 *
 * Cron job que:
 *  1. Lê leads do Postgres
 *  2. Lê metaData do project_state
 *  3. Avalia alertas via evaluateAlerts()
 *  4. Armazena resultado em project_state['current_alerts']
 *  5. Envia push FCM para alertas novos/reaparecidos (dedup: 4h por alerta)
 *
 * Autenticação: Bearer CRON_SECRET
 * Coolify: configure para rodar a cada 30–60 min
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';
import { evaluateAlerts } from '@/app/marketing-vision/utils/alerts';
import type { Lead } from '@/app/marketing-vision/types';

// Intervalo mínimo entre notificações do mesmo alerta (ms)
const DEDUP_MS = 4 * 60 * 60 * 1000; // 4 horas
// Máximo de notificações push por execução
const MAX_PUSH_PER_RUN = 5;

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('Authorization') ?? req.headers.get('authorization') ?? '';
  return auth === `Bearer ${secret}`;
}

interface NotifiedRecord {
  [alertId: string]: string; // ISO datetime da última notificação
}

interface StoredAlerts {
  alerts: ReturnType<typeof evaluateAlerts>;
  updatedAt: string;
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  await ensureSchema();

  // ── 1. Carrega leads ────────────────────────────────────────────────────────
  let leads: Lead[] = [];
  try {
    const rows = await sql`SELECT raw FROM leads` as { raw: unknown }[];
    leads = rows.map(r => {
      const raw = r.raw;
      if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return null; }
      }
      return raw as Lead;
    }).filter(Boolean) as Lead[];
  } catch (e) {
    console.error('[check-alerts] erro ao ler leads:', e);
  }

  // ── 2. Carrega metaData ─────────────────────────────────────────────────────
  let metaData = null;
  try {
    const [row] = await sql`SELECT data FROM project_state WHERE key = 'meta_cache'` as { data: unknown }[];
    if (row?.data) {
      const d = row.data as Record<string, unknown>;
      metaData = (d.data ?? d) as NonNullable<typeof metaData>;
    }
  } catch (e) {
    console.error('[check-alerts] erro ao ler meta_cache:', e);
  }

  // ── 3. Avalia alertas ───────────────────────────────────────────────────────
  const alerts = evaluateAlerts(leads, metaData);

  // ── 4. Salva alertas no project_state ──────────────────────────────────────
  const stored: StoredAlerts = { alerts, updatedAt: new Date().toISOString() };
  await sql`
    INSERT INTO project_state (key, data)
    VALUES ('current_alerts', ${JSON.stringify(stored)})
    ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data
  `;

  // ── 5. Push FCM com dedup ───────────────────────────────────────────────────
  let notified: NotifiedRecord = {};
  try {
    const [notifRow] = await sql`SELECT data FROM project_state WHERE key = 'alert_notified'` as { data: unknown }[];
    if (notifRow?.data) notified = notifRow.data as NotifiedRecord;
  } catch { /* primeira execução — registro não existe */ }

  const now = Date.now();
  const toNotify = alerts.filter(alert => {
    if (alert.severity === 'info') return false;
    const lastSent = notified[alert.id];
    if (!lastSent) return true; // nunca notificado
    return now - new Date(lastSent).getTime() > DEDUP_MS;
  }).slice(0, MAX_PUSH_PER_RUN);

  let pushSent = 0;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? '';

  for (const alert of toNotify) {
    try {
      const res = await fetch(`${baseUrl}/api/notifications/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        },
        body: JSON.stringify({
          title: alert.title,
          body: alert.suggestion,
          roles: ['admin', 'gestor'],
          data: {
            alertId: alert.id,
            category: alert.category,
            severity: alert.severity,
            click_action: '/marketing-vision',
          },
        }),
      });
      if (res.ok) {
        notified[alert.id] = new Date().toISOString();
        pushSent++;
      }
    } catch (e) {
      console.error(`[check-alerts] falha ao enviar push para ${alert.id}:`, e);
    }
  }

  // Persiste registro de notificações enviadas
  if (toNotify.length > 0) {
    await sql`
      INSERT INTO project_state (key, data)
      VALUES ('alert_notified', ${JSON.stringify(notified)})
      ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data
    `;
  }

  const counts = {
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
  };

  console.log(`[check-alerts] ${counts.critical} críticos, ${counts.warning} avisos → ${pushSent} push enviados`);

  return NextResponse.json({
    ok: true,
    alerts: counts,
    pushSent,
    leads: leads.length,
    hasMeta: metaData !== null,
  });
}
