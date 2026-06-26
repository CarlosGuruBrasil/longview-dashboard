import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { readUsers, readKv, writeKv } from '@/lib/db-kv';

export interface PresenceEntry {
  userId: string;
  name: string;
  role: string;
  avatarUrl?: string;
  lastSeen: string; // ISO
}

/** POST /api/user/heartbeat — atualiza presença do usuário autenticado */
export async function POST() {
  const auth = await verifyAuth();
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const users = await readUsers();
  const user  = users.find(u => u.id === auth.userId);
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

  const store = await readKv<Record<string, PresenceEntry>>('user_presence', {});
  store[auth.userId] = {
    userId:    auth.userId,
    name:      user.name,
    role:      user.role,
    avatarUrl: user.profile?.avatarUrl,
    lastSeen:  new Date().toISOString(),
  };
  await writeKv('user_presence', store);

  return NextResponse.json({ ok: true });
}
