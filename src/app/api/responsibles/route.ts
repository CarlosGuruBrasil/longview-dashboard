import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { readProjectData, mutateProjectData, Responsible } from '@/lib/db-kv';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const db = await readProjectData();
    return NextResponse.json({ responsibles: db.responsibles || [] });
  } catch (error) {
    console.error('Erro na API de responsáveis:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const body = await request.json();
    let newResponsible: Responsible | undefined;

    await mutateProjectData((db) => {
      if (!db.responsibles) db.responsibles = [];
      const lastId = db.responsibles.length > 0
        ? Math.max(...db.responsibles.map(r => parseInt(r.id.replace('resp-', '')) || 0))
        : 0;
      newResponsible = {
        id: `resp-${lastId + 1}`,
        name: body.name.trim(),
        phone: body.phone.trim() || '',
        email: body.email.trim() || '',
        company: body.company.trim() || 'LongView',
        photo: body.photo || undefined,
      };
      db.responsibles.push(newResponsible!);
    });

    return NextResponse.json({ responsible: newResponsible }, { status: 201 });
  } catch (error) {
    console.error('Erro ao cadastrar responsável:', error);
    return NextResponse.json({ error: 'Erro ao processar requisição' }, { status: 500 });
  }
}
