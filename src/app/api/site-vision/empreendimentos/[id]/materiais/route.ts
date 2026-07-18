import { NextRequest, NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { pushMaterial, deleteMaterial } from '@/lib/site-longview-client';
import logger from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const { id } = await params;
    const empId = Number(id);
    if (!Number.isFinite(empId)) {
      return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
    }

    const body = (await request.json()) as {
      tipo?: unknown;
      titulo?: unknown;
      descricao?: unknown;
      url?: unknown;
      dataUrl?: unknown;
    };

    if (body.tipo !== 'material' && body.tipo !== 'planta' && body.tipo !== 'ebook') {
      return NextResponse.json({ error: "tipo deve ser 'material', 'planta' ou 'ebook'." }, { status: 400 });
    }
    if (typeof body.titulo !== 'string' || !body.titulo.trim()) {
      return NextResponse.json({ error: 'titulo é obrigatório.' }, { status: 400 });
    }

    const descricao = typeof body.descricao === 'string' ? body.descricao : undefined;
    const result = typeof body.url === 'string' && body.url.trim()
      ? await pushMaterial(empId, { tipo: body.tipo, titulo: body.titulo, descricao, url: body.url })
      : typeof body.dataUrl === 'string'
        ? await pushMaterial(empId, { tipo: body.tipo, titulo: body.titulo, descricao, dataUrl: body.dataUrl })
        : null;

    if (!result) {
      return NextResponse.json({ error: "Informe 'url' (material do CRM) ou 'dataUrl' (upload manual)." }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error({ error }, '[site-vision/materiais] falha ao publicar material');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao publicar material.' },
      { status: 502 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const body = (await request.json()) as { materialId?: unknown };
    const materialId = Number(body.materialId);
    if (!Number.isFinite(materialId)) {
      return NextResponse.json({ error: 'materialId inválido.' }, { status: 400 });
    }

    const result = await deleteMaterial(materialId);
    return NextResponse.json(result);
  } catch (error) {
    logger.error({ error }, '[site-vision/materiais] falha ao remover material');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao remover material.' },
      { status: 502 }
    );
  }
}
