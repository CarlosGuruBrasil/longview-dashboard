import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAuth, verifyPermission } from '@/lib/auth'
import { ensureSchema, sql } from '@/lib/pg'
import logger from '@/lib/logger'

export const runtime = 'nodejs'
export const revalidate = 0

const updateSchema = z.object({
  inspectionId: z.coerce.number().int().positive(),
  scopeIds: z.array(z.enum(['longview', 'nautic', 'hub-beira-mar'])).min(1).max(3),
})

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function GET(request: NextRequest) {
  const user = await verifyPermission('viewQualityVision')
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    await ensureSchema()
    const showAll = request.nextUrl.searchParams.get('view') === 'all'

    const [summary, items, scopes] = await Promise.all([
      sql`
        SELECT
          COUNT(DISTINCT i.id)::int AS total,
          COUNT(DISTINCT i.id) FILTER (WHERE q.inspection_id IS NULL)::int AS pending,
          COUNT(DISTINCT i.id) FILTER (WHERE q.source = 'manual')::int AS manual,
          COUNT(DISTINCT i.id) FILTER (WHERE q.source = 'automatic')::int AS automatic,
          COUNT(q.inspection_id)::int
            - COUNT(DISTINCT q.inspection_id)::int AS shared_links
        FROM construpoint_inspecoes i
        LEFT JOIN quality_inspection_scopes q ON q.inspection_id = i.id
      `,
      sql`
        SELECT i.id, i.code, i.modelo, i.obra, i.local, i.status,
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
        LIMIT 200
      `,
      sql`SELECT id, nome, tipo FROM quality_scopes WHERE ativo = true ORDER BY tipo, nome`,
    ])

    return NextResponse.json({ summary: summary[0], items, scopes })
  } catch (error) {
    logger.error({ error }, '[construpoint/classification] GET falhou')
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const user = await verifyAuth()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const canClassify = user.role === 'Desenvolvedor' || user.role === 'Diretoria'
    || user.role === 'Gestor' || user.permissions?.isAdmin === true
  if (!canClassify) return NextResponse.json({ error: 'Sem permissão para classificar' }, { status: 403 })

  try {
    await ensureSchema()
    const parsed = updateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Classificação inválida', issues: parsed.error.issues }, { status: 400 })
    }

    const { inspectionId, scopeIds } = parsed.data
    const exists = await sql`SELECT 1 FROM construpoint_inspecoes WHERE id = ${inspectionId}`
    if (exists.length === 0) return NextResponse.json({ error: 'Inspeção não encontrada' }, { status: 404 })

    await sql.begin(async transaction => {
      await transaction`DELETE FROM quality_inspection_scopes WHERE inspection_id = ${inspectionId}`
      for (const scopeId of [...new Set(scopeIds)]) {
        await transaction`
          INSERT INTO quality_inspection_scopes (
            inspection_id, scope_id, source, classified_by, classified_at
          ) VALUES (${inspectionId}, ${scopeId}, 'manual', ${user.email}, NOW())
        `
      }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error({ error }, '[construpoint/classification] PUT falhou')
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}
