import { NextRequest, NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { reorderRevendaMidias } from '@/lib/site-longview-client';
import logger from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const { id } = await params;
    const revendaId = Number(id);
    if (!Number.isFinite(revendaId)) {
      return NextResponse.json({ error: 'ID invalido.' }, { status: 400 });
    }
    const body = (await request.json()) as { ordem?: Array<{ id: number; ordem: number }> };
    if (!Array.isArray(body.ordem)) {
      return NextResponse.json({ error: 'ordem deve ser uma lista.' }, { status: 400 });
    }
    const result = await reorderRevendaMidias(revendaId, body.ordem);
    return NextResponse.json(result);
  } catch (error) {
    logger.error({ error }, '[site-vision/site-revendas/:id/midias/ordem] erro ao reordenar:');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao reordenar midias.' },
      { status: 502 }
    );
  }
}
