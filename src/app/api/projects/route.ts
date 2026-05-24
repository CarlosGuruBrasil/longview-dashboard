import { NextRequest, NextResponse } from 'next/server';
import { readProjectData, writeProjectData, Project } from '@/lib/db-kv';

export async function GET(request: NextRequest) {
  try {
    const db = await readProjectData();
    return NextResponse.json({ projects: db.projects || [] });
  } catch (error) {
    console.error('Erro na API de empreendimentos:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, banner } = body;

    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    const db = await readProjectData();
    const idx = db.projects.findIndex(p => p.id === id);
    if (idx === -1) return NextResponse.json({ error: 'Empreendimento não encontrado' }, { status: 404 });

    if (banner !== undefined) db.projects[idx].banner = banner;

    await writeProjectData(db);
    return NextResponse.json({ project: db.projects[idx] });
  } catch (error) {
    console.error('Erro ao atualizar empreendimento:', error);
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await readProjectData();

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }

    const id = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    
    if (db.projects.some(p => p.id === id)) {
      return NextResponse.json({ error: 'Já existe um empreendimento com este nome' }, { status: 400 });
    }

    const newProject: Project = {
      id,
      name,
      description: body.description?.trim() || 'Empreendimento cadastrado no LongView Manager.',
      status: 'Não iniciado',
      progress: 0,
      banner: body.banner || ''
    };

    db.projects.push(newProject);
    await writeProjectData(db);

    return NextResponse.json({ project: newProject }, { status: 201 });
  } catch (error) {
    console.error('Erro ao cadastrar empreendimento:', error);
    return NextResponse.json({ error: 'Erro ao cadastrar empreendimento' }, { status: 500 });
  }
}
