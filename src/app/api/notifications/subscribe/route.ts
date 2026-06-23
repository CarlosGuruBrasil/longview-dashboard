import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { sql, ensureSchema } from '@/lib/pg';

// POST /api/notifications/subscribe — salva ou atualiza token FCM do usuário
export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { token } = await request.json();
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 });
  }

  await ensureSchema();

  // Upsert: se o token já existe atualiza user_id/role; se é novo insere
  await sql`
    INSERT INTO fcm_tokens (user_id, user_email, user_role, token, updated_at)
    VALUES (${user.userId}, ${user.email}, ${user.role}, ${token}, NOW())
    ON CONFLICT (token) DO UPDATE SET
      user_id    = EXCLUDED.user_id,
      user_email = EXCLUDED.user_email,
      user_role  = EXCLUDED.user_role,
      updated_at = NOW()
  `;

  return NextResponse.json({ ok: true });
}

// DELETE /api/notifications/subscribe — remove token ao fazer logout / desativar
export async function DELETE(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { token } = await request.json().catch(() => ({}));
  if (token) {
    await sql`DELETE FROM fcm_tokens WHERE token = ${token} AND user_id = ${user.userId}`;
  } else {
    // Remove todos os tokens do usuário (ex: logout)
    await sql`DELETE FROM fcm_tokens WHERE user_id = ${user.userId}`;
  }

  return NextResponse.json({ ok: true });
}
