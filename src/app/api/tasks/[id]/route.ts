import { NextRequest, NextResponse } from 'next/server';
import { readProjectData, writeProjectData, Task, ChangeLog } from '@/lib/db-kv';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const { id } = await params;
    const body = await request.json();
    const db = await readProjectData();

    const taskIndex = db.tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    const task = db.tasks[taskIndex];
    const user = body.currentUser || { name: 'Sistema', role: 'Diretoria' };

    const logs: ChangeLog[] = [];
    const fieldsToTrack: (keyof Task)[] = [
      'statusAndamento', 'urgencia', 'responsible', 'previsaoEntrega', 'statusContratacao'
    ];

    fieldsToTrack.forEach(field => {
      if (body[field] !== undefined && body[field] !== task[field]) {
        logs.push({
          id: `log-${id}-${Date.now()}-${field}`,
          field: String(field),
          oldValue: String(task[field] || 'Vazio'),
          newValue: String(body[field]),
          userName: user.name,
          date: new Date().toISOString()
        });
      }
    });

    const updatedTask = {
      ...task,
      ...body,
      logs: [...(task.logs || []), ...logs],
      subtasks: body.subtasks !== undefined ? body.subtasks : task.subtasks,
      comments: body.comments !== undefined ? body.comments : task.comments,
      documents: body.documents !== undefined ? body.documents : task.documents,
    };

    if (body.statusAndamento === 'Finalizado') {
      updatedTask.progress = 100;
    } else if (body.statusAndamento !== undefined && task.statusAndamento === 'Finalizado') {
      updatedTask.progress = body.progress !== undefined ? body.progress : 50;
    }

    db.tasks[taskIndex] = updatedTask;

    const projectTasks = db.tasks.filter(t => t.project.toLowerCase() === updatedTask.project.toLowerCase());
    const finished = projectTasks.filter(t => t.statusAndamento === 'Finalizado').length;
    const projectProgress = projectTasks.length > 0 ? Math.round((finished / projectTasks.length) * 100) : 0;

    db.projects = db.projects.map(p => {
      if (p.name.toLowerCase() === updatedTask.project.toLowerCase()) {
        return {
          ...p,
          progress: projectProgress,
          status: projectProgress === 100 ? 'Finalizado' : projectProgress > 0 ? 'Em andamento' : 'Não iniciado'
        };
      }
      return p;
    });

    await writeProjectData(db);

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
    const { id } = await params;
    const db = await readProjectData();

    const task = db.tasks.find(t => t.id === id);
    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    db.tasks = db.tasks.filter(t => t.id !== id);

    const projectTasks = db.tasks.filter(t => t.project.toLowerCase() === task.project.toLowerCase());
    const finished = projectTasks.filter(t => t.statusAndamento === 'Finalizado').length;
    const projectProgress = projectTasks.length > 0 ? Math.round((finished / projectTasks.length) * 100) : 0;

    db.projects = db.projects.map(p => {
      if (p.name.toLowerCase() === task.project.toLowerCase()) {
        return {
          ...p,
          progress: projectProgress,
          status: projectProgress === 100 ? 'Finalizado' : projectProgress > 0 ? 'Em andamento' : 'Não iniciado'
        };
      }
      return p;
    });

    await writeProjectData(db);

    return NextResponse.json({ success: true, message: 'Tarefa deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar tarefa:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
