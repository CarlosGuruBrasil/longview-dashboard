import { NextRequest, NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { deleteRevendaRemota, fetchRevendaAdminById, updateRevenda } from '@/lib/site-longview-client';
import logger from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const { id } = await params;
    const revendaId = Number(id);
    if (!Number.isFinite(revendaId)) {
      return NextResponse.json({ error: 'ID invalido.' }, { status: 400 });
    }
    const revenda = await fetchRevendaAdminById(revendaId);
    return NextResponse.json({ revenda });
  } catch (error) {
    logger.error({ error }, '[site-vision/site-revendas/:id] erro ao buscar revenda:');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar revenda.' },
      { status: 502 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const { id } = await params;
    const revendaId = Number(id);
    if (!Number.isFinite(revendaId)) {
      return NextResponse.json({ error: 'ID invalido.' }, { status: 400 });
    }
    const body = await request.json();
    const result = await updateRevenda(revendaId, body);
    return NextResponse.json(result);
  } catch (error) {
    logger.error({ error }, '[site-vision/site-revendas/:id] erro ao atualizar revenda:');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar revenda.' },
      { status: 502 }
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const { id } = await params;
    const revendaId = Number(id);
    if (!Number.isFinite(revendaId)) {
      return NextResponse.json({ error: 'ID invalido.' }, { status: 400 });
    }
    const result = await deleteRevendaRemota(revendaId);
    return NextResponse.json(result);
  } catch (error) {
    logger.error({ error }, '[site-vision/site-revendas/:id] erro ao remover revenda:');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao remover revenda.' },
      { status: 502 }
    );
  }
}
