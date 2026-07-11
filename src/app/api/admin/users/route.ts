import { NextRequest, NextResponse } from 'next/server';
import { readUsers, writeUsers, DbUser } from '@/lib/db-kv';
import { normalizePermissions } from '@/lib/permissions';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { verifyAdminAuth } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import logger from '@/lib/logger'
import { z } from 'zod';

const USER_ROLES = ['Desenvolvedor', 'Diretoria', 'Operador', 'Gestor', 'Parceiro', 'Corretor', 'Visualizador'] as const;
const roleSchema = z.enum(USER_ROLES);

const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(200),
  email: z.string().trim().email('E-mail inválido').max(320),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').max(200),
  role: roleSchema,
  permissions: z.record(z.string(), z.unknown()),
});

const updateUserSchema = z.object({
  id: z.string().trim().min(1, 'ID do usuário é obrigatório'),
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email('E-mail inválido').max(320).optional(),
  // '' = não alterar a senha (comportamento do form de edição)
  password: z.string().max(200).refine(p => p === '' || p.length >= 8, 'Senha deve ter no mínimo 8 caracteres').optional(),
  role: roleSchema.optional(),
  permissions: z.record(z.string(), z.unknown()).optional(),
});

function zodError(e: z.ZodError) {
  return NextResponse.json({ error: e.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 });
}

// GET: Listar usuários cadastrados
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin:${ip}`, 60, 60);
  if (!rl.success) {
    return NextResponse.json({ error: 'Muitas requisições.' }, { status: 429 });
  }

  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: 'Acesso negado. Apenas administradores podem gerenciar usuários.' }, { status: 403 });
  }

  try {
    const users = await readUsers();
    // Ocultar os hashes de senha antes de retornar os usuários
    const safeUsers = users.map(u => {
      const { passwordHash: _, ...safeUser } = u;
      return safeUser;
    });

    return NextResponse.json({ users: safeUsers });
  } catch (error) {
    logger.error({ error }, 'Erro ao listar usuários:');
    return NextResponse.json({ error: 'Erro ao carregar usuários.' }, { status: 500 });
  }
}

// POST: Criar novo usuário com permissões customizadas e senha
export async function POST(request: NextRequest) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: 'Acesso negado. Apenas administradores podem cadastrar usuários.' }, { status: 403 });
  }

  try {
    const parsed = createUserSchema.safeParse(await request.json());
    if (!parsed.success) return zodError(parsed.error);
    const { name, email, password, role, permissions } = parsed.data;

    const emailLower = email.toLowerCase().trim();
    const users = await readUsers();

    // Validar se o e-mail já existe
    if (users.some(u => u.email.toLowerCase() === emailLower)) {
      return NextResponse.json({ error: 'Este endereço de e-mail já está sendo utilizado.' }, { status: 400 });
    }

    // Criar hash da senha
    const passwordHash = await bcrypt.hash(password, 10);
    const newId = `usr-${Date.now()}`;

    const newUser: DbUser = {
      id: newId,
      name: name.trim(),
      email: emailLower,
      passwordHash,
      role,
      permissions: normalizePermissions(permissions),
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    await writeUsers(users);

    const { passwordHash: _, ...safeUser } = newUser;
    return NextResponse.json({ success: true, user: safeUser }, { status: 201 });
  } catch (error) {
    logger.error({ error }, 'Erro ao criar usuário:');
    return NextResponse.json({ error: 'Erro interno ao cadastrar usuário.' }, { status: 500 });
  }
}

// PUT: Atualizar usuário existente (permissões ou dados)
export async function PUT(request: NextRequest) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: 'Acesso negado. Apenas administradores podem atualizar usuários.' }, { status: 403 });
  }

  try {
    const parsed = updateUserSchema.safeParse(await request.json());
    if (!parsed.success) return zodError(parsed.error);
    const { id, name, email, password, role, permissions } = parsed.data;

    const users = await readUsers();
    const userIndex = users.findIndex(u => u.id === id);

    if (userIndex === -1) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    const targetUser = users[userIndex];

    // Impedir edição de e-mail de Desenvolvedor por outros administradores para proteção
    if (targetUser.role === 'Desenvolvedor' && adminUser.role !== 'Desenvolvedor') {
      return NextResponse.json({ error: 'Permissão negada. Apenas o Desenvolvedor pode editar seus próprios dados.' }, { status: 403 });
    }

    // Atualizar dados
    if (name) targetUser.name = name.trim();
    if (email) targetUser.email = email.toLowerCase().trim();
    if (role) targetUser.role = role;
    if (permissions) targetUser.permissions = normalizePermissions({ ...targetUser.permissions, ...permissions });
    
    // Atualizar senha se fornecida
    if (password && password.trim() !== '') {
      targetUser.passwordHash = await bcrypt.hash(password, 10);
    }

    users[userIndex] = targetUser;
    await writeUsers(users);

    const { passwordHash: _, ...safeUser } = targetUser;
    return NextResponse.json({ success: true, user: safeUser });
  } catch (error) {
    logger.error({ error }, 'Erro ao atualizar usuário:');
    return NextResponse.json({ error: 'Erro interno ao atualizar usuário.' }, { status: 500 });
  }
}

// DELETE: Remover usuário
export async function DELETE(request: NextRequest) {
  const adminUser = await verifyAdminAuth();
  if (!adminUser) {
    return NextResponse.json({ error: 'Acesso negado. Apenas administradores podem excluir usuários.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório para exclusão.' }, { status: 400 });
    }

    let users = await readUsers();
    const userToDelete = users.find(u => u.id === id);

    if (!userToDelete) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    // Regras de Proteção:
    // 1. Não permitir deletar o Desenvolvedor Carlos
    if (userToDelete.role === 'Desenvolvedor' || userToDelete.id === 'usr-dev') {
      return NextResponse.json({ error: 'Não é possível remover o perfil do Desenvolvedor principal.' }, { status: 400 });
    }
    
    // 2. Um admin não pode deletar a si mesmo
    if (userToDelete.id === adminUser.userId) {
      return NextResponse.json({ error: 'Você não pode excluir a sua própria conta de usuário.' }, { status: 400 });
    }

    users = users.filter(u => u.id !== id);
    await writeUsers(users);

    return NextResponse.json({ success: true, message: 'Usuário excluído com sucesso.' });
  } catch (error) {
    logger.error({ error }, 'Erro ao excluir usuário:');
    return NextResponse.json({ error: 'Erro interno ao excluir usuário.' }, { status: 500 });
  }
}
