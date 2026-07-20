import { NextRequest, NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { ensureSchema, sql } from '@/lib/pg';
import logger from '@/lib/logger';

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function POST(request: NextRequest) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const body = (await request.json()) as {
      cvUnidadeId?: unknown;
      cvEmpreendimentoId?: unknown;
      title?: unknown;
      price?: unknown;
      ownerMode?: unknown;
      ownerName?: unknown;
      ownerEmail?: unknown;
      ownerPhone?: unknown;
      ownerDocument?: unknown;
      brokerName?: unknown;
      brokerEmail?: unknown;
      brokerPhone?: unknown;
      description?: unknown;
    };

    const cvUnidadeId = Number(body.cvUnidadeId);
    const cvEmpreendimentoId = Number(body.cvEmpreendimentoId);
    if (!Number.isFinite(cvUnidadeId) || !Number.isFinite(cvEmpreendimentoId)) {
      return NextResponse.json({ error: 'Unidade ou empreendimento inválido.' }, { status: 400 });
    }

    await ensureSchema();
    const existing = await sql<{ id: string }[]>`
      SELECT id FROM site_public_resales WHERE cv_unidade_id = ${cvUnidadeId} LIMIT 1
    `;
    if (existing[0]) {
      return NextResponse.json({ error: 'Essa unidade já foi transformada em revenda.' }, { status: 409 });
    }

    const title = String(body.title ?? `Revenda unidade ${cvUnidadeId}`).trim();
    const price = body.price == null || body.price === '' ? null : Number(body.price);
    const slug = slugify(`${title}-${cvUnidadeId}`);
    const ownerMode = String(body.ownerMode ?? 'keep');
    const ownerName = String(body.ownerName ?? '');
    const ownerEmail = String(body.ownerEmail ?? '');
    const ownerPhone = String(body.ownerPhone ?? '');
    const ownerDocument = String(body.ownerDocument ?? '');
    const brokerName = String(body.brokerName ?? '');
    const brokerEmail = String(body.brokerEmail ?? '');
    const brokerPhone = String(body.brokerPhone ?? '');
    const description = typeof body.description === 'string' && body.description.trim()
      ? body.description.trim()
      : (ownerMode === 'update' ? 'Revenda com dados do proprietário atualizados manualmente.' : 'Revenda criada a partir de unidade vendida no CRM.');
    const id = `resale-${cvUnidadeId}-${Date.now()}`;

    await sql`
      INSERT INTO site_public_resales (
        id, cv_unidade_id, cv_empreendimento_id, slug, status_publicacao, titulo_publico,
        descricao_publica, preco_revenda, corretor_nome, corretor_telefone, corretor_email, owner_name, owner_email,
        owner_phone, owner_document, metadata, created_at, updated_at
      ) VALUES (
        ${id},
        ${cvUnidadeId},
        ${cvEmpreendimentoId},
        ${slug},
        'draft',
        ${title},
        ${description},
        ${Number.isFinite(price ?? NaN) ? price : null},
        ${brokerName},
        ${brokerPhone},
        ${brokerEmail},
        ${ownerName},
        ${ownerEmail},
        ${ownerPhone},
        ${ownerDocument},
        ${JSON.stringify({ ownerMode, createdFrom: 'site-vision-unit-action' })},
        NOW(),
        NOW()
      )
    `;

    return NextResponse.json({ ok: true, id, slug });
  } catch (error) {
    logger.error({ error }, '[site-vision/revendas] erro ao criar revenda:');
    return NextResponse.json({ error: 'Erro ao criar revenda.' }, { status: 500 });
  }
}
