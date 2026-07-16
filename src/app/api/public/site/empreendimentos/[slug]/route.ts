import { NextResponse } from 'next/server';
import { getPublishedProjectBySlug } from '@/lib/site-public';
import logger from '@/lib/logger';

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const project = await getPublishedProjectBySlug(slug);
    if (!project) {
      return NextResponse.json({ error: 'Empreendimento não encontrado.' }, { status: 404 });
    }
    return NextResponse.json({ project });
  } catch (error) {
    logger.error({ error }, '[public/site/empreendimentos/[slug]] erro ao carregar detalhe:');
    return NextResponse.json({ error: 'Erro ao carregar o empreendimento.' }, { status: 500 });
  }
}
