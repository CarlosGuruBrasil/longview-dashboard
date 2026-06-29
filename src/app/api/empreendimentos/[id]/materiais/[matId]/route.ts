import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { sql, ensureSchema } from '@/lib/pg';

type Params = { params: Promise<{ id: string; matId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await verifyAuth();
  if (!user) return new Response('Não autorizado', { status: 401 });
  const { matId } = await params;
  await ensureSchema();
  const rows = await sql<{ data: Buffer; content_type: string; nome: string }[]>`
    SELECT data, content_type, nome FROM cv_materiais WHERE id = ${matId}
  `;
  if (!rows[0]) return new Response('Não encontrado', { status: 404 });
  return new Response(rows[0].data as unknown as BodyInit, {
    headers: {
      'Content-Type': rows[0].content_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(rows[0].nome)}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const { matId } = await params;
  await ensureSchema();
  const result = await sql`DELETE FROM cv_materiais WHERE id = ${matId}`;
  if (result.count === 0) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
