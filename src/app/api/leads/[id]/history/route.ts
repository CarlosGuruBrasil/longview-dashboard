import { NextRequest, NextResponse } from 'next/server';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Histórico de movimentação de etapa de um lead (tabela lead_stage_history)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();
    // corretor/gestor são extraídos do raw guardado no momento da transição
    // (responsável daquela etapa, no momento em que ela aconteceu).
    const rows = await sql`
      SELECT
        de, para, autor, changed_at,
        raw->'corretor'->>'nome' AS corretor,
        raw->'gestor'->>'nome'   AS gestor,
        COALESCE(raw->'origem'->>'nome', raw->>'origem') AS origem
      FROM lead_stage_history
      WHERE lead_id = ${id}
      ORDER BY changed_at DESC
    `;
    return NextResponse.json({ ok: true, history: rows });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 500 });
  }
}
