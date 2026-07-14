import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { readProjects, readProjectById, upsertProject, slugify, type Project } from '@/lib/db-kv';
import logger from '@/lib/logger'

export async function GET(_request: NextRequest) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const projects = await readProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    logger.error({ error }, 'Erro na API de empreendimentos:');
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const body = await request.json();
    const { id, banner } = body;
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    const existing = await readProjectById(id);
    if (!existing) return NextResponse.json({ error: 'Empreendimento não encontrado' }, { status: 404 });

    const updated: Project = { ...existing, banner: banner !== undefined ? banner : existing.banner };
    await upsertProject(updated);

    return NextResponse.json({ project: updated });
  } catch (error) {
    logger.error({ error }, 'Erro ao atualizar empreendimento:');
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const body = await request.json();
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });

    const id = slugify(name);
    const conflict = await readProjectById(id);
    if (conflict) return NextResponse.json({ error: 'Já existe um empreendimento com este nome' }, { status: 400 });

    const newProject: Project = { id, name, description: body.description?.trim() || 'Empreendimento cadastrado no LongView Manager.', status: 'Não iniciado', progress: 0, banner: body.banner || '' };
    await upsertProject(newProject);

    return NextResponse.json({ project: newProject }, { status: 201 });
  } catch (error) {
    logger.error({ error }, 'Erro ao cadastrar empreendimento:');
    return NextResponse.json({ error: 'Erro ao cadastrar empreendimento' }, { status: 500 });
  }
}
