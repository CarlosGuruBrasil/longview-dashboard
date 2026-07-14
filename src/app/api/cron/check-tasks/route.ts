/**
 * GET /api/cron/check-tasks — Project Vision push notifications
 *
 * Regras:
 *  1. Tarefa Emergencial aberta            → push para responsável (dedup 4h)
 *  2. Tarefa Crítica vencida ou < 24h      → push para responsável + secundários (dedup 4h)
 *  3. Nova tarefa atribuída ao responsável  → push único (dedup 365d = uma vez)
 *  4. Projeto sem atualização há 7 dias    → push para Diretoria + Gestor (dedup 24h)
 *
 * Anti-spam:
 *  - Silêncio noturno: 22h–8h (BRT = UTC-3) para todas as regras
 *  - Dedup por alert ID armazenado em project_state['task_notified']
 *  - Respeita preferências do usuário em project_state['notif_prefs']
 *
 * Autenticação: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';
import { sendFCMMulticast } from '@/lib/firebase-admin';
import { readTasks, readProjects, readResponsibles } from '@/lib/db-kv';
import type { Task } from '@/lib/db-kv';
import logger from '@/lib/logger'

// ─── Constantes ───────────────────────────────────────────────────────────────
const DEDUP_TASK_MS  = 4  * 60 * 60 * 1000;  // 4h — regras 1, 2, 3
const DEDUP_PROJ_MS  = 24 * 60 * 60 * 1000;  // 24h — regra 4
const DEDUP_NOVA_MS  = 365 * 24 * 60 * 60 * 1000; // 365d — tarefa nova (única vez)
const STALL_DAYS     = 7;
const NEAR_DL_HOURS  = 24;
const MAX_PUSH_TOTAL = 15;

// ─── Helpers de tempo ─────────────────────────────────────────────────────────

/** Verifica se é horário noturno no Brasil (22h–8h, BRT = UTC-3) */
function isNightBRT(): boolean {
  const brtHour = new Date(Date.now() - 3 * 3600000).getUTCHours();
  return brtHour < 8 || brtHour >= 22;
}

function isPastDue(d: string | undefined): boolean {
  if (!d) return false;
  return new Date(d) < new Date();
}

function isNearDeadline(d: string | undefined, hours = NEAR_DL_HOURS): boolean {
  if (!d) return false;
  const target = new Date(d);
  const cutoff  = new Date(Date.now() + hours * 3600000);
  return target > new Date() && target <= cutoff;
}

/** Retorna a data do log mais recente de uma tarefa, ou null */
function latestLogDate(task: Task): Date | null {
  if (!task.logs?.length) return null;
  const dates = task.logs
    .map(l => new Date(l.date))
    .filter(d => !isNaN(d.getTime()));
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map(d => d.getTime())));
}

/** Retorna quantos dias uma tarefa está sem atualização de log */
function taskStaleDays(task: Task): number {
  const ref = latestLogDate(task) ?? (task.inicio ? new Date(task.inicio) : null);
  if (!ref) return 0;
  return (Date.now() - ref.getTime()) / 86400000;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('Authorization') ?? req.headers.get('authorization') ?? '';
  return auth === `Bearer ${secret}`;
}

// ─── Preferências de notificação ─────────────────────────────────────────────

export type NotifPrefKey = 'emergencial' | 'critica' | 'nova_tarefa' | 'projeto_parado';

export interface UserNotifPrefs {
  emergencial:     boolean;
  critica:         boolean;
  nova_tarefa:     boolean;
  projeto_parado:  boolean;
}

const DEFAULT_PREFS: UserNotifPrefs = {
  emergencial:    true,
  critica:        true,
  nova_tarefa:    true,
  projeto_parado: true,
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  await ensureSchema();

  // ── Silêncio noturno ───────────────────────────────────────────────────────
  if (isNightBRT()) {
    return NextResponse.json({ ok: true, skipped: 'horário noturno BRT' });
  }

  // ── Carrega dados ──────────────────────────────────────────────────────────
  let tasks: Task[], projects: Awaited<ReturnType<typeof readProjects>>, responsibles: Awaited<ReturnType<typeof readResponsibles>>;
  try {
    [tasks, projects, responsibles] = await Promise.all([readTasks(), readProjects(), readResponsibles()]);
  } catch (e) {
    logger.error({ e }, '[check-tasks] erro ao ler DB:');
    return NextResponse.json({ error: 'Falha ao ler dados' }, { status: 500 });
  }

  // ── FCM tokens do Postgres ─────────────────────────────────────────────────
  const fcmRows = await sql`
    SELECT user_email, user_role, token FROM fcm_tokens
  ` as { user_email: string; user_role: string; token: string }[];

  // email → tokens[]
  const tokensByEmail = new Map<string, string[]>();
  // role → tokens[]
  const tokensByRole  = new Map<string, string[]>();

  for (const row of fcmRows) {
    const e = (row.user_email ?? '').toLowerCase();
    const r = row.user_role ?? '';
    if (e) {
      if (!tokensByEmail.has(e)) tokensByEmail.set(e, []);
      tokensByEmail.get(e)!.push(row.token);
    }
    if (r) {
      if (!tokensByRole.has(r)) tokensByRole.set(r, []);
      tokensByRole.get(r)!.push(row.token);
    }
  }

  // ── Preferências de notificação por usuário ────────────────────────────────
  // { [userEmail]: UserNotifPrefs }
  let prefsByEmail: Record<string, UserNotifPrefs> = {};
  try {
    const [row] = await sql`SELECT data FROM project_state WHERE key = 'notif_prefs'` as { data: unknown }[];
    if (row?.data) prefsByEmail = row.data as Record<string, UserNotifPrefs>;
  } catch { /* sem prefs = usa padrão */ }

  function userPrefs(email: string): UserNotifPrefs {
    return { ...DEFAULT_PREFS, ...(prefsByEmail[email.toLowerCase()] ?? {}) };
  }

  /** Filtra tokens respeitando preferências do usuário */
  function filterByPref(emails: string[], pref: NotifPrefKey): string[] {
    const result: string[] = [];
    for (const email of emails) {
      const e = email.toLowerCase();
      if (!userPrefs(e)[pref]) continue; // usuário desativou este tipo
      const tokens = tokensByEmail.get(e) ?? [];
      result.push(...tokens);
    }
    return [...new Set(result)];
  }

  // ── Mapa nome → email dos responsáveis ─────────────────────────────────────
  const emailByName = new Map<string, string>();
  for (const r of responsibles) {
    if (r.name && r.email) {
      emailByName.set(r.name.toLowerCase().trim(), r.email.toLowerCase().trim());
    }
  }

  function emailsForNames(names: string[]): string[] {
    return names
      .map(n => emailByName.get(n.toLowerCase().trim()))
      .filter((e): e is string => Boolean(e));
  }

  // ── Dedup state ────────────────────────────────────────────────────────────
  let notified: Record<string, string> = {};
  try {
    const [row] = await sql`SELECT data FROM project_state WHERE key = 'task_notified'` as { data: unknown }[];
    if (row?.data) notified = row.data as Record<string, string>;
  } catch { /* primeira execução */ }

  // ── Snapshot de IDs já vistos (para detectar tarefas novas) ───────────────
  let seenIds: Set<string> = new Set();
  let firstRun = false;
  try {
    const [row] = await sql`SELECT data FROM project_state WHERE key = 'task_seen_ids'` as { data: unknown }[];
    if (row?.data) {
      seenIds = new Set((row.data as { ids: string[] }).ids ?? []);
    } else {
      firstRun = true; // sem snapshot = inicializa sem notificar
    }
  } catch { firstRun = true; }

  const now = Date.now();

  function shouldNotify(alertId: string, dedupMs: number): boolean {
    const last = notified[alertId];
    if (!last) return true;
    return now - new Date(last).getTime() > dedupMs;
  }

  // ── Fila de push ──────────────────────────────────────────────────────────

  interface PushJob {
    alertId:  string;
    tokens:   string[];
    title:    string;
    body:     string;
    dedupMs:  number;
    data?:    Record<string, string>;
  }

  const queue: PushJob[] = [];

  function enqueue(job: PushJob) {
    if (!job.tokens.length) return;
    if (!shouldNotify(job.alertId, job.dedupMs)) return;
    queue.push(job);
  }

  // ── REGRA 1: Emergencial ──────────────────────────────────────────────────
  for (const task of tasks) {
    if (task.urgencia !== 'Emergencial') continue;
    if (task.statusAndamento === 'Finalizado') continue;

    const emails = emailsForNames([task.responsible]);
    const tokens = filterByPref(emails, 'emergencial');

    enqueue({
      alertId: `emerg-${task.id}`,
      tokens,
      title: `🚨 EMERGENCIAL: ${task.subject}`,
      body:  `Projeto: ${task.project} — ação imediata necessária`,
      dedupMs: DEDUP_TASK_MS,
      data: { click_action: '/project-vision', taskId: task.id },
    });
  }

  // ── REGRA 2: Crítica vencida ou próxima do prazo ──────────────────────────
  for (const task of tasks) {
    if (task.urgencia !== 'Crítica') continue;
    if (task.statusAndamento === 'Finalizado') continue;
    if (!isPastDue(task.previsaoEntrega) && !isNearDeadline(task.previsaoEntrega)) continue;

    const allNames  = [task.responsible, ...(task.secondaryResponsibles ?? [])];
    const emails    = emailsForNames(allNames);
    const tokens    = filterByPref(emails, 'critica');
    const statusTag = isPastDue(task.previsaoEntrega) ? 'VENCIDA' : 'vence < 24h';

    enqueue({
      alertId: `critica-${task.id}`,
      tokens,
      title: `⚠️ Prazo Crítico [${statusTag}]: ${task.subject}`,
      body:  `${task.project} | Entrega: ${task.previsaoEntrega || 'indefinida'}`,
      dedupMs: DEDUP_TASK_MS,
      data: { click_action: '/project-vision', taskId: task.id },
    });
  }

  // ── REGRA 3: Nova tarefa atribuída ────────────────────────────────────────
  if (!firstRun) {
    for (const task of tasks) {
      if (seenIds.has(task.id)) continue; // já conhecida

      const emails = emailsForNames([task.responsible]);
      const tokens = filterByPref(emails, 'nova_tarefa');

      enqueue({
        alertId: `nova-${task.id}`,
        tokens,
        title: `📋 Nova tarefa: ${task.subject}`,
        body:  `${task.project} | Urgência: ${task.urgencia}`,
        dedupMs: DEDUP_NOVA_MS, // só uma vez
        data: { click_action: '/project-vision', taskId: task.id },
      });
    }
  }

  // ── REGRA 4: Projeto travado (7 dias sem log) ─────────────────────────────
  // Destinatário: Diretoria + Gestor, filtrados por preferência
  const stakeEmails: string[] = [];
  const stakeRoles = ['Diretoria', 'Gestor'];
  for (const role of stakeRoles) {
    // Busca emails dos usuários com essa role que têm tokens
    const roleTokenRows = fcmRows.filter(r => r.user_role === role);
    for (const row of roleTokenRows) {
      if (!stakeEmails.includes(row.user_email)) stakeEmails.push(row.user_email);
    }
  }

  for (const project of projects) {
    const projectTasks = tasks.filter(t => t.projectId === project.id);
    const activeTasks  = projectTasks.filter(t => t.statusAndamento !== 'Finalizado');
    if (!activeTasks.length) continue;

    const maxStale = Math.max(...activeTasks.map(t => taskStaleDays(t)));
    if (maxStale < STALL_DAYS) continue;

    const tokens = filterByPref(stakeEmails, 'projeto_parado');

    enqueue({
      alertId: `stalled-${project.id}`,
      tokens,
      title: `📊 Projeto parado: ${project.name}`,
      body:  `Sem atualizações há ${Math.floor(maxStale)} dias`,
      dedupMs: DEDUP_PROJ_MS,
      data: { click_action: '/project-vision' },
    });
  }

  // ── Envia pushes ──────────────────────────────────────────────────────────
  let sent = 0;
  const invalidTokens: string[] = [];

  for (const job of queue.slice(0, MAX_PUSH_TOTAL)) {
    try {
      const result = await sendFCMMulticast(job.tokens, job.title, job.body, job.data);
      if (result.successCount > 0) {
        notified[job.alertId] = new Date().toISOString();
        sent += result.successCount;
      }
      if (result.invalidTokens?.length) {
        invalidTokens.push(...result.invalidTokens);
      }
    } catch (e) {
      logger.error({ e }, '[check-tasks] push error for $:');
    }
  }

  // ── Limpa tokens inválidos ────────────────────────────────────────────────
  if (invalidTokens.length > 0) {
    await sql`DELETE FROM fcm_tokens WHERE token = ANY(${invalidTokens}::text[])`;
  }

  // ── Persiste dedup ────────────────────────────────────────────────────────
  await sql`
    INSERT INTO project_state (key, data)
    VALUES ('task_notified', ${JSON.stringify(notified)})
    ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data
  `;

  // ── Atualiza snapshot de IDs vistos ──────────────────────────────────────
  const allIds = tasks.map(t => t.id);
  await sql`
    INSERT INTO project_state (key, data)
    VALUES ('task_seen_ids', ${JSON.stringify({ ids: allIds })})
    ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data
  `;

  logger.info(`[check-tasks] fila=$ sent=$ invalid=$`);

  return NextResponse.json({
    ok: true,
    queued: queue.length,
    sent,
    invalidCleaned: invalidTokens.length,
    firstRun,
    skipped: { night: false },
  });
}
