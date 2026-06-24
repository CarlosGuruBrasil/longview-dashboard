/**
 * GET /api/cron/notify-responsibles
 *
 * Sistema inteligente de roteamento: detecta leads que precisam de ação e
 * notifica o RESPONSÁVEL direto (corretor dono + gestor da equipe), não só
 * a gestão genérica.
 *
 * Monitora:
 *   1. Lead parado — em etapa ativa sem atividade há STUCK_DAYS dias
 *   2. Sem atendimento — "aguardando atendimento" há > WAITING_H horas
 *   3. Lead quente esfriando — score >= HOT_SCORE sem atividade há HOT_DAYS dias
 *
 * Notifica corretor.email E gestor.email (ambos). Dedup por responsável (12h).
 * Auth: Bearer CRON_SECRET.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';
import { sendFCMMulticast } from '@/lib/firebase-admin';
import { parseCrmDate } from '@/lib/dateUtils';
import { isSale, isLoss } from '@/app/marketing-vision/utils/leads';
import type { Lead } from '@/app/marketing-vision/types';

const STUCK_DAYS = 5;     // etapa ativa sem atividade
const WAITING_H  = 48;    // aguardando atendimento
const HOT_SCORE  = 75;    // score de lead quente
const HOT_DAYS   = 3;     // quente sem atividade
const DEDUP_MS   = 12 * 60 * 60 * 1000;
const MAX_LEADS_IN_BODY = 5;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization') ?? '';
  return auth === `Bearer ${secret}`;
}

function lastActivity(lead: Lead): Date | null {
  const candidates = [
    lead.ultima_data_conversao,
    ...(lead.interacao ?? []).map(i => i.data_cad),
    lead.data_atualizacao,
    lead.data_cad, lead.data_cadastro, lead.data_cadastramento,
  ];
  let max: Date | null = null;
  for (const c of candidates) {
    const d = parseCrmDate(c);
    if (d && (!max || d > max)) max = d;
  }
  return max;
}

type Issue = { lead: string; label: string; days: number; severity: number };

/** Avalia se o lead precisa de ação. Retorna a issue mais relevante ou null. */
function evalLead(lead: Lead, now: number): Issue | null {
  if (isSale(lead) || isLoss(lead)) return null;
  const nome = lead.nome || 'Lead';
  const stage = (lead.situacao?.nome || '').toLowerCase();
  const act = lastActivity(lead);
  const days = act ? Math.floor((now - act.getTime()) / 86_400_000) : 999;

  // 1. Sem atendimento (mais urgente)
  if (stage.includes('aguardando atendimento')) {
    const cad = parseCrmDate(lead.data_cad || lead.data_cadastro);
    const h = cad ? (now - cad.getTime()) / 3_600_000 : 999;
    if (h >= WAITING_H) return { lead: nome, label: `sem atendimento há ${Math.floor(h / 24)}d`, days: Math.floor(h / 24), severity: 3 };
  }
  // 2. Quente esfriando
  const score = Number(lead.score ?? 0);
  if (score >= HOT_SCORE && days >= HOT_DAYS) {
    return { lead: nome, label: `quente esfriando (${days}d sem contato)`, days, severity: 2 };
  }
  // 3. Parado na etapa
  if (days >= STUCK_DAYS) {
    return { lead: nome, label: `parado há ${days}d em "${lead.situacao?.nome || '?'}"`, days, severity: 1 };
  }
  return null;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  await ensureSchema();

  // Carrega leads
  const rows = await sql`SELECT raw FROM leads` as { raw: unknown }[];
  const leads = rows.map(r => (typeof r.raw === 'string' ? JSON.parse(r.raw) : r.raw) as Lead);
  const now = Date.now();

  // Agrupa issues por email do responsável (corretor + gestor)
  const byEmail = new Map<string, { nome: string; issues: Issue[] }>();
  const add = (email?: string, nome?: string, issue?: Issue) => {
    if (!email || !issue) return;
    const k = email.toLowerCase().trim();
    if (!k) return;
    const e = byEmail.get(k) ?? { nome: nome || k, issues: [] };
    e.issues.push(issue);
    byEmail.set(k, e);
  };

  let leadsComIssue = 0;
  for (const lead of leads) {
    const issue = evalLead(lead, now);
    if (!issue) continue;
    leadsComIssue++;
    add(lead.corretor?.email, lead.corretor?.nome, issue);
    add(lead.gestor?.email, lead.gestor?.nome, issue);
  }

  // Tokens por email
  const tokenRows = await sql`SELECT user_email, token FROM fcm_tokens` as { user_email: string; token: string }[];
  const tokensByEmail = new Map<string, string[]>();
  for (const t of tokenRows) {
    const k = (t.user_email || '').toLowerCase().trim();
    if (!k) continue;
    tokensByEmail.set(k, [...(tokensByEmail.get(k) ?? []), t.token]);
  }

  // Dedup
  let notified: Record<string, string> = {};
  try {
    const [row] = await sql`SELECT data FROM project_state WHERE key = 'responsible_notified'` as { data: unknown }[];
    if (row?.data) notified = row.data as Record<string, string>;
  } catch { /* primeira execução */ }

  let pushSent = 0, semToken = 0;
  for (const [email, { issues }] of byEmail) {
    const last = notified[email];
    if (last && now - new Date(last).getTime() < DEDUP_MS) continue;
    const tokens = tokensByEmail.get(email);
    if (!tokens?.length) { semToken++; continue; }

    issues.sort((a, b) => b.severity - a.severity || b.days - a.days);
    const top = issues.slice(0, MAX_LEADS_IN_BODY).map(i => `• ${i.lead}: ${i.label}`).join('\n');
    const extra = issues.length > MAX_LEADS_IN_BODY ? `\n+${issues.length - MAX_LEADS_IN_BODY} outros` : '';

    const res = await sendFCMMulticast(
      tokens,
      `⚠️ ${issues.length} lead${issues.length > 1 ? 's' : ''} precisam de atenção`,
      top + extra,
      { type: 'responsavel', url: '/marketing-vision', count: String(issues.length) }
    );
    if (res.successCount > 0) {
      notified[email] = new Date().toISOString();
      pushSent++;
    }
    if (res.invalidTokens?.length) {
      await sql`DELETE FROM fcm_tokens WHERE token = ANY(${res.invalidTokens}::text[])`;
    }
  }

  await sql`
    INSERT INTO project_state (key, data) VALUES ('responsible_notified', ${JSON.stringify(notified)})
    ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data
  `;

  return NextResponse.json({
    ok: true,
    leadsComIssue,
    responsaveis: byEmail.size,
    pushSent,
    semToken,
  });
}
