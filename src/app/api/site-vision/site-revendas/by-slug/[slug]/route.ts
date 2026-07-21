import { NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { fetchRevendaPublica } from '@/lib/site-longview-client';

type Params = { params: Promise<{ slug: string }> };

// Usado pra carregar os dados completos de uma revenda no formulario de edicao
// do admin — reaproveita o GET publico do site real (mesma fonte de verdade).
export async function GET(_request: Request, { params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const { slug } = await params;
  const revenda = await fetchRevendaPublica(slug);
  if (!revenda) {
    return NextResponse.json({ error: 'Revenda nao encontrada no site real.' }, { status: 404 });
  }
  return NextResponse.json({ revenda });
}
