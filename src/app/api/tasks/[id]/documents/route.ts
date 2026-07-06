import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { listTaskDocuments, addTaskDocument } from '@/lib/db-kv';
import { randomUUID } from 'crypto';
import logger from '@/lib/logger'

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await params;
  const docs = await listTaskDocuments(id);
  return NextResponse.json({ documents: docs });
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id: taskId } = await params;

  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 });
    if (file.size > 200 * 1024 * 1024) return NextResponse.json({ error: 'Arquivo muito grande (máx 200 MB)' }, { status: 413 });

    const buf      = Buffer.from(await file.arrayBuffer());
    const category = (form.get('category') as string) || 'outro';
    const docId    = randomUUID();

    await addTaskDocument({
      id:          docId,
      taskId,
      name:        file.name,
      category,
      contentType: file.type || 'application/octet-stream',
      sizeBytes:   file.size,
      data:        buf,
      uploadedBy:  user.name,
      version:     1,
    });

    return NextResponse.json({
      document: { id: docId, taskId, name: file.name, category, contentType: file.type, sizeBytes: file.size, uploadedBy: user.name, uploadedAt: new Date().toISOString(), version: 1 },
    }, { status: 201 });
  } catch (e: unknown) {
    logger.error({ e }, '[POST /api/tasks/[id]/documents]');
    return NextResponse.json({ error: 'Erro ao salvar arquivo' }, { status: 500 });
  }
}
