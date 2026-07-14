import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { sql, ensureSchema } from '@/lib/pg';
import { setProjectBanner } from '@/lib/db-kv';
import logger from '@/lib/logger'

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await ensureSchema();
    const rows = await sql<{ data: Buffer; content_type: string }[]>`
      SELECT data, content_type FROM project_banners WHERE project_id = ${id}
    `;
    if (!rows[0]) return new Response(null, { status: 404 });
    return new Response(rows[0].data as unknown as BodyInit, {
      headers: {
        'Content-Type': rows[0].content_type,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response(null, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await verifyAuth();
  if (!auth) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 });
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'Imagem muito grande (máx 8MB)' }, { status: 413 });

    const buf = Buffer.from(await file.arrayBuffer());
    const ct  = file.type || 'image/jpeg';

    await ensureSchema();
    await sql`
      INSERT INTO project_banners (project_id, content_type, data, updated_at)
      VALUES (${id}, ${ct}, ${buf}, NOW())
      ON CONFLICT (project_id) DO UPDATE SET
        content_type = EXCLUDED.content_type,
        data         = EXCLUDED.data,
        updated_at   = NOW()
    `;

    // Atualiza o campo banner do empreendimento com a URL da rota
    const bannerUrl = `/api/projects/${id}/banner`;
    await setProjectBanner(id, bannerUrl);

    return NextResponse.json({ url: bannerUrl });
  } catch (e: unknown) {
    logger.error({ e }, '[projects/banner] POST error:');
    return NextResponse.json({ error: 'Erro ao salvar imagem' }, { status: 500 });
  }
}
