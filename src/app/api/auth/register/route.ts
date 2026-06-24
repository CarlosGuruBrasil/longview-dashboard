import { NextRequest, NextResponse } from 'next/server';
import { readUsers, writeUsers, readKv, writeKv, PendingRegistration, UserProfileData } from '@/lib/db-kv';
import { InviteToken } from '@/app/api/admin/invite-link/route';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * GET /api/auth/register?token=xxx
 * Valida o token de convite e retorna a lista de possíveis aprovadores.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token ausente' }, { status: 400 });

  const invite = await readKv<InviteToken | null>('invite_token', null);
  if (!invite || invite.token !== token) {
    return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 400 });
  }

  // Retorna usuários que podem aprovar (Desenvolvedor, Diretoria, Gestor)
  const users     = await readUsers();
  const approvers = users
    .filter(u => ['Desenvolvedor', 'Diretoria', 'Gestor'].includes(u.role))
    .map(u => ({ id: u.id, name: u.name, role: u.role, email: u.email }));

  return NextResponse.json({ valid: true, approvers });
}

/**
 * POST /api/auth/register
 * Submete um cadastro pendente. Requer token válido no body.
 */
export async function POST(request: NextRequest) {
  const body = await request.json() as {
    token: string;
    name: string;
    email: string;
    password: string;
    approverId: string;
    profile?: Partial<UserProfileData>;
  };

  const { token, name, email, password, approverId, profile } = body;

  // Validações básicas
  if (!token || !name || !email || !password || !approverId) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Senha deve ter pelo menos 8 caracteres' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }

  // Valida token de convite
  const invite = await readKv<InviteToken | null>('invite_token', null);
  if (!invite || invite.token !== token) {
    return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 400 });
  }

  // Verifica se email já existe
  const users = await readUsers();
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return NextResponse.json({ error: 'Este email já está cadastrado' }, { status: 409 });
  }

  // Verifica aprovador
  const approver = users.find(u => u.id === approverId);
  if (!approver) {
    return NextResponse.json({ error: 'Aprovador não encontrado' }, { status: 400 });
  }

  // Carrega registros pendentes existentes
  const store = await readKv<{ registrations: PendingRegistration[] }>('pending_registrations', { registrations: [] });

  // Verifica se email já tem pedido pendente
  if (store.registrations.some(r => r.email.toLowerCase() === email.toLowerCase() && r.status === 'pending')) {
    return NextResponse.json({ error: 'Já existe um pedido pendente para este email' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const reg: PendingRegistration = {
    id:            crypto.randomUUID(),
    name:          name.trim(),
    email:         email.trim().toLowerCase(),
    passwordHash,
    profile:       profile ?? {},
    approverId,
    approverName:  approver.name,
    approverEmail: approver.email,
    status:        'pending',
    createdAt:     new Date().toISOString(),
  };

  store.registrations = [...store.registrations, reg];
  await writeKv('pending_registrations', store);

  // TODO: enviar push FCM para o aprovador (quando houver tokens FCM configurados)

  return NextResponse.json({ success: true, id: reg.id }, { status: 201 });
}
