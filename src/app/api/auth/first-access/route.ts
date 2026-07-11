import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { verifyAuth } from '@/lib/auth';
import { readUsers, writeUsers } from '@/lib/db-kv';

const JWT_SECRET = process.env.JWT_SECRET ?? (() => { throw new Error('[LongView] JWT_SECRET nao configurado. Defina no .env.local') })();

export async function POST(request: NextRequest) {
  const auth = await verifyAuth();
  if (!auth) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = await request.json() as { newPassword?: string; confirmPassword?: string };
  const newPassword = body.newPassword?.trim() ?? '';
  const confirmPassword = body.confirmPassword?.trim() ?? '';

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'A nova senha precisa ter pelo menos 8 caracteres.' }, { status: 400 });
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'As senhas não conferem.' }, { status: 400 });
  }

  const users = await readUsers();
  const idx = users.findIndex((user) => user.id === auth.userId);
  if (idx === -1) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  const user = { ...users[idx] };
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.profile = {
    ...(user.profile ?? {}),
    mustChangePassword: false,
  };

  users[idx] = user;
  await writeUsers(users);

  const token = jwt.sign(
    {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      mustChangePassword: false,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const response = NextResponse.json({ success: true });
  response.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  return response;
}
