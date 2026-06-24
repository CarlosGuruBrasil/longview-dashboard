import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, verifyAdminAuth } from '@/lib/auth';
import { readUsers, writeUsers, UserProfileData } from '@/lib/db-kv';

/** GET /api/admin/users/[id] */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth   = await verifyAuth();
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  // Usuário só pode ver o próprio; admin pode ver qualquer um
  const admin = await verifyAdminAuth();
  if (!admin && auth.userId !== id) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const users = await readUsers();
  const user  = users.find(u => u.id === id);
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

  const { passwordHash: _, ...safe } = user;
  return NextResponse.json({ user: safe });
}

/** PUT /api/admin/users/[id] — admin edita qualquer campo; usuário edita só o próprio */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth   = await verifyAuth();
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const admin   = await verifyAdminAuth();
  const isSelf  = auth.userId === id;

  if (!admin && !isSelf) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const body = await request.json() as {
    name?:    string;
    role?:    string;
    profile?: Partial<UserProfileData>;
  };

  const users = await readUsers();
  const idx   = users.findIndex(u => u.id === id);
  if (idx === -1) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

  const user = { ...users[idx] };

  if (body.name && body.name.trim().length >= 2) user.name = body.name.trim();

  // Apenas admin pode alterar role
  if (admin && body.role && ['Desenvolvedor','Diretoria','Gestor','Operador','Parceiro','Corretor','Visualizador'].includes(body.role)) {
    user.role = body.role as typeof user.role;
  }

  if (body.profile) {
    user.profile = {
      ...(user.profile ?? {}),
      ...body.profile,
      address: body.profile.address
        ? { ...(user.profile?.address ?? {}), ...body.profile.address }
        : user.profile?.address,
      emergencyContact: body.profile.emergencyContact
        ? { ...(user.profile?.emergencyContact ?? {}), ...body.profile.emergencyContact }
        : user.profile?.emergencyContact,
      // Notas apenas admin
      notes: admin ? (body.profile.notes ?? user.profile?.notes) : user.profile?.notes,
    };
  }

  users[idx] = user;
  await writeUsers(users);

  const { passwordHash: _, ...safe } = user;
  return NextResponse.json({ user: safe });
}
