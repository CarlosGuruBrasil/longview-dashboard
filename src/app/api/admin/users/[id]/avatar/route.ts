import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { verifyAuth } from '@/lib/auth';
import { readUsers, writeUsers } from '@/lib/db-kv';

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/admin/users/[id]/avatar — multipart; usuário edita o próprio, admin edita qualquer um */
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
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Máximo 5 MB.' }, { status: 400 });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: 'Armazenamento não configurado.' }, { status: 503 });

  const ext  = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const blob = await put(`rh/${id}/avatar.${ext}`, file, { access: 'public', token, allowOverwrite: true });

  const users = await readUsers();
  const user  = users.find(u => u.id === id);
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

  user.profile = { ...(user.profile ?? {}), avatarUrl: blob.url };
  await writeUsers(users);

  return NextResponse.json({ avatarUrl: blob.url });
}
