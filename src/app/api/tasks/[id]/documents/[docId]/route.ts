import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getTaskDocumentData, deleteTaskDocument } from '@/lib/db-kv';

type Params = { params: Promise<{ id: string; docId: string }> };

/** GET — baixar arquivo */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await verifyAuth();
  if (!user) return new Response('Não autorizado', { status: 401 });

  const { id: taskId, docId } = await params;
  const result = await getTaskDocumentData(docId);
  if (!result) return new Response('Não encontrado', { status: 404 });

  return new Response(result.data as unknown as BodyInit, {
    headers: {
      'Content-Type':        result.contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(result.name)}"`,
      'Cache-Control':       'private, max-age=3600',
    },
  });
}

/** DELETE — remover arquivo */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id: taskId, docId } = await params;
  const deleted = await deleteTaskDocument(docId, taskId);
  if (!deleted) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
  return NextResponse.json({ success: true });
}
