import { NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { sql } from '@/lib/pg';
import logger from '@/lib/logger';

type InventoryRow = {
  id: number;
  nome: string;
  total_units: string | number;
  available_units: string | number;
  reserved_units: string | number;
  sold_units: string | number;
  linked_pages: string | number;
};

type ResaleRow = {
  id: string;
  slug: string;
  status_publicacao: 'draft' | 'published' | 'archived' | 'sold';
  destaque: boolean;
  titulo_publico: string;
  preco_revenda: string | number | null;
  corretor_nome: string;
  hero_image_url: string;
  updated_at: string;
  cv_unidade_id: number;
  cv_empreendimento_id: number;
  empreendimento_nome: string | null;
  unidade_numero: string | null;
  unidade_bloco: string | null;
};

function asNumber(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

export async function GET() {
  const user = await verifyPermission('viewSiteVision');
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  try {
    const [inventoryRows, resaleRows] = await Promise.all([
      sql<InventoryRow[]>`
        SELECT
          ce.id,
          ce.nome,
          COUNT(cu.id)::int AS total_units,
          COUNT(cu.id) FILTER (WHERE LOWER(COALESCE(cu.status, '')) LIKE '%disp%')::int AS available_units,
          COUNT(cu.id) FILTER (WHERE cu.status_venda = 2)::int AS reserved_units,
          COUNT(cu.id) FILTER (WHERE cu.status_venda = 3 OR LOWER(COALESCE(cu.status, '')) LIKE '%vend%')::int AS sold_units,
          (SELECT COUNT(*) FROM site_public_empreendimentos WHERE crm_empreendimento_id = ce.id)::int AS linked_pages
        FROM cv_empreendimentos ce
        LEFT JOIN cv_unidades cu ON cu.empreendimento_id = ce.id
        GROUP BY ce.id
        ORDER BY ce.updated_at DESC
        LIMIT 16
      `,
      sql<ResaleRow[]>`
        SELECT
          r.id,
          r.slug,
          r.status_publicacao,
          r.destaque,
          r.titulo_publico,
          r.preco_revenda,
          r.corretor_nome,
          r.hero_image_url,
          r.updated_at::text,
          r.cv_unidade_id,
          r.cv_empreendimento_id,
          ce.nome AS empreendimento_nome,
          cu.numero AS unidade_numero,
          cu.bloco AS unidade_bloco
        FROM site_public_resales r
        LEFT JOIN cv_empreendimentos ce ON ce.id = r.cv_empreendimento_id
        LEFT JOIN cv_unidades cu ON cu.id = r.cv_unidade_id
        ORDER BY
          CASE
            WHEN r.status_publicacao = 'sold' THEN 1
            WHEN r.status_publicacao = 'archived' THEN 2
            ELSE 3
          END,
          r.destaque DESC,
          r.updated_at DESC
        LIMIT 16
      `,
    ]);

    return NextResponse.json({
      inventory: inventoryRows.map((row) => ({
        id: row.id,
        nome: row.nome,
        totalUnits: asNumber(row.total_units),
        availableUnits: asNumber(row.available_units),
        reservedUnits: asNumber(row.reserved_units),
        soldUnits: asNumber(row.sold_units),
        linkedPages: asNumber(row.linked_pages),
      })),
      resales: resaleRows.map((row) => ({
        id: row.id,
        slug: row.slug,
        status: row.status_publicacao,
        destaque: row.destaque,
        title: row.titulo_publico,
        price: row.preco_revenda == null ? null : Number(row.preco_revenda),
        brokerName: row.corretor_nome,
        heroImageUrl: row.hero_image_url,
        updatedAt: row.updated_at,
        cvUnitId: row.cv_unidade_id,
        projectName: row.empreendimento_nome,
        unitLabel: `${row.unidade_bloco || ''} ${row.unidade_numero || ''}`.trim(),
      })),
    });
  } catch (error) {
    logger.error({ error }, '[site-vision/inventory] error:');
    return NextResponse.json({ error: 'Erro ao carregar inventory.' }, { status: 500 });
  }
}
