import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { readUsers, readUserDocuments, addUserDocument, deleteUserDocument, type UserDocument } from '@/lib/db-kv';

const HR_ROLES = new Set(['Desenvolvedor', 'Diretoria', 'Gestor']);
const canManage = (role: string) => HR_ROLES.has(role);

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/users/[id]/documents */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const auth = await verifyAuth();
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const docs = await readUserDocuments(id);

  // Usuário sem permissão People Vision vê apenas metadados — sem conteúdo do arquivo
  if (!canManage(auth.role)) {
    return NextResponse.json({
      count: docs.length,
      docs: docs.map(d => ({
        id: d.id, name: d.name, category: d.category,
        uploadedAt: d.uploadedAt, expiresAt: d.expiresAt, contentType: d.contentType,
      })),
    });
  }

  // People Vision vê tudo exceto o base64 bruto (download via rota dedicada)
  return NextResponse.json({
    count: docs.length,
    docs: docs.map(d => ({
      id: d.id, name: d.name, category: d.category,
      contentType: d.contentType, sizeBytes: d.sizeBytes,
      expiresAt: d.expiresAt, uploadedBy: d.uploadedBy, uploadedAt: d.uploadedAt,
    })),
  });
}

/** POST /api/admin/users/[id]/documents — armazena arquivo como base64 no Postgres */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const auth = await verifyAuth();
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!canManage(auth.role)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const users = await readUsers();
  if (!users.find(u => u.id === id)) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

  const form      = await req.formData();
  const file      = form.get('file') as File | null;
  const name      = (form.get('name') as string | null)?.trim();
  const category  = (form.get('category') as string | null) ?? 'outro';
  const expiresAt = (form.get('expiresAt') as string | null) || undefined;

  if (!file || !name) return NextResponse.json({ error: 'file e name são obrigatórios' }, { status: 400 });

  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) return NextResponse.json({ error: 'Use PDF, JPG ou PNG.' }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Máximo 5 MB.' }, { status: 400 });

  const buffer    = Buffer.from(await file.arrayBuffer());
  const contentB64 = buffer.toString('base64');

  const doc: UserDocument = {
    id:          `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    userId:      id,
    name,
    category:    category as UserDocument['category'],
    url:         '',          // sem URL externa — arquivo no banco
    contentType: file.type,
    sizeBytes:   file.size,
    expiresAt,
    uploadedBy:  auth.userId,
    uploadedAt:  new Date().toISOString(),
    contentB64,
  };

  await addUserDocument(doc);

  // Retorna sem o base64 para não inflar o JSON da resposta
  const { contentB64: _, ...docMeta } = doc;
  return NextResponse.json({ doc: docMeta }, { status: 201 });
}

/** DELETE /api/admin/users/[id]/documents?docId=xxx */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const auth = await verifyAuth();
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!canManage(auth.role)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const docId = req.nextUrl.searchParams.get('docId');
  if (!docId) return NextResponse.json({ error: 'docId obrigatório' }, { status: 400 });

  const docs = await readUserDocuments(id);
  if (!docs.find(d => d.id === docId)) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });

  await deleteUserDocument(id, docId);
  return NextResponse.json({ ok: true });
}
