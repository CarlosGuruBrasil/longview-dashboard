import { NextRequest, NextResponse } from 'next/server';

// Histórico de movimentação de etapa de um lead (tabela lead_stage_history)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { sql, ensureSchema } = await import('@/lib/pg');
    await ensureSchema();
    const rows = await sql`
      SELECT de, para, autor, changed_at
      FROM lead_stage_history
      WHERE lead_id = ${id}
      ORDER BY changed_at DESC
    `;
    return NextResponse.json({ ok: true, history: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
