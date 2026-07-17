import { NextResponse } from 'next/server';
import { sql } from '@/lib/pg';
import logger from '@/lib/logger';

// ⚠️ SEM AUTENTICAÇÃO - APENAS PARA DEBUG/TESTE
export async function GET() {
  try {
    const [crmStats, siteStats, empreendimentos, mediaAssets, unitVisibility] = await Promise.all([
      sql<{ total: number }[]>`
        SELECT COUNT(*) as total FROM cv_empreendimentos
      `,
      sql<{ total: number }[]>`
        SELECT COUNT(*) as total FROM site_public_empreendimentos
      `,
      sql<any[]>`
        SELECT 
          ce.id, ce.nome, ce.situacao,
          (SELECT COUNT(*) FROM cv_unidades WHERE empreendimento_id = ce.id) as unidades,
          (SELECT COUNT(*) FROM cv_materiais WHERE id_empreendimento = ce.id) as materiais,
          (SELECT COUNT(*) FROM cv_empreendimento_images WHERE id_empreendimento = ce.id) as imagens,
          CASE WHEN spe.id IS NOT NULL THEN true ELSE false END as publicado,
          spe.status_publicacao,
          spe.slug,
          spe.updated_at::text as ultima_atualizacao
        FROM cv_empreendimentos ce
        LEFT JOIN site_public_empreendimentos spe ON spe.crm_empreendimento_id = ce.id
        ORDER BY ce.id DESC
        LIMIT 20
      `,
      sql<any[]>`
        SELECT 
          id, empreendimento_id, kind, is_primary, sort_order, title
        FROM site_public_media_assets
        LIMIT 10
      `,
      sql<any[]>`
        SELECT 
          cv_unidade_id, cv_empreendimento_id, visible_on_site
        FROM site_public_unit_visibility
        LIMIT 10
      `,
    ]);

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      
      // Stats gerais
      stats: {
        crm_empreendimentos_total: crmStats[0]?.total || 0,
        site_public_empreendimentos_publicados: siteStats[0]?.total || 0,
      },

      // Amostra de empreendimentos
      empreendimentos_amostra: empreendimentos,
      
      // Dados que foram para o site
      media_assets_amostra: mediaAssets,
      unit_visibility_amostra: unitVisibility,

      // Instruções de teste
      teste: {
        1: 'Abra http://localhost:3000/site-vision/empreendimentos para ver a lista',
        2: 'Clique em um empreendimento para entrar no detalhe',
        3: 'Faça upload de imagem(ns)',
        4: 'Selecione unidades que vão aparecer no site',
        5: 'Clique "Publicar agora"',
        6: 'Verifique se aparece em http://localhost:3000/site',
      },
    });
  } catch (error) {
    logger.error({ error }, '[debug/sync-status] error');
    return NextResponse.json({ error: String(error), stack: String(error) }, { status: 500 });
  }
}
