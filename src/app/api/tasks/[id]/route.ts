import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { readProjectData, mutateProjectData, Task, ChangeLog } from '@/lib/db-kv';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const { id } = await params;
    const db = await readProjectData();
    const task = db.tasks.find(t => t.id === id);

    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Erro ao buscar tarefa:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await verifyAuth();
    if (!authUser) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    let updatedTask: Task | undefined;

    const result = await mutateProjectData((db) => {
      const taskIndex = db.tasks.findIndex(t => t.id === id);
      if (taskIndex === -1) return;

      const task = db.tasks[taskIndex];
      const user = authUser || body.currentUser || { name: 'Sistema', role: 'Diretoria' };

      const fieldsToTrack: (keyof Task)[] = ['statusAndamento', 'urgencia', 'responsible', 'previsaoEntrega', 'statusContratacao'];
      const logs: ChangeLog[] = fieldsToTrack
        .filter(f => body[f] !== undefined && body[f] !== task[f])
        .map(f => ({ id: `log-${id}-${Date.now()}-${f}`, field: String(f), oldValue: String(task[f] || 'Vazio'), newValue: String(body[f]), userName: user.name, date: new Date().toISOString() }));

      updatedTask = {
        ...task, ...body,
        logs: [...(task.logs || []), ...logs],
        subtasks:  body.subtasks  !== undefined ? body.subtasks  : task.subtasks,
        comments:  body.comments  !== undefined ? body.comments  : task.comments,
        documents: body.documents !== undefined ? body.documents : task.documents,
      };

      if (body.statusAndamento === 'Finalizado') updatedTask!.progress = 100;
      else if (body.statusAndamento !== undefined && task.statusAndamento === 'Finalizado')
        updatedTask!.progress = body.progress !== undefined ? body.progress : 50;

      db.tasks[taskIndex] = updatedTask!;

      const projectTasks = db.tasks.filter(t => t.project.toLowerCase() === updatedTask!.project.toLowerCase());
      const finished = projectTasks.filter(t => t.statusAndamento === 'Finalizado').length;
      const projectProgress = projectTasks.length > 0 ? Math.round((finished / projectTasks.length) * 100) : 0;
      db.projects = db.projects.map(p =>
        p.name.toLowerCase() === updatedTask!.project.toLowerCase()
          ? { ...p, progress: projectProgress, status: projectProgress === 100 ? 'Finalizado' : projectProgress > 0 ? 'Em andamento' : 'Não iniciado' }
          : p
      );
    });

    if (!updatedTask) return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error('Erro ao atualizar tarefa:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const { id } = await params;
    let found = false;

    await mutateProjectData((db) => {
      const task = db.tasks.find(t => t.id === id);
      if (!task) return;
      found = true;
      db.tasks = db.tasks.filter(t => t.id !== id);
      const projectTasks = db.tasks.filter(t => t.project.toLowerCase() === task.project.toLowerCase());
      const finished = projectTasks.filter(t => t.statusAndamento === 'Finalizado').length;
      const projectProgress = projectTasks.length > 0 ? Math.round((finished / projectTasks.length) * 100) : 0;
      db.projects = db.projects.map(p =>
        p.name.toLowerCase() === task.project.toLowerCase()
          ? { ...p, progress: projectProgress, status: projectProgress === 100 ? 'Finalizado' : projectProgress > 0 ? 'Em andamento' : 'Não iniciado' }
          : p
      );
    });

    if (!found) return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Tarefa deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar tarefa:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
