import { NextRequest, NextResponse } from 'next/server';
import { readProjectData, mutateProjectData, Task } from '@/lib/db-kv';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const db = await readProjectData();
    
    let filteredTasks = [...db.tasks];

    const q = searchParams.get('q');
    if (q) {
      const qLower = q.toLowerCase();
      filteredTasks = filteredTasks.filter(task => 
        task.subject.toLowerCase().includes(qLower) ||
        task.id.toLowerCase().includes(qLower) ||
        (task.description && task.description.toLowerCase().includes(qLower)) ||
        task.responsible.toLowerCase().includes(qLower) ||
        task.sector.toLowerCase().includes(qLower) ||
        task.project.toLowerCase().includes(qLower) ||
        (task.situacao && task.situacao.toLowerCase().includes(qLower)) ||
        (task.observacoesRotinas && task.observacoesRotinas.toLowerCase().includes(qLower))
      );
    }

    const project = searchParams.get('project');
    if (project) {
      filteredTasks = filteredTasks.filter(t => t.project.toLowerCase() === project.toLowerCase());
    }

    const sector = searchParams.get('sector');
    if (sector) {
      filteredTasks = filteredTasks.filter(t => t.sector.toLowerCase() === sector.toLowerCase());
    }

    const status = searchParams.get('status');
    if (status) {
      filteredTasks = filteredTasks.filter(t => t.statusAndamento.toLowerCase() === status.toLowerCase());
    }

    const urgencia = searchParams.get('urgencia');
    if (urgencia) {
      filteredTasks = filteredTasks.filter(t => t.urgencia.toLowerCase() === urgencia.toLowerCase());
    }

    const responsible = searchParams.get('responsible');
    if (responsible) {
      const respLower = responsible.toLowerCase();
      filteredTasks = filteredTasks.filter(t => 
        t.responsible.toLowerCase() === respLower ||
        (t.secondaryResponsibles && t.secondaryResponsibles.some(sr => sr.toLowerCase() === respLower))
      );
    }

    const statusContratacao = searchParams.get('statusContratacao');
    if (statusContratacao) {
      filteredTasks = filteredTasks.filter(t => t.statusContratacao.toLowerCase() === statusContratacao.toLowerCase());
    }

    filteredTasks.sort((a, b) => {
      const weight: Record<string, number> = { 'Emergencial': 5, 'Crítica': 4, 'Alta': 3, 'Média': 2, 'Baixa': 1 };
      return (weight[b.urgencia] || 0) - (weight[a.urgencia] || 0);
    });

    return NextResponse.json({ tasks: filteredTasks });
  } catch (error) {
    console.error('Erro na API de tarefas:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let newTask: Task;

    await mutateProjectData((db) => {
      const lastId = db.tasks.length > 0
        ? Math.max(...db.tasks.map(t => parseInt(t.id.replace('LVM-', ''))))
        : 0;
      const newId = `LVM-${String(lastId + 1).padStart(4, '0')}`;

      newTask = {
        id: newId,
        project: body.project || 'Geral',
        sector: body.sector || 'Gestão',
        subject: body.subject || 'Sem Assunto',
        description: body.description || '',
        responsible: body.responsible || 'Não atribuído',
        secondaryResponsibles: body.secondaryResponsibles || [],
        statusContratacao: body.statusContratacao || 'Indefinido',
        statusAndamento: body.statusAndamento || 'Não iniciado',
        urgencia: body.urgencia || 'Baixa',
        inicio: body.inicio || '',
        previsaoEntrega: body.previsaoEntrega || '',
        entregaEfetiva: body.entregaEfetiva || '',
        situacao: body.situacao || '',
        observacoesRotinas: body.observacoesRotinas || '',
        progress: body.progress || 0,
        subtasks: body.subtasks || [],
        comments: [],
        documents: [],
        dependencies: body.dependencies || [],
        tags: body.tags || [body.sector].filter(Boolean),
        logs: [{ id: `log-${newId}-1`, field: 'criacao', oldValue: 'N/A', newValue: 'Criada', userName: body.userName || 'Sistema', date: new Date().toISOString() }],
      };

      db.tasks.push(newTask!);

      const projTasks = db.tasks.filter(t => t.project.toLowerCase() === newTask!.project.toLowerCase());
      const finished = projTasks.filter(t => t.statusAndamento === 'Finalizado').length;
      const progress = projTasks.length > 0 ? Math.round((finished / projTasks.length) * 100) : 0;
      db.projects = db.projects.map(p =>
        p.name.toLowerCase() === newTask!.project.toLowerCase()
          ? { ...p, progress, status: progress === 100 ? 'Finalizado' : progress > 0 ? 'Em andamento' : 'Não iniciado' }
          : p
      );
    });

    return NextResponse.json({ task: newTask! }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar tarefa:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
