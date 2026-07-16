import { NextRequest, NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { ensureSchema, sql } from '@/lib/pg';
import logger from '@/lib/logger';

type Params = { params: Promise<unknown> };

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function getSiteProjectId(empreendimentoId: number) {
  const rows = await sql<{ id: string }[]>`
    SELECT id
    FROM site_public_empreendimentos
    WHERE crm_empreendimento_id = ${empreendimentoId}
    LIMIT 1
  `;
  const existing = rows[0]?.id;
  if (existing) return existing;

  const crmRows = await sql<{ id: number; nome: string; raw: Record<string, unknown> }[]>`
    SELECT id, nome, raw
    FROM cv_empreendimentos
    WHERE id = ${empreendimentoId}
    LIMIT 1
  `;
  const crm = crmRows[0];
  if (!crm) return null;

  const rowId = `site-emp-${empreendimentoId}`;
  await sql`
    INSERT INTO site_public_empreendimentos (
      id, slug, nome, crm_empreendimento_id, cidade, bairro, status_publicacao, updated_at
    ) VALUES (
      ${rowId},
      ${`empreendimento-${empreendimentoId}`},
      ${crm.nome},
      ${empreendimentoId},
      ${String(crm.raw?.cidade ?? '')},
      ${String(crm.raw?.bairro ?? '')},
      'draft',
      NOW()
    )
    ON CONFLICT (id) DO NOTHING
  `;
  return rowId;
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const { id } = (await params) as { id: string };
    const empreendimentoId = Number(id);
    if (!Number.isFinite(empreendimentoId)) {
      return NextResponse.json({ error: 'Empreendimento inválido.' }, { status: 400 });
    }

    const body = (await request.json()) as {
      title?: unknown;
      type?: unknown;
      publicUrl?: unknown;
      thumbnailUrl?: unknown;
      leadTag?: unknown;
    };

    const title = String(body.title ?? '').trim();
    const publicUrl = String(body.publicUrl ?? '').trim();
    if (!title || !publicUrl) {
      return NextResponse.json({ error: 'Informe título e URL pública do material.' }, { status: 400 });
    }

    await ensureSchema();
    const siteProjectId = await getSiteProjectId(empreendimentoId);
    if (!siteProjectId) {
      return NextResponse.json({ error: 'Empreendimento não encontrado.' }, { status: 404 });
    }
    const assetType = ['ebook', 'brochure', 'document'].includes(String(body.type)) ? String(body.type) : 'ebook';
    const assetId = `gated-${empreendimentoId}-${Date.now()}`;
    const slug = slugify(`${title}-${empreendimentoId}`);

    await sql`
      INSERT INTO site_public_gated_assets (
        id, site_empreendimento_id, title, slug, asset_type, public_url, thumbnail_url, mime_type, active, lead_tag, metadata, created_at, updated_at
      ) VALUES (
        ${assetId},
        ${siteProjectId},
        ${title},
        ${slug},
        ${assetType},
        ${publicUrl},
        ${String(body.thumbnailUrl ?? '').trim()},
        '',
        true,
        ${String(body.leadTag ?? 'ebook').trim() || 'ebook'},
        '{}'::jsonb,
        NOW(),
        NOW()
      )
    `;

    return NextResponse.json({ ok: true, id: assetId, slug });
  } catch (error) {
    logger.error({ error }, '[site-vision/gated-assets] erro ao criar material:');
    return NextResponse.json({ error: 'Erro ao cadastrar material gated.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const body = (await request.json()) as {
      assetId?: unknown;
      active?: unknown;
      delete?: unknown;
    };

    const assetId = String(body.assetId ?? '').trim();
    if (!assetId) {
      return NextResponse.json({ error: 'Informe assetId.' }, { status: 400 });
    }

    await ensureSchema();

    if (body.delete === true) {
      await sql`DELETE FROM site_public_gated_assets WHERE id = ${assetId}`;
      return NextResponse.json({ ok: true });
    }

    if (typeof body.active === 'boolean') {
      await sql`UPDATE site_public_gated_assets SET active = ${body.active}, updated_at = NOW() WHERE id = ${assetId}`;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Nenhuma alteração válida informada.' }, { status: 400 });
  } catch (error) {
    logger.error({ error }, '[site-vision/gated-assets] erro ao atualizar material:');
    return NextResponse.json({ error: 'Erro ao atualizar material gated.' }, { status: 500 });
  }
}
