import { NextRequest, NextResponse } from 'next/server';
import { readUsers, seedDatabaseIfEmpty } from '@/lib/db-kv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-longview-key';

export async function POST(request: NextRequest) {
  try {
    // Garantir que os usuários iniciais existam no banco
    await seedDatabaseIfEmpty();

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios.' }, { status: 400 });
    }

    const emailLower = email.toLowerCase().trim();
    const users = await readUsers();
    
    // Buscar usuário pelo e-mail
    const user = users.find(u => u.email.toLowerCase() === emailLower);

    if (!user) {
      return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
    }

    // Gerar token JWT contendo ID, e-mail, perfil e permissões
    const token = jwt.sign(
      {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Retornar resposta com sucesso e salvar cookie seguro httpOnly
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      }
    });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 dias
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Erro na API de login:', error);
    return NextResponse.json({ error: 'Erro interno no servidor de autenticação.' }, { status: 500 });
  }
}
