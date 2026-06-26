import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { readUsers, writeUsers, readKv, writeKv, PendingRegistration, DbUser } from '@/lib/db-kv';
import { createDefaultPermissions } from '@/lib/permissions';
import crypto from 'crypto';

/** GET /api/admin/registrations — lista todos os pedidos de cadastro */
export async function GET() {
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const store = await readKv<{ registrations: PendingRegistration[] }>('pending_registrations', { registrations: [] });
  // Nunca expor passwordHash
  const safe  = store.registrations.map(({ passwordHash: _, ...r }) => r);

  return NextResponse.json({ registrations: safe });
}

/** PATCH /api/admin/registrations — aprovar ou rejeitar (body: { id, action: 'approve'|'reject' }) */
export async function PATCH(request: NextRequest) {
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const { id, action } = await request.json() as { id: string; action: 'approve' | 'reject' };
  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
  }

  const store = await readKv<{ registrations: PendingRegistration[] }>('pending_registrations', { registrations: [] });
  const idx   = store.registrations.findIndex(r => r.id === id);
  if (idx === -1) return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });

  const reg = store.registrations[idx];
  if (reg.status !== 'pending') {
    return NextResponse.json({ error: 'Registro já processado' }, { status: 409 });
  }

  // Atualiza status
  store.registrations[idx] = {
    ...reg,
    status:      action === 'approve' ? 'approved' : 'rejected',
    processedAt: new Date().toISOString(),
    processedBy: admin.name,
  };

  if (action === 'approve') {
    // Verificação final de unicidade (race condition guard)
    const users = await readUsers();
    if (users.some(u => u.email.toLowerCase() === reg.email.toLowerCase())) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 });
    }

    const newUser: DbUser = {
      id:           `usr-${crypto.randomUUID().slice(0, 8)}`,
      name:         reg.name,
      email:        reg.email,
      passwordHash: reg.passwordHash,
      role:         'Visualizador',
      permissions: createDefaultPermissions(),
      profile:   reg.profile as DbUser['profile'],
      createdAt: new Date().toISOString(),
    };

    await writeUsers([...users, newUser]);
  }

  await writeKv('pending_registrations', store);

  return NextResponse.json({ success: true, action });
}
