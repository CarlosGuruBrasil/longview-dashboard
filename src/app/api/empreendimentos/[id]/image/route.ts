import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { sql, ensureSchema } from '@/lib/pg';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const empId = parseInt(id, 10);
  await ensureSchema();
  const rows = await sql<{ data: Buffer; content_type: string }[]>`
    SELECT data, content_type FROM cv_empreendimento_images WHERE id_empreendimento = ${empId}
  `;
  if (!rows[0]) return new Response(null, { status: 404 });
  return new Response(rows[0].data as unknown as BodyInit, {
    headers: {
      'Content-Type': rows[0].content_type,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await params;
  const empId = parseInt(id, 10);

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Máx 10 MB' }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  await ensureSchema();
  await sql`
    INSERT INTO cv_empreendimento_images (id_empreendimento, content_type, data, updated_at)
    VALUES (${empId}, ${file.type || 'image/jpeg'}, ${buf}, NOW())
    ON CONFLICT (id_empreendimento) DO UPDATE SET
      content_type = EXCLUDED.content_type,
      data = EXCLUDED.data,
      updated_at = NOW()
  `;
  return NextResponse.json({ url: `/api/empreendimentos/${empId}/image?t=${Date.now()}` });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const { id } = await params;
  await ensureSchema();
  await sql`DELETE FROM cv_empreendimento_images WHERE id_empreendimento = ${parseInt(id, 10)}`;
  return NextResponse.json({ ok: true });
}
