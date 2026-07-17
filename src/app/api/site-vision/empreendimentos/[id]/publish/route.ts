import { NextRequest, NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { sql } from '@/lib/pg';
import logger from '@/lib/logger';
import { randomUUID } from 'crypto';

type Params = { params: Promise<{ id: string }> };

interface PublishPayload {
  status: 'draft' | 'published' | 'archived';
  exibirNaHome: boolean;
  destaque: boolean;
  heroImageId?: string | null;
  unidadesVisiveis: number[]; // IDs das unidades que aparecem
  headlinePublico?: string;
  descricaoCurta?: string;
  ctaLabel?: string;
  ctaTarget?: string;
  metadata?: Record<string, unknown>;
}


export async function POST(request: NextRequest, { params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const { id } = await params;
    const empId = Number(id);
    if (!Number.isFinite(empId)) {
      return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
    }

    const body = (await request.json()) as PublishPayload;

    // Buscar empreendimento do CRM pra pegar dados base
    const [crmRows] = await Promise.all([
      sql<{ id: number; nome: string; raw: unknown }[]>`
        SELECT id, nome, raw FROM cv_empreendimentos WHERE id = ${empId} LIMIT 1
      `,
    ]);

    if (!crmRows[0]) {
      return NextResponse.json({ error: 'Empreendimento não encontrado no CRM.' }, { status: 404 });
    }

    const crm = crmRows[0];
    const crmRaw = typeof crm.raw === 'string' ? JSON.parse(crm.raw) : crm.raw;

    // Slug: converter nome pra slug seguro
    const slug = (body.ctaTarget || crm.nome)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Verificar se já existe site_public_empreendimentos pra este CRM project
    const [existingRows] = await Promise.all([
      sql<{ id: string }[]>`
        SELECT id FROM site_public_empreendimentos 
        WHERE crm_empreendimento_id = ${empId}
        LIMIT 1
      `,
    ]);

    let siteProjectId: string;

    if (existingRows[0]) {
      // Atualizar existing
      siteProjectId = existingRows[0].id;
      await sql`
        UPDATE site_public_empreendimentos
        SET
          status_publicacao = ${body.status},
          exibir_na_home = ${body.exibirNaHome},
          destaque = ${body.destaque},
          headline = ${body.headlinePublico || crmRaw.headline || crm.nome},
          resumo = ${body.descricaoCurta || crmRaw.resumo || ''},
          descricao = ${body.descricaoCurta || crmRaw.resumo || ''},
          cta_label = ${body.ctaLabel || 'Ver detalhes'},
          cta_target = ${body.ctaTarget || slug},
          metadata = ${JSON.stringify(body.metadata || {})},
          updated_at = NOW()
        WHERE id = ${siteProjectId}
      `;
    } else {
      // Criar novo
      siteProjectId = randomUUID();
      await sql`
        INSERT INTO site_public_empreendimentos (
          id, crm_empreendimento_id, slug, nome, status_publicacao,
          exibir_na_home, destaque, cidade, bairro,
          headline, resumo, descricao, cta_label, cta_target,
          metadata, created_at, updated_at
        ) VALUES (
          ${siteProjectId},
          ${empId},
          ${slug},
          ${crm.nome},
          ${body.status},
          ${body.exibirNaHome},
          ${body.destaque},
          ${crmRaw.cidade || 'São Paulo'},
          ${crmRaw.bairro || ''},
          ${body.headlinePublico || crmRaw.headline || crm.nome},
          ${body.descricaoCurta || crmRaw.resumo || ''},
          ${body.descricaoCurta || crmRaw.resumo || ''},
          ${body.ctaLabel || 'Ver detalhes'},
          ${body.ctaTarget || slug},
          ${JSON.stringify(body.metadata || {})},
          NOW(),
          NOW()
        )
      `;
    }

    // Configurar visibilidade das unidades
    if (body.unidadesVisiveis && body.unidadesVisiveis.length > 0) {
      // Desmarcar todas primeiro
      await sql`
        UPDATE site_public_unit_visibility
        SET visible_on_site = false
        WHERE cv_empreendimento_id = ${empId}
      `;

      // Marcar as selecionadas
      for (const unitId of body.unidadesVisiveis) {
        await sql`
          INSERT INTO site_public_unit_visibility (cv_unidade_id, cv_empreendimento_id, visible_on_site)
          VALUES (${unitId}, ${empId}, true)
          ON CONFLICT (cv_unidade_id, cv_empreendimento_id) DO UPDATE SET visible_on_site = true
        `;
      }
    }

    // Se tiver heroImageId, marcar como primary
    if (body.heroImageId) {
      await sql`
        UPDATE site_public_media_assets
        SET is_primary = false
        WHERE empreendimento_id = ${siteProjectId}
      `;

      await sql`
        UPDATE site_public_media_assets
        SET is_primary = true
        WHERE id = ${body.heroImageId} AND empreendimento_id = ${siteProjectId}
      `;
    }

    logger.info(
      { empId, siteProjectId, status: body.status, unidades: body.unidadesVisiveis?.length },
      '[site-vision/publish] success'
    );

    return NextResponse.json({
      success: true,
      siteProjectId,
      slug,
      status: body.status,
      message: `Empreendimento ${body.status === 'published' ? 'publicado' : 'atualizado'} com sucesso!`,
    });
  } catch (error) {
    logger.error({ error }, '[site-vision/publish] error');
    return NextResponse.json({ error: 'Erro ao publicar empreendimento.' }, { status: 500 });
  }
}
