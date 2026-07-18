import { NextRequest, NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { ensureSchema, sql } from '@/lib/pg';
import { pushMidia } from '@/lib/site-longview-client';
import logger from '@/lib/logger';
import { randomUUID } from 'crypto';

type Params = { params: Promise<{ id: string }> };

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest, { params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    await ensureSchema();
    const { id } = await params;
    const empId = Number(id);
    if (!Number.isFinite(empId)) {
      return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Apenas imagens são permitidas.' }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'Arquivo muito grande (máx. 5MB).' }, { status: 413 });
    }

    // empId aqui é o cv_crm_id (usado pra localizar o empreendimento no site real)
    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`;
    const altText = (formData.get('altText') as string) || file.name;

    const pushed = await pushMidia(empId, { tipo: 'foto', dataUrl, descricao: altText });

    const [siteRows] = await Promise.all([
      sql<{ id: string }[]>`
        SELECT id FROM site_public_empreendimentos
        WHERE crm_empreendimento_id = ${empId}
        LIMIT 1
      `,
    ]);

    const mediaId = randomUUID();
    if (siteRows[0]) {
      const siteProjectId = siteRows[0].id;
      await sql`
        INSERT INTO site_public_media_assets (
          id, empreendimento_id, kind, origin, title, alt_text,
          public_url, thumbnail_url, mime_type, is_primary, sort_order,
          metadata, created_at, updated_at
        ) VALUES (
          ${mediaId}, ${siteProjectId}, 'image', 'upload', ${file.name}, ${altText},
          ${pushed.midia.url_storage}, ${pushed.midia.url_storage}, ${file.type}, false,
          (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM site_public_media_assets WHERE empreendimento_id = ${siteProjectId}),
          ${sql.json({ siteLongviewMidiaId: pushed.midia.id })}, NOW(), NOW()
        )
      `;
    }

    logger.info({ empId, siteLongviewMidiaId: pushed.midia.id, fileName: file.name }, '[site-vision/media/upload] pushed to site real');

    return NextResponse.json({
      id: mediaId,
      nome: file.name,
      url: pushed.midia.url_storage,
      tipo: file.type,
    });
  } catch (error) {
    logger.error({ error }, '[site-vision/media/upload] error');
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao fazer upload.' }, { status: 500 });
  }
}
