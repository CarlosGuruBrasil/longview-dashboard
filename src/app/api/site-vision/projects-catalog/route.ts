import { NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { ensureSchema, sql } from '@/lib/pg';
import { fetchEmpreendimentoPublicState } from '@/lib/site-longview-client';
import logger from '@/lib/logger';

export async function GET() {
  const user = await verifyPermission('viewSiteVision');
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  try {
    await ensureSchema();
    const empreendimentos = await sql<any[]>`
      SELECT
        ce.id,
        ce.nome,
        ce.situacao,
        ce.tipo,
        COUNT(DISTINCT cu.id) AS total_unidades,
        COUNT(DISTINCT cm.id) AS total_materiais,
        COUNT(DISTINCT CASE WHEN cm.tipo = 'ebook' THEN cm.id END) AS total_ebooks,
        CASE WHEN spe.id IS NOT NULL THEN true ELSE false END AS ja_publicado,
        spe.id AS site_project_id,
        spe.status_publicacao,
        MAX(spe.updated_at)::text AS ultima_atualizacao
      FROM cv_empreendimentos ce
      LEFT JOIN cv_unidades cu ON cu.id_empreendimento = ce.id
      LEFT JOIN cv_materiais cm ON cm.id_empreendimento = ce.id
      LEFT JOIN site_public_empreendimentos spe ON spe.crm_empreendimento_id = ce.id
      GROUP BY ce.id, ce.nome, ce.situacao, ce.tipo, spe.id, spe.status_publicacao, spe.updated_at
      ORDER BY ce.id DESC
    `;

    const enriched = await Promise.all(
      empreendimentos.map(async (emp) => {
        const [revendas, unidadesPublicadas, publicState] = await Promise.all([
          sql<{ total: number }[]>`
            SELECT COUNT(*) AS total FROM site_public_resales WHERE cv_empreendimento_id = ${emp.id}
          `,
          sql<{ total: number }[]>`
            SELECT COUNT(*) AS total FROM site_public_unit_visibility
            WHERE cv_empreendimento_id = ${emp.id} AND visible_on_site = true
          `,
          // Verdade do que está ao vivo no site real, não uma tabela local que pode ficar vazia
          // mesmo com fotos/materiais publicados por outro caminho.
          fetchEmpreendimentoPublicState(emp.id),
        ]);

        return {
          id: emp.id,
          nome: emp.nome,
          situacao: emp.situacao,
          tipo: emp.tipo,
          inventario: {
            unidades: Number(emp.total_unidades ?? 0),
            unidadesPublicadas: Number(unidadesPublicadas[0]?.total ?? 0),
            imagens: publicState?.midias?.filter((m) => m.tipo === 'foto').length ?? 0,
            videos: publicState?.midias?.filter((m) => m.tipo === 'video').length ?? 0,
            materiais: (publicState?.materiais?.length ?? 0) || Number(emp.total_materiais ?? 0),
            ebooks: Number(emp.total_ebooks ?? 0),
            revendas: Number(revendas[0]?.total ?? 0),
          },
          site: {
            publicado: publicState?.ativo ?? (emp.ja_publicado === true),
            siteProjectId: emp.site_project_id,
            status: emp.status_publicacao || 'draft',
            ultimaAtualizacao: emp.ultima_atualizacao,
            noSiteReal: publicState !== null,
          },
        };
      })
    );

    return NextResponse.json({ empreendimentos: enriched });
  } catch (error) {
    logger.error({ error }, '[site-vision/projects-catalog] error');
    return NextResponse.json({ error: 'Erro ao carregar catálogo.' }, { status: 500 });
  }
}
