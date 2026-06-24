import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { readUsers, writeUsers, UserProfileData } from '@/lib/db-kv';
import bcrypt from 'bcryptjs';

/**
 * GET /api/user/me
 * Retorna o perfil completo do usuário autenticado (sem passwordHash).
 */
export async function GET() {
  const auth = await verifyAuth();
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const users = await readUsers();
  const user  = users.find(u => u.id === auth.userId);
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

  const { passwordHash: _, ...safe } = user;
  return NextResponse.json({ user: safe });
}

/**
 * PUT /api/user/me
 * Atualiza campos de perfil (name, profile: UserProfileData).
 * Para trocar senha: body { currentPassword, newPassword }.
 */
export async function PUT(request: NextRequest) {
  const auth = await verifyAuth();
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const body = await request.json() as {
    name?: string;
    profile?: Partial<UserProfileData>;
    currentPassword?: string;
    newPassword?: string;
  };

  const users = await readUsers();
  const idx   = users.findIndex(u => u.id === auth.userId);
  if (idx === -1) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

  const user = { ...users[idx] };

  // ── Atualizar nome ────────────────────────────────────────────────────────
  if (body.name && body.name.trim().length >= 2) {
    user.name = body.name.trim();
  }

  // ── Atualizar campos de perfil RH ─────────────────────────────────────────
  if (body.profile) {
    user.profile = {
      ...(user.profile ?? {}),
      ...body.profile,
      // address é merge profundo
      address: body.profile.address
        ? { ...(user.profile?.address ?? {}), ...body.profile.address }
        : user.profile?.address,
      emergencyContact: body.profile.emergencyContact
        ? { ...(user.profile?.emergencyContact ?? {}), ...body.profile.emergencyContact }
        : user.profile?.emergencyContact,
    };
  }

  // ── Trocar senha ──────────────────────────────────────────────────────────
  if (body.currentPassword && body.newPassword) {
    const ok = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!ok) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 });
    if (body.newPassword.length < 8) {
      return NextResponse.json({ error: 'Nova senha precisa ter pelo menos 8 caracteres' }, { status: 400 });
    }
    user.passwordHash = await bcrypt.hash(body.newPassword, 12);
  }

  users[idx] = user;
  await writeUsers(users);

  const { passwordHash: _, ...safe } = user;
  return NextResponse.json({ user: safe });
}
