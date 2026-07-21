import { NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { deleteRevendaMidiaRemota } from '@/lib/site-longview-client';
import logger from '@/lib/logger';

type Params = { params: Promise<{ midiaId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const { midiaId } = await params;
    const id = Number(midiaId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'ID invalido.' }, { status: 400 });
    }
    const result = await deleteRevendaMidiaRemota(id);
    return NextResponse.json(result);
  } catch (error) {
    logger.error({ error }, '[site-vision/site-revendas/midias/:midiaId] erro ao remover midia:');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao remover midia.' },
      { status: 502 }
    );
  }
}
