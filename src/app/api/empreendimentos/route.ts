import { NextResponse } from 'next/server';
import { sql } from '@/lib/pg';
import logger from '@/lib/logger';

export async function GET() {
  try {
    const rows = await sql<{
      id: string;
      nome: string;
      cidade: string;
      bairro: string;
      hero_image_url: string;
      metadata: unknown;
      status_publicacao: string;
      crm_empreendimento_id: number | null;
    }[]>`
      SELECT
        id,
        nome,
        cidade,
        bairro,
        hero_image_url,
        metadata,
        status_publicacao,
        crm_empreendimento_id
      FROM site_public_empreendimentos
      WHERE status_publicacao = 'published'
      ORDER BY destaque DESC, updated_at DESC
    `;

    const empreendimentos = rows.map((row) => {
      const metadata = typeof row.metadata === 'object' ? row.metadata : {};
      return {
        id: row.crm_empreendimento_id ?? 0,
        cv_crm_id: row.crm_empreendimento_id ?? 0,
        nome: row.nome,
        endereco: (metadata as any)?.addressLine ?? '',
        cidade: row.cidade,
        estado: (metadata as any)?.estado ?? 'SC',
        area_construida: (metadata as any)?.areaLabel ?? null,
        area_privativa: null,
        data_entrega: null,
        situacao_obra: (metadata as any)?.stageLabel ?? 'em_desenvolvimento',
        quantidade_unidades: null,
        ativo: row.status_publicacao === 'published',
        sync_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    return NextResponse.json(empreendimentos);
  } catch (error) {
    logger.error({ error }, '[api/empreendimentos] error');
    return NextResponse.json({ error: 'Erro ao carregar empreendimentos' }, { status: 500 });
  }
}
