import { NextRequest, NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { sql } from '@/lib/pg';
import logger from '@/lib/logger';
import { randomUUID } from 'crypto';

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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Apenas imagens são permitidas.' }, { status: 400 });
    }

    // Verificar se já tem site_public_empreendimentos
    const [siteRows] = await Promise.all([
      sql<{ id: string }[]>`
        SELECT id FROM site_public_empreendimentos 
        WHERE crm_empreendimento_id = ${empId}
        LIMIT 1
      `,
    ]);

    if (!siteRows[0]) {
      return NextResponse.json(
        { error: 'Este empreendimento ainda não foi publicado. Publique antes de adicionar imagens.' },
        { status: 400 }
      );
    }

    const siteProjectId = siteRows[0].id;
    const mediaId = randomUUID();

    // Salvar em site_public_media_assets
    await sql`
      INSERT INTO site_public_media_assets (
        id, empreendimento_id, kind, title, alt_text, 
        public_url, thumbnail_url, is_primary, sort_order,
        created_at, updated_at
      ) VALUES (
        ${mediaId},
        ${siteProjectId},
        'image',
        ${file.name},
        ${formData.get('altText') || file.name},
        ${`/api/site-vision/empreendimentos/${empId}/media/${mediaId}`},
        ${`/api/site-vision/empreendimentos/${empId}/media/${mediaId}/thumb`},
        false,
        (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM site_public_media_assets WHERE empreendimento_id = ${siteProjectId})
      )
    `;

    logger.info({ empId, mediaId, fileName: file.name }, '[site-vision/media/upload] success');

    return NextResponse.json({
      id: mediaId,
      nome: file.name,
      tipo: file.type,
    });
  } catch (error) {
    logger.error({ error }, '[site-vision/media/upload] error');
    return NextResponse.json({ error: 'Erro ao fazer upload.' }, { status: 500 });
  }
}
