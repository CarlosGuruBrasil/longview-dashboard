import { NextRequest, NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { pushRevendaMidia } from '@/lib/site-longview-client';
import logger from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const { id } = await params;
    const revendaId = Number(id);
    if (!Number.isFinite(revendaId)) {
      return NextResponse.json({ error: 'ID invalido.' }, { status: 400 });
    }

    const body = await request.json();
    if (!body.dataUrl || !body.tipo) {
      return NextResponse.json({ error: 'tipo e dataUrl sao obrigatorios.' }, { status: 400 });
    }

    const result = await pushRevendaMidia(revendaId, body);
    return NextResponse.json(result);
  } catch (error) {
    logger.error({ error }, '[site-vision/site-revendas/:id/midias] erro ao enviar midia:');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao enviar midia.' },
      { status: 502 }
    );
  }
}
