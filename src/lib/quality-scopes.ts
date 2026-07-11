import { sql } from '@/lib/pg'

export type QualityScopeId = 'longview' | 'nautic' | 'hub-beira-mar'

export function inferQualityScopeIds(input: {
  obra?: string | null
  local?: string | null
  modelo?: string | null
}): QualityScopeId[] {
  const obra = input.obra?.trim().toLocaleLowerCase('pt-BR') ?? ''
  const local = input.local?.trim().toLocaleLowerCase('pt-BR') ?? ''
  const modelo = input.modelo?.trim().toLocaleLowerCase('pt-BR') ?? ''

  if (obra === 'nautic') return ['nautic']
  if (obra === 'hub beira-mar' || obra === 'hub beira mar') return ['hub-beira-mar']
  if (obra !== 'longview') return []
  if (local !== 'obras - nautic e hub') return ['longview']
  if (modelo.startsWith('segurança - inspeção mensal da qualidade')) {
    return ['nautic', 'hub-beira-mar']
  }
  return []
}

/** Recalcula somente vínculos automáticos; classificações manuais sempre vencem. */
export async function refreshAutomaticQualityScopes(): Promise<void> {
  await sql.begin(async transaction => {
    await transaction`
      DELETE FROM quality_inspection_scopes automatic
      WHERE automatic.source = 'automatic'
        AND NOT EXISTS (
          SELECT 1 FROM quality_inspection_scopes manual
          WHERE manual.inspection_id = automatic.inspection_id
            AND manual.source = 'manual'
        )
    `

    await transaction`
      INSERT INTO quality_inspection_scopes (inspection_id, scope_id, source)
      SELECT i.id,
        CASE
          WHEN lower(COALESCE(NULLIF(o.override_obra, ''), i.obra, '')) = 'nautic' THEN 'nautic'
          WHEN lower(COALESCE(NULLIF(o.override_obra, ''), i.obra, '')) IN ('hub beira-mar', 'hub beira mar') THEN 'hub-beira-mar'
          WHEN lower(COALESCE(NULLIF(o.override_obra, ''), i.obra, '')) = 'longview'
            AND lower(COALESCE(NULLIF(o.override_local, ''), i.local, '')) <> 'obras - nautic e hub' THEN 'longview'
        END,
        'automatic'
      FROM construpoint_inspecoes i
      LEFT JOIN construpoint_inspecoes_overrides o ON i.id = o.inspection_id
      WHERE NOT EXISTS (
        SELECT 1 FROM quality_inspection_scopes manual
        WHERE manual.inspection_id = i.id AND manual.source = 'manual'
        )
        AND (
          lower(COALESCE(NULLIF(o.override_obra, ''), i.obra, '')) IN ('nautic', 'hub beira-mar', 'hub beira mar')
          OR (
            lower(COALESCE(NULLIF(o.override_obra, ''), i.obra, '')) = 'longview'
            AND lower(COALESCE(NULLIF(o.override_local, ''), i.local, '')) <> 'obras - nautic e hub'
          )
        )
      ON CONFLICT (inspection_id, scope_id) DO NOTHING
    `

    // Inspeções mensais de Segurança abrangem as duas obras, mas contam uma vez no consolidado.
    await transaction`
      INSERT INTO quality_inspection_scopes (inspection_id, scope_id, source)
      SELECT i.id, scope.id, 'automatic'
      FROM construpoint_inspecoes i
      LEFT JOIN construpoint_inspecoes_overrides o ON i.id = o.inspection_id
      CROSS JOIN (VALUES ('nautic'), ('hub-beira-mar')) AS scope(id)
      WHERE lower(COALESCE(NULLIF(o.override_obra, ''), i.obra, '')) = 'longview'
        AND lower(COALESCE(NULLIF(o.override_local, ''), i.local, '')) = 'obras - nautic e hub'
        AND COALESCE(NULLIF(o.override_modelo, ''), i.modelo, '') ILIKE 'Segurança - Inspeção Mensal da Qualidade%'
        AND NOT EXISTS (
          SELECT 1 FROM quality_inspection_scopes manual
          WHERE manual.inspection_id = i.id AND manual.source = 'manual'
        )
      ON CONFLICT (inspection_id, scope_id) DO NOTHING
    `
  })
}
