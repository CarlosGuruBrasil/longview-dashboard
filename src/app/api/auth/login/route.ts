import { NextRequest, NextResponse } from 'next/server';
import { readUsers, seedDatabaseIfEmpty } from '@/lib/db-kv';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? (() => { throw new Error('[LongView] JWT_SECRET nao configurado. Defina no .env.local') })();

export async function POST(request: NextRequest) {
  // Rate limiting agressivo no login: 10 tentativas por 5 minutos por IP
  // Protege contra brute force
  const ip = getClientIp(request);
  const rl = await rateLimit(`login:${ip}`, 10, 300);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Muitas tentativas de login. Aguarde 5 minutos.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rl.reset) },
      }
    );
  }

  try {
    await seedDatabaseIfEmpty();

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios.' }, { status: 400 });
    }

    const emailLower = email.toLowerCase().trim();
    const users = await readUsers();
    const user = users.find(u => u.email.toLowerCase() === emailLower);

    if (!user) {
      return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
    }

    const token = jwt.sign(
      {
        userId:      user.id,
        name:        user.name,
        email:       user.email,
        role:        user.role,
        permissions: user.permissions,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const response = NextResponse.json({
      success: true,
      user: {
        id:          user.id,
        name:        user.name,
        email:       user.email,
        role:        user.role,
        permissions: user.permissions,
      },
    });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   60 * 60 * 24 * 7, // 7 dias
      path:     '/',
    });

    return response;
  } catch (error) {
    console.error('[/api/auth/login] Erro:', error);
    return NextResponse.json({ error: 'Erro interno no servidor de autenticação.' }, { status: 500 });
  }
}
