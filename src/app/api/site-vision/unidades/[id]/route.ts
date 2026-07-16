import { NextRequest, NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { ensureSchema, sql } from '@/lib/pg';
import logger from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const { id } = await params;
    const unidadeId = Number(id);
    if (!Number.isFinite(unidadeId)) {
      return NextResponse.json({ error: 'ID da unidade inválido.' }, { status: 400 });
    }

    const body = (await request.json()) as { visibleOnSite?: unknown };
    if (typeof body.visibleOnSite !== 'boolean') {
      return NextResponse.json({ error: 'Informe visibleOnSite como boolean.' }, { status: 400 });
    }

    await ensureSchema();

    const unitRows = await sql<{
      id: number;
      id_empreendimento: number | null;
      status: string | null;
    }[]>`
      SELECT id, id_empreendimento, status
      FROM cv_unidades
      WHERE id = ${unidadeId}
      LIMIT 1
    `;

    const unit = unitRows[0];
    if (!unit?.id_empreendimento) {
      return NextResponse.json({ error: 'Unidade não encontrada.' }, { status: 404 });
    }

    await sql`
      INSERT INTO site_public_unit_visibility (
        cv_unidade_id,
        cv_empreendimento_id,
        visible_on_site,
        updated_by,
        updated_at
      ) VALUES (
        ${unidadeId},
        ${unit.id_empreendimento},
        ${body.visibleOnSite},
        ${user.name},
        NOW()
      )
      ON CONFLICT (cv_unidade_id) DO UPDATE SET
        visible_on_site = EXCLUDED.visible_on_site,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at
    `;

    return NextResponse.json({
      ok: true,
      unidadeId,
      empreendimentoId: unit.id_empreendimento,
      visibleOnSite: body.visibleOnSite,
      status: unit.status,
    });
  } catch (error) {
    logger.error({ error }, '[site-vision/unidades] erro ao atualizar visibilidade:');
    return NextResponse.json({ error: 'Erro ao atualizar visibilidade da unidade.' }, { status: 500 });
  }
}
