import { NextRequest, NextResponse } from 'next/server';
import { readLinks, incrClick } from '@/lib/db-kv';

// Rota pública de redirecionamento + rastreio de cliques.
// Ex.: /l/hubbeiramar  ->  302 para o destino cadastrado.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const links = await readLinks();
  const link = links.find(l => l.slug === slug);

  if (!link || !link.active) {
    return new NextResponse('Link não encontrado ou desativado.', { status: 404 });
  }

  // Aguarda o incremento: em serverless o fire-and-forget pode ser cortado
  // antes da escrita no KV concluir, perdendo o clique.
  await incrClick(slug);

  return NextResponse.redirect(link.url, 302);
}
