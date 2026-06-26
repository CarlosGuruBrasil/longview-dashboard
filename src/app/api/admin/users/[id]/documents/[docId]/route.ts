import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { readUserDocuments } from '@/lib/db-kv';

const HR_ROLES = new Set(['Desenvolvedor', 'Diretoria', 'Gestor']);

type Ctx = { params: Promise<{ id: string; docId: string }> };

/** GET /api/admin/users/[id]/documents/[docId] — faz download do arquivo a partir do Postgres */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id, docId } = await params;
  const auth = await verifyAuth();
  if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!HR_ROLES.has(auth.role)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const docs = await readUserDocuments(id);
  const doc  = docs.find(d => d.id === docId);
  if (!doc) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });

  const b64 = (doc as any).contentB64 as string | undefined;
  if (!b64) return NextResponse.json({ error: 'Conteúdo não disponível' }, { status: 404 });

  const buffer = Buffer.from(b64, 'base64');
  const ext    = doc.contentType === 'application/pdf' ? 'pdf'
               : doc.contentType === 'image/png'       ? 'png'
               : doc.contentType === 'image/webp'      ? 'webp'
               : 'jpg';
  const filename = `${doc.name.replace(/[^a-z0-9]/gi, '_')}.${ext}`;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type':        doc.contentType ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(buffer.length),
    },
  });
}
