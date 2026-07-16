import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, verifyAdminAuth } from '@/lib/auth';
import { readUsers, writeUsers, UserProfileData } from '@/lib/db-kv';
import { normalizePermissions, type UserPermissions } from '@/lib/permissions';
import { canEditTargetUser, canManageAllPeople, canManageUserPermissions, canViewFullPeopleProfile, canViewAllPeopleReadOnly, canSetManagerId, sanitizeUserForDetail } from '@/lib/user-access';
import bcrypt from 'bcryptjs';

/** GET /api/admin/users/[id] */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth   = await verifyAuth();
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const admin = await verifyAdminAuth();

  const users = await readUsers();
  const viewer = users.find(u => u.id === auth.userId);
  if (!viewer) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  const user  = users.find(u => u.id === id);
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

  if (!admin && auth.userId !== id && !canViewFullPeopleProfile(viewer, user) && !canViewAllPeopleReadOnly(viewer)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  return NextResponse.json({
    user: sanitizeUserForDetail(viewer, user),
    meta: {
      canEdit: canEditTargetUser(viewer, user),
      canManageDocuments: canManageAllPeople(viewer),
      canManagePermissions: canManageUserPermissions(viewer, user),
      canChangeRole: admin?.userId === auth.userId,
      canSetManagerId: canSetManagerId(viewer),
      canViewSensitive: canViewFullPeopleProfile(viewer, user),
      readOnly: canViewAllPeopleReadOnly(viewer) && !canManageAllPeople(viewer),
    },
  });
}

/** PUT /api/admin/users/[id] — admin edita qualquer campo; usuário edita só o próprio */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth   = await verifyAuth();
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const admin   = await verifyAdminAuth();
  const isSelf  = auth.userId === id;

  const body = await request.json() as {
    name?:        string;
    role?:        string;
    profile?:     Partial<UserProfileData>;
    permissions?: Partial<UserPermissions>;
    newPassword?: string;
  };

  const users = await readUsers();
  const viewer = users.find(u => u.id === auth.userId);
  if (!viewer) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  const idx   = users.findIndex(u => u.id === id);
  if (idx === -1) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

  const user = { ...users[idx] };
  const canEdit = canEditTargetUser(viewer, user);
  const canManagePermissions = canManageUserPermissions(viewer, user);

  if (!admin && !isSelf && !canEdit && !canManagePermissions) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  if (body.name && body.name.trim().length >= 2) user.name = body.name.trim();

  // Apenas admin pode alterar role e permissões
  if (admin && body.role && ['Desenvolvedor','Diretoria','Gestor','Operador','Parceiro','Corretor','Visualizador'].includes(body.role)) {
    user.role = body.role as typeof user.role;
  }
  if ((admin || canManagePermissions) && body.permissions) {
    user.permissions = normalizePermissions({ ...user.permissions, ...body.permissions });
  }

  if (body.profile) {
    const allowManagerChange = canSetManagerId(viewer);
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
      // managerId só pode ser definido por Desenvolvedor/Diretoria/isAdmin — senão um Gestor
      // poderia se auto-atribuir liderados e burlar o escopo de canManageUserPermissions
      managerId: allowManagerChange ? (body.profile.managerId ?? user.profile?.managerId) : user.profile?.managerId,
    };
  }

  // Admin forçando troca de senha
  if (admin && body.newPassword) {
    user.passwordHash = await bcrypt.hash(body.newPassword, 10);
  }

  users[idx] = user;
  await writeUsers(users);

  const { passwordHash: _, ...safe } = user;
  return NextResponse.json({ user: safe });
}
