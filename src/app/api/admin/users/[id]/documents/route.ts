import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { verifyAuth } from '@/lib/auth';
import { readUsers, readUserDocuments, addUserDocument, deleteUserDocument, type UserDocument } from '@/lib/db-kv';

const HR_ROLES = new Set(['Desenvolvedor', 'Diretoria', 'Gestor']);

function canManageDocs(role: string) {
  return HR_ROLES.has(role);
}

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/users/[id]/documents — qualquer autenticado; conteúdo só para RH */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const auth = await verifyAuth();
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const docs = await readUserDocuments(id);
  // Não-RH vê apenas contagem + nomes, sem URL
  if (!canManageDocs(auth.role)) {
    return NextResponse.json({
      count: docs.length,
      docs: docs.map(d => ({ id: d.id, name: d.name, category: d.category, uploadedAt: d.uploadedAt, expiresAt: d.expiresAt })),
    });
  }
  return NextResponse.json({ count: docs.length, docs });
}

/** POST /api/admin/users/[id]/documents — multipart/form-data; só RH */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const auth = await verifyAuth();
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!canManageDocs(auth.role)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const users = await readUsers();
  if (!users.find(u => u.id === id)) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const name = (form.get('name') as string | null)?.trim();
  const category = (form.get('category') as string | null) ?? 'outro';
  const expiresAt = (form.get('expiresAt') as string | null) || undefined;

  if (!file || !name) return NextResponse.json({ error: 'file e name são obrigatórios' }, { status: 400 });

  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) return NextResponse.json({ error: 'Tipo de arquivo não permitido. Use PDF, JPG ou PNG.' }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Arquivo muito grande. Máximo 20 MB.' }, { status: 400 });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: 'Armazenamento não configurado (BLOB_READ_WRITE_TOKEN ausente).' }, { status: 503 });

  const ext   = file.name.split('.').pop() ?? 'bin';
  const blobPath = `rh/${id}/docs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const blob  = await put(blobPath, file, { access: 'public', token });

  const doc: UserDocument = {
    id:          `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    userId:      id,
    name,
    category:    category as UserDocument['category'],
    url:         blob.url,
    contentType: file.type,
    sizeBytes:   file.size,
    expiresAt,
    uploadedBy:  auth.userId,
    uploadedAt:  new Date().toISOString(),
  };

  await addUserDocument(doc);
  return NextResponse.json({ doc }, { status: 201 });
}

/** DELETE /api/admin/users/[id]/documents?docId=xxx — só RH */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const auth = await verifyAuth();
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!canManageDocs(auth.role)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const docId = req.nextUrl.searchParams.get('docId');
  if (!docId) return NextResponse.json({ error: 'docId obrigatório' }, { status: 400 });

  const docs = await readUserDocuments(id);
  const doc  = docs.find(d => d.id === docId);
  if (!doc) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    try { await del(doc.url, { token }); } catch { /* ignora se já foi removido */ }
  }

  await deleteUserDocument(id, docId);
  return NextResponse.json({ ok: true });
}
