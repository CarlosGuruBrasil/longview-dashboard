import { NextRequest, NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { ensureSchema, sql } from '@/lib/pg';
import logger from '@/lib/logger';

type Params = { params: Promise<unknown> };

function toSlugPiece(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

async function ensureSiteProjectRow(empreendimentoId: number) {
  const crmRows = await sql<{ id: number; nome: string; raw: Record<string, unknown> }[]>`
    SELECT id, nome, raw
    FROM cv_empreendimentos
    WHERE id = ${empreendimentoId}
    LIMIT 1
  `;
  const crm = crmRows[0];
  if (!crm) return null;

  const currentRows = await sql<{ id: string }[]>`
    SELECT id
    FROM site_public_empreendimentos
    WHERE crm_empreendimento_id = ${empreendimentoId}
    LIMIT 1
  `;

  const existing = currentRows[0];
  if (existing) return existing.id;

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
      kind?: unknown;
      title?: unknown;
      altText?: unknown;
      publicUrl?: unknown;
      thumbnailUrl?: unknown;
      mimeType?: unknown;
      origin?: unknown;
    };

    const publicUrl = String(body.publicUrl ?? '').trim();
    if (!publicUrl) {
      return NextResponse.json({ error: 'Informe a URL pública da mídia.' }, { status: 400 });
    }

    await ensureSchema();
    const siteProjectId = await ensureSiteProjectRow(empreendimentoId);
    if (!siteProjectId) {
      return NextResponse.json({ error: 'Empreendimento não encontrado.' }, { status: 404 });
    }

    const maxOrderRows = await sql<{ max_order: number | null }[]>`
      SELECT MAX(sort_order) AS max_order
      FROM site_public_media_assets
      WHERE empreendimento_id = ${siteProjectId}
    `;

    const kind = ['image', 'video', 'brochure', 'floorplan', 'document', 'logo'].includes(String(body.kind))
      ? String(body.kind)
      : 'image';
    const origin = ['upload', 'cvcrm', 'external', 'legacy'].includes(String(body.origin))
      ? String(body.origin)
      : publicUrl.startsWith('data:') ? 'upload' : 'external';
    const title = String(body.title ?? '').trim();
    const assetId = `media-${empreendimentoId}-${toSlugPiece(title || kind || 'asset')}-${Date.now()}`;
    const sortOrder = (maxOrderRows[0]?.max_order ?? -1) + 1;

    await sql`
      INSERT INTO site_public_media_assets (
        id, empreendimento_id, kind, origin, title, alt_text, public_url, thumbnail_url, mime_type, is_primary, sort_order, metadata, created_at, updated_at
      ) VALUES (
        ${assetId},
        ${siteProjectId},
        ${kind},
        ${origin},
        ${title},
        ${String(body.altText ?? '').trim()},
        ${publicUrl},
        ${String(body.thumbnailUrl ?? publicUrl).trim()},
        ${String(body.mimeType ?? '').trim()},
        false,
        ${sortOrder},
        '{}'::jsonb,
        NOW(),
        NOW()
      )
    `;

    return NextResponse.json({ ok: true, id: assetId });
  } catch (error) {
    logger.error({ error }, '[site-vision/media] erro ao criar mídia:');
    return NextResponse.json({ error: 'Erro ao cadastrar mídia.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const { id } = (await params) as { id: string };
    const empreendimentoId = Number(id);
    if (!Number.isFinite(empreendimentoId)) {
      return NextResponse.json({ error: 'Empreendimento inválido.' }, { status: 400 });
    }

    const body = (await request.json()) as {
      mediaId?: unknown;
      action?: unknown;
      orderedIds?: unknown;
    };

    const mediaId = String(body.mediaId ?? '').trim();
    const action = String(body.action ?? '').trim();
    if (!action) {
      return NextResponse.json({ error: 'Informe action.' }, { status: 400 });
    }

    if (action === 'reorder') {
      const orderedIds = Array.isArray(body.orderedIds)
        ? body.orderedIds.map((item) => String(item).trim()).filter(Boolean)
        : [];

      if (orderedIds.length === 0) {
        return NextResponse.json({ error: 'Informe orderedIds.' }, { status: 400 });
      }

      const siteProjectId = await ensureSiteProjectRow(empreendimentoId);
      if (!siteProjectId) {
        return NextResponse.json({ error: 'Empreendimento não encontrado.' }, { status: 404 });
      }

      const existingRows = await sql<{ id: string }[]>`
        SELECT id
        FROM site_public_media_assets
        WHERE empreendimento_id = ${siteProjectId}
        ORDER BY sort_order ASC, created_at ASC
      `;

      const existingIds = new Set(existingRows.map((row) => row.id));
      const normalizedIds = orderedIds.filter((id) => existingIds.has(id));

      if (normalizedIds.length !== existingRows.length) {
        const missingIds = existingRows.map((row) => row.id).filter((id) => !normalizedIds.includes(id));
        normalizedIds.push(...missingIds);
      }

      for (const [index, id] of normalizedIds.entries()) {
        await sql`
          UPDATE site_public_media_assets
          SET sort_order = ${index}, updated_at = NOW()
          WHERE id = ${id}
        `;
      }

      return NextResponse.json({ ok: true });
    }

    if (!mediaId) {
      return NextResponse.json({ error: 'Informe mediaId.' }, { status: 400 });
    }

    await ensureSchema();
    const rows = await sql<{
      id: string;
      empreendimento_id: string;
      sort_order: number;
      public_url: string;
    }[]>`
      SELECT id, empreendimento_id, sort_order, public_url
      FROM site_public_media_assets
      WHERE id = ${mediaId}
      LIMIT 1
    `;

    const current = rows[0];
    if (!current) return NextResponse.json({ error: 'Mídia não encontrada.' }, { status: 404 });

    if (action === 'primary') {
      await sql`UPDATE site_public_media_assets SET is_primary = false, updated_at = NOW() WHERE empreendimento_id = ${current.empreendimento_id}`;
      await sql`UPDATE site_public_media_assets SET is_primary = true, updated_at = NOW() WHERE id = ${mediaId}`;
      await sql`
        UPDATE site_public_empreendimentos
        SET hero_image_url = ${current.public_url}, updated_at = NOW()
        WHERE id = ${current.empreendimento_id}
      `;
      return NextResponse.json({ ok: true });
    }

    if (action === 'up' || action === 'down') {
      const neighborRows = action === 'up'
        ? await sql<{
            id: string;
            sort_order: number;
          }[]>`
            SELECT id, sort_order
            FROM site_public_media_assets
            WHERE empreendimento_id = ${current.empreendimento_id}
              AND sort_order < ${current.sort_order}
            ORDER BY sort_order DESC
            LIMIT 1
          `
        : await sql<{
            id: string;
            sort_order: number;
          }[]>`
            SELECT id, sort_order
            FROM site_public_media_assets
            WHERE empreendimento_id = ${current.empreendimento_id}
              AND sort_order > ${current.sort_order}
            ORDER BY sort_order ASC
            LIMIT 1
          `;

      const neighbor = neighborRows[0];
      if (!neighbor) return NextResponse.json({ ok: true, unchanged: true });

      await sql`UPDATE site_public_media_assets SET sort_order = ${neighbor.sort_order}, updated_at = NOW() WHERE id = ${current.id}`;
      await sql`UPDATE site_public_media_assets SET sort_order = ${current.sort_order}, updated_at = NOW() WHERE id = ${neighbor.id}`;
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete') {
      await sql`DELETE FROM site_public_media_assets WHERE id = ${mediaId}`;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (error) {
    logger.error({ error }, '[site-vision/media] erro ao atualizar mídia:');
    return NextResponse.json({ error: 'Erro ao atualizar mídia.' }, { status: 500 });
  }
}
