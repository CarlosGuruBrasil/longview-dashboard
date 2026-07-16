import { NextResponse } from 'next/server';
import { listPublishedProjects } from '@/lib/site-public';
import logger from '@/lib/logger';

export async function GET() {
  try {
    const projects = await listPublishedProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    logger.error({ error }, '[public/site/empreendimentos] erro ao listar empreendimentos:');
    return NextResponse.json({ error: 'Erro ao carregar empreendimentos publicados.' }, { status: 500 });
  }
}
