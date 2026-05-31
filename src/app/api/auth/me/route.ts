import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  // Rate limiting leve: /api/auth/me é chamado em cada page load
  const ip = getClientIp(request);
  const rl = await rateLimit(`me:${ip}`, 120, 60);
  if (!rl.success) {
    return NextResponse.json({ error: 'Muitas requisições.' }, { status: 429 });
  }

  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  return NextResponse.json({
    isAuthenticated: true,
    user: {
      id:          user.userId,
      name:        user.name,
      email:       user.email,
      role:        user.role,
      permissions: user.permissions,
    },
  });
}
