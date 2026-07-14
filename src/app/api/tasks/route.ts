import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { readTasks, nextTaskId, upsertTask, readProjectById, type Task } from '@/lib/db-kv';
import logger from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const p = request.nextUrl.searchParams;
    const tasks = await readTasks({
      project:           p.get('project')           ?? undefined,
      projectId:         p.get('projectId')          ?? undefined,
      sector:            p.get('sector')             ?? undefined,
      status:            p.get('status')             ?? undefined,
      urgencia:          p.get('urgencia')           ?? undefined,
      responsible:       p.get('responsible')        ?? undefined,
      statusContratacao: p.get('statusContratacao')  ?? undefined,
      q:                 p.get('q')                  ?? undefined,
    });

    const weight: Record<string, number> = { Emergencial: 5, Crítica: 4, Alta: 3, Média: 2, Baixa: 1 };
    tasks.sort((a, b) => (weight[b.urgencia] || 0) - (weight[a.urgencia] || 0));

    return NextResponse.json({ tasks });
  } catch (error) {
    logger.error({ error }, '[GET /api/tasks]');
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const body = await request.json();
    const projectId = body.projectId as string | undefined;
    if (!projectId) return NextResponse.json({ error: 'projectId é obrigatório' }, { status: 400 });
    const project = await readProjectById(projectId);
    if (!project) return NextResponse.json({ error: 'Empreendimento não encontrado' }, { status: 400 });

    const id = await nextTaskId();

    const task: Task = {
      id,
      project:              project.name,
      projectId:            project.id,
      sector:               body.sector               || 'Gestão',
      subject:              body.subject              || 'Sem Assunto',
      description:          body.description          || '',
      responsible:          body.responsible          || 'Não atribuído',
      secondaryResponsibles: body.secondaryResponsibles || [],
      statusContratacao:    body.statusContratacao    || 'Indefinido',
      statusAndamento:      body.statusAndamento      || 'Não iniciado',
      urgencia:             body.urgencia             || 'Baixa',
      inicio:               body.inicio               || '',
      previsaoEntrega:      body.previsaoEntrega      || '',
      entregaEfetiva:       body.entregaEfetiva       || '',
      situacao:             body.situacao             || '',
      observacoesRotinas:   body.observacoesRotinas   || '',
      progress:             body.progress             || 0,
      subtasks:             body.subtasks             || [],
      comments:             [],
      documents:            [],
      dependencies:         body.dependencies         || [],
      tags:                 body.tags                 || [body.sector].filter(Boolean),
      logs: [{
        id:       `log-${id}-1`,
        field:    'criacao',
        oldValue: 'N/A',
        newValue: 'Criada',
        userName: user.name || 'Sistema',
        date:     new Date().toISOString(),
      }],
    };

    await upsertTask(task);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    logger.error({ error }, '[POST /api/tasks]');
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
