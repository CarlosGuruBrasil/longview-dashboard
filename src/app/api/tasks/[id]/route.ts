import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { readTaskById, upsertTask, deleteTask, Task, ChangeLog } from '@/lib/db-kv';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const { id } = await params;
    const task = await readTaskById(id);
    if (!task) return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    return NextResponse.json({ task });
  } catch (e) {
    console.error('[GET /api/tasks/[id]]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const { id } = await params;
    const body   = await request.json();
    const task   = await readTaskById(id);
    if (!task) return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });

    const tracked: (keyof Task)[] = ['statusAndamento', 'urgencia', 'responsible', 'previsaoEntrega', 'statusContratacao'];
    const newLogs: ChangeLog[] = tracked
      .filter(f => body[f] !== undefined && body[f] !== task[f])
      .map(f => ({
        id:       `log-${id}-${Date.now()}-${f}`,
        field:    String(f),
        oldValue: String(task[f] ?? 'Vazio'),
        newValue: String(body[f]),
        userName: user.name,
        date:     new Date().toISOString(),
      }));

    const updated: Task = {
      ...task, ...body,
      logs:      [...(task.logs || []), ...newLogs],
      subtasks:  body.subtasks  !== undefined ? body.subtasks  : task.subtasks,
      comments:  body.comments  !== undefined ? body.comments  : task.comments,
      documents: body.documents !== undefined ? body.documents : task.documents,
    };

    if (body.statusAndamento === 'Finalizado') updated.progress = 100;
    else if (body.statusAndamento !== undefined && task.statusAndamento === 'Finalizado')
      updated.progress = body.progress ?? 50;

    await upsertTask(updated);
    return NextResponse.json({ task: updated });
  } catch (e) {
    console.error('[PATCH /api/tasks/[id]]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const { id } = await params;
    const found  = await deleteTask(id);
    if (!found) return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[DELETE /api/tasks/[id]]', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
