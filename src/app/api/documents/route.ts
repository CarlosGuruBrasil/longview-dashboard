/**
 * GET /api/documents
 * Lista todos os anexos de tarefas com metadados (task, projeto, categoria).
 * Suporta ?q=&category=&project=&taskId=
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { sql, ensureSchema } from '@/lib/pg';

export interface DocumentWithContext {
  id: string;
  taskId: string;
  taskSubject: string;
  project: string;
  name: string;
  category: string;
  contentType: string | null;
  sizeBytes: number | null;
  uploadedBy: string;
  uploadedAt: string;
  version: number;
  downloadUrl: string;
}

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const p = request.nextUrl.searchParams;
  const q        = p.get('q')?.toLowerCase()        ?? '';
  const category = p.get('category')                ?? '';
  const project  = p.get('project')                 ?? '';
  const taskId   = p.get('taskId')                  ?? '';

  try {
    await ensureSchema();

    // JOIN task_documents com tasks para pegar contexto
    const rows = await sql<{
      id: string; task_id: string; task_subject: string; task_project: string;
      name: string; category: string; content_type: string | null;
      size_bytes: number | null; uploaded_by: string;
      uploaded_at: string; version: number;
    }[]>`
      SELECT
        td.id,
        td.task_id,
        (t.data->>'subject') AS task_subject,
        (t.data->>'project') AS task_project,
        td.name,
        td.category,
        td.content_type,
        td.size_bytes,
        td.uploaded_by,
        td.uploaded_at::text,
        td.version
      FROM task_documents td
      JOIN tasks t ON t.id = td.task_id
      ORDER BY td.uploaded_at DESC
    `;

    let docs: DocumentWithContext[] = rows.map(r => ({
      id:           r.id,
      taskId:       r.task_id,
      taskSubject:  r.task_subject ?? '—',
      project:      r.task_project ?? '—',
      name:         r.name,
      category:     r.category,
      contentType:  r.content_type,
      sizeBytes:    r.size_bytes,
      uploadedBy:   r.uploaded_by,
      uploadedAt:   r.uploaded_at,
      version:      r.version,
      downloadUrl:  `/api/tasks/${r.task_id}/documents/${r.id}`,
    }));

    if (q)        docs = docs.filter(d => d.name.toLowerCase().includes(q) || d.taskSubject.toLowerCase().includes(q) || d.project.toLowerCase().includes(q) || d.uploadedBy.toLowerCase().includes(q));
    if (category) docs = docs.filter(d => d.category.toLowerCase() === category.toLowerCase());
    if (project)  docs = docs.filter(d => d.project.toLowerCase() === project.toLowerCase());
    if (taskId)   docs = docs.filter(d => d.taskId === taskId);

    return NextResponse.json({ documents: docs, total: docs.length });
  } catch (e) {
    console.error('[GET /api/documents]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
