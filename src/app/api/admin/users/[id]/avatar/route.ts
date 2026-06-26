import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { readUsers, writeUsers } from '@/lib/db-kv';

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/admin/users/[id]/avatar — armazena foto como base64 no Postgres (app_users.data) */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const auth = await verifyAuth();
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const isAdmin = ['Desenvolvedor', 'Diretoria', 'Gestor'].includes(auth.role);
  if (auth.userId !== id && !isAdmin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 });

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) return NextResponse.json({ error: 'Use JPG, PNG ou WebP.' }, { status: 400 });
  if (file.size > 3 * 1024 * 1024) return NextResponse.json({ error: 'Máximo 3 MB.' }, { status: 400 });

  const users = await readUsers();
  const user  = users.find(u => u.id === id);
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

  // Converte para base64 e salva como data URL no campo avatarUrl do perfil
  const buffer = Buffer.from(await file.arrayBuffer());
  const avatarUrl = `data:${file.type};base64,${buffer.toString('base64')}`;

  user.profile = { ...(user.profile ?? {}), avatarUrl };
  await writeUsers(users);

  return NextResponse.json({ avatarUrl });
}
