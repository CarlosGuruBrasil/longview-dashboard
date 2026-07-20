import { NextRequest, NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { ensureSchema, sql } from '@/lib/pg';
import { pushRevenda, deleteRevendaRemota } from '@/lib/site-longview-client';
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

    const body = (await request.json()) as { resaleId?: unknown };
    const resaleId = String(body.resaleId ?? '');
    if (!resaleId) {
      return NextResponse.json({ error: 'resaleId é obrigatório.' }, { status: 400 });
    }

    await ensureSchema();
    const rows = await sql<{
      cv_unidade_id: number;
      titulo_publico: string;
      preco_revenda: number | null;
      descricao_publica: string;
      corretor_nome: string;
      corretor_telefone: string;
      corretor_email: string;
      posicao: string;
      vagas: number | null;
    }[]>`
      SELECT cv_unidade_id, titulo_publico, preco_revenda, descricao_publica, corretor_nome, corretor_telefone, corretor_email, posicao, vagas
      FROM site_public_resales
      WHERE id = ${resaleId} AND cv_empreendimento_id = ${empId}
      LIMIT 1
    `;
    const resale = rows[0];
    if (!resale) {
      return NextResponse.json({ error: 'Revenda não encontrada.' }, { status: 404 });
    }

    const unidadeRows = await sql<{ numero: string | null }[]>`
      SELECT numero FROM cv_unidades WHERE id = ${resale.cv_unidade_id} LIMIT 1
    `;
    const unidadeNumero = unidadeRows[0]?.numero ?? undefined;

    try {
      const result = await pushRevenda(empId, {
        unidadeNumero,
        titulo: resale.titulo_publico,
        preco: resale.preco_revenda,
        descricao: resale.descricao_publica,
        corretorNome: resale.corretor_nome,
        corretorTelefone: resale.corretor_telefone,
        corretorEmail: resale.corretor_email,
        posicao: resale.posicao,
        vagas: resale.vagas,
      });

      await sql`
        UPDATE site_public_resales
        SET status_publicacao = 'published',
            metadata = metadata || ${JSON.stringify({ remoteRevendaId: result.revenda.id })}::jsonb,
            updated_at = NOW()
        WHERE id = ${resaleId}
      `;

      return NextResponse.json({ ok: true, remoteRevendaId: result.revenda.id });
    } catch (pushError) {
      logger.error({ pushError, resaleId }, '[site-vision/revendas] falha ao publicar revenda no site real');
      return NextResponse.json(
        { error: `Não foi possível publicar no site real: ${pushError instanceof Error ? pushError.message : pushError}` },
        { status: 502 }
      );
    }
  } catch (error) {
    logger.error({ error }, '[site-vision/revendas] erro ao publicar revenda:');
    return NextResponse.json({ error: 'Erro ao publicar revenda.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const { id } = await params;
    const empId = Number(id);
    if (!Number.isFinite(empId)) {
      return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
    }

    const body = (await request.json()) as { resaleId?: unknown };
    const resaleId = String(body.resaleId ?? '');
    if (!resaleId) {
      return NextResponse.json({ error: 'resaleId é obrigatório.' }, { status: 400 });
    }

    await ensureSchema();
    const rows = await sql<{ metadata: { remoteRevendaId?: number } }[]>`
      SELECT metadata FROM site_public_resales WHERE id = ${resaleId} AND cv_empreendimento_id = ${empId} LIMIT 1
    `;
    const remoteRevendaId = rows[0]?.metadata?.remoteRevendaId;

    if (remoteRevendaId) {
      try {
        await deleteRevendaRemota(remoteRevendaId);
      } catch (deleteError) {
        logger.error({ deleteError, resaleId }, '[site-vision/revendas] falha ao remover revenda do site real');
        return NextResponse.json(
          { error: `Não foi possível remover do site real: ${deleteError instanceof Error ? deleteError.message : deleteError}` },
          { status: 502 }
        );
      }
    }

    await sql`
      UPDATE site_public_resales SET status_publicacao = 'draft', updated_at = NOW() WHERE id = ${resaleId}
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error({ error }, '[site-vision/revendas] erro ao remover revenda:');
    return NextResponse.json({ error: 'Erro ao remover revenda.' }, { status: 500 });
  }
}
