import { NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { ensureSchema, sql } from '@/lib/pg';
import logger from '@/lib/logger';

type CrmProjectRow = { id: number; nome: string; situacao: string | null; tipo: string | null };
type SiteProjectRow = {
  id: string;
  slug: string;
  nome: string;
  status_publicacao: 'draft' | 'published' | 'archived';
  destaque: boolean;
  crm_empreendimento_id: number | null;
  crm_nome: string | null;
  cidade: string;
  bairro: string;
  hero_image_url: string;
  updated_at: string;
  media_count: string | number;
};

export async function GET() {
  const user = await verifyPermission('viewSiteVision');
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  try {
    await ensureSchema();
    const [crmProjectsRows, siteProjectsRows] = await Promise.all([
      sql<CrmProjectRow[]>`
        SELECT id, nome, situacao, tipo
        FROM cv_empreendimentos
        ORDER BY id DESC
        LIMIT 32
      `,
      sql<SiteProjectRow[]>`
        SELECT
          e.id,
          e.slug,
          e.nome,
          e.status_publicacao,
          e.destaque,
          e.crm_empreendimento_id,
          ce.nome AS crm_nome,
          e.cidade,
          e.bairro,
          e.hero_image_url,
          e.updated_at::text,
          COUNT(m.id)::int AS media_count
        FROM site_public_empreendimentos e
        LEFT JOIN cv_empreendimentos ce ON ce.id = e.crm_empreendimento_id
        LEFT JOIN site_public_media_assets m ON m.empreendimento_id = e.id
        GROUP BY e.id, ce.nome
        ORDER BY e.updated_at DESC
        LIMIT 32
      `,
    ]);

    return NextResponse.json({
      crmProjects: crmProjectsRows,
      siteProjects: siteProjectsRows.map((row) => ({
        id: row.id,
        slug: row.slug,
        nome: row.nome,
        status: row.status_publicacao,
        destaque: row.destaque,
        crmProjectId: row.crm_empreendimento_id,
        crmNome: row.crm_nome,
        cidade: row.cidade,
        bairro: row.bairro,
        heroImageUrl: row.hero_image_url,
        updatedAt: row.updated_at,
        mediaCount: Number(row.media_count ?? 0),
      })),
    });
  } catch (error) {
    logger.error({ error }, '[site-vision/projects] error:');
    return NextResponse.json({ error: 'Erro ao carregar projects.' }, { status: 500 });
  }
}
