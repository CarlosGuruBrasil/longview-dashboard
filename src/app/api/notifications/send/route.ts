import { NextRequest, NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';
import { sendFCMMulticast } from '@/lib/firebase-admin';

// POST /api/notifications/send — envia notificação por role ou user_id
// Protegido por CRON_SECRET (uso interno)
export async function POST(request: NextRequest) {
  const secret = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { title, body, roles, userIds, emails, data } = await request.json();
  if (!title || !body) return NextResponse.json({ error: 'title e body obrigatórios' }, { status: 400 });

  await ensureSchema();

  // Busca tokens pelos critérios
  let tokens: { token: string }[] = [];

  if (emails?.length) {
    const lower = (emails as string[]).map(e => e.toLowerCase().trim());
    tokens = await sql<{ token: string }[]>`
      SELECT token FROM fcm_tokens WHERE LOWER(user_email) = ANY(${lower}::text[])
    `;
  } else if (userIds?.length) {
    tokens = await sql<{ token: string }[]>`
      SELECT token FROM fcm_tokens WHERE user_id = ANY(${userIds}::text[])
    `;
  } else if (roles?.length) {
    tokens = await sql<{ token: string }[]>`
      SELECT token FROM fcm_tokens WHERE user_role = ANY(${roles}::text[])
    `;
  } else {
    // Sem filtro = envia para todos
    tokens = await sql<{ token: string }[]>`SELECT token FROM fcm_tokens`;
  }

  if (!tokens.length) return NextResponse.json({ ok: true, sent: 0 });

  const result = await sendFCMMulticast(
    tokens.map(t => t.token),
    title,
    body,
    data
  );

  // Remove tokens inválidos do banco
  if (result?.invalidTokens?.length) {
    await sql`DELETE FROM fcm_tokens WHERE token = ANY(${result.invalidTokens}::text[])`;
  }

  return NextResponse.json({ ok: true, sent: result?.successCount ?? 0, failed: result?.failureCount ?? 0 });
}
