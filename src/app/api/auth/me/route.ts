import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { readUsers } from '@/lib/db-kv';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  // Rate limiting leve: /api/auth/me é chamado em cada page load
  const ip = getClientIp(request);
  const rl = await rateLimit(`me:${ip}`, 120, 60);
  if (!rl.success) {
    return NextResponse.json({ error: 'Muitas requisições.' }, { status: 429 });
  }

  const auth = await verifyAuth();
  if (!auth) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  // ponytail: lê permissões sempre do banco — JWT só identifica o usuário.
  // Evita que mudanças de permissão só valham após o usuário fazer logout.
  let permissions = auth.permissions;
  let role = auth.role;
  let name = auth.name;
  try {
    const users = await readUsers();
    const dbUser = users.find(u => u.id === auth.userId);
    if (dbUser) {
      permissions = dbUser.permissions as unknown as typeof permissions;
      role = dbUser.role;
      name = dbUser.name;
      return NextResponse.json({
        isAuthenticated: true,
        user: {
          id: auth.userId,
          name,
          email: dbUser.email,
          role,
          permissions,
          mustChangePassword: dbUser.profile?.mustChangePassword === true,
          profile: dbUser.profile ?? {},
        },
      });
    }
  } catch { /* fallback para dados do JWT se banco indisponível */ }

  return NextResponse.json({
    isAuthenticated: true,
    user: {
      id:          auth.userId,
      name,
      email:       auth.email,
      role,
      permissions,
      mustChangePassword: auth.mustChangePassword === true,
    },
  });
}
