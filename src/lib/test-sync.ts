import { sql } from '@/lib/pg';

export async function testEmpreendimentos() {
  try {
    // 1. Contar empreendimentos no CRM
    const crmCount = await sql<{ total: number }[]>`
      SELECT COUNT(*) as total FROM cv_empreendimentos
    `;

    // 2. Contar já publicados
    const siteCount = await sql<{ total: number }[]>`
      SELECT COUNT(*) as total FROM site_public_empreendimentos
    `;

    // 3. Trazer alguns empreendimentos com dados
    const emps = await sql<any[]>`
      SELECT 
        ce.id, ce.nome, ce.situacao,
        (SELECT COUNT(*) FROM cv_unidades WHERE empreendimento_id = ce.id) as unidades,
        (SELECT COUNT(*) FROM cv_materiais WHERE id_empreendimento = ce.id) as materiais,
        CASE WHEN spe.id IS NOT NULL THEN 'published' ELSE 'draft' END as site_status
      FROM cv_empreendimentos ce
      LEFT JOIN site_public_empreendimentos spe ON spe.crm_empreendimento_id = ce.id
      ORDER BY ce.id DESC
      LIMIT 10
    `;

    return {
      crm_total: crmCount[0]?.total || 0,
      site_published: siteCount[0]?.total || 0,
      empreendimentos: emps,
    };
  } catch (error) {
    console.error('Erro ao testar:', error);
    throw error;
  }
}
