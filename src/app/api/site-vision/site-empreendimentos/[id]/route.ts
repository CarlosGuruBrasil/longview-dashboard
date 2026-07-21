import { NextRequest, NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { fetchEmpreendimentoDetailById, updateEmpreendimentoManual } from '@/lib/site-longview-client';
import logger from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const { id } = await params;
  const empId = Number(id);
  if (!Number.isFinite(empId)) {
    return NextResponse.json({ error: 'ID invalido.' }, { status: 400 });
  }

  const empreendimento = await fetchEmpreendimentoDetailById(empId);
  if (!empreendimento) {
    return NextResponse.json({ error: 'Empreendimento nao encontrado no site real.' }, { status: 404 });
  }
  return NextResponse.json({ empreendimento });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const { id } = await params;
  const empId = Number(id);
  if (!Number.isFinite(empId)) {
    return NextResponse.json({ error: 'ID invalido.' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const result = await updateEmpreendimentoManual(empId, body);
    return NextResponse.json(result);
  } catch (error) {
    logger.error({ error }, '[site-vision/site-empreendimentos/:id] erro ao atualizar:');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar empreendimento.' },
      { status: 502 }
    );
  }
}
