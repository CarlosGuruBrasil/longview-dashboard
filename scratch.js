import { sql } from './src/lib/pg.ts';
import { ensureSchema } from './src/lib/pg.ts';

async function main() {
  await ensureSchema();
  const showAll = false;
  try {
    const res = await sql`
      SELECT
             i.id,
             i.code,
             COALESCE(NULLIF(i.override_modelo, ''), i.modelo) AS modelo,
             COALESCE(NULLIF(i.override_obra, ''), i.obra) AS obra,
             COALESCE(NULLIF(i.override_local, ''), i.local) AS local,
             i.modelo AS source_modelo,
             i.obra AS source_obra,
             i.local AS source_local,
             i.override_modelo,
             i.override_obra,
             i.override_local,
             i.status,
             COALESCE(i.data_agendamento, i.data_criacao) AS data,
             COALESCE(array_agg(q.scope_id ORDER BY q.scope_id)
               FILTER (WHERE q.scope_id IS NOT NULL), ARRAY[]::text[]) AS scope_ids,
             COALESCE(bool_or(q.source = 'manual'), false) AS manual
      FROM construpoint_inspecoes i
      LEFT JOIN quality_inspection_scopes q ON q.inspection_id = i.id
      GROUP BY i.id
      HAVING ${showAll} OR COUNT(q.scope_id) = 0
      ORDER BY (COUNT(q.scope_id) = 0) DESC,
               COALESCE(i.data_agendamento, i.data_criacao) DESC NULLS LAST
      LIMIT 10
    `;
    console.log("SUCCESS", res.length);
  } catch (err) {
    console.error("ERROR", err);
  }
}
main();
