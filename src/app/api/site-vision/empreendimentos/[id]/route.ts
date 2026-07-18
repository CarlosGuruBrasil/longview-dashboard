import { NextRequest, NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { ensureSchema, sql } from '@/lib/pg';
import { pushEmpreendimentoConfig } from '@/lib/site-longview-client';
import logger from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

type SiteProjectMetadata = {
  displayName?: string;
  shortDescription?: string;
  locationLabel?: string;
  addressLine?: string;
  stageLabel?: string;
  deliveryLabel?: string;
  areaLabel?: string;
  bedroomsLabel?: string;
  suitesLabel?: string;
  parkingLabel?: string;
  floorsLabel?: string;
  unitsLabel?: string;
  cardHeroImageUrl?: string;
  detailHeroImageUrl?: string;
  logoUrl?: string;
  heroVideoUrl?: string;
  cardVideoUrl?: string;
  whatsappNumber?: string;
  clientPortalUrl?: string;
  technicalAssistUrl?: string;
  videoUrl?: string;
  vagasLabel?: string;
};

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  const parsed = parseJsonValue(value);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return {};
}

function parseJsonArray<T = Record<string, unknown>>(value: unknown): T[] {
  const parsed = parseJsonValue(value);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

export async function GET(_request: NextRequest, { params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const { id } = await params;
    const empreendimentoId = Number(id);
    if (!Number.isFinite(empreendimentoId)) {
      return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
    }

    await ensureSchema();

    const [empRows, siteRows, unidadeRows, vendaRows, materialRows, imageRows, resaleRows, visibilityRows, internalTableRows] = await Promise.all([
      sql<{ id: number; nome: string; situacao: string | null; tipo: string | null; raw: unknown }[]>`
        SELECT id, nome, situacao, tipo, raw
        FROM cv_empreendimentos
        WHERE id = ${empreendimentoId}
        LIMIT 1
      `,
      sql<{
        id: string;
        slug: string;
        nome: string;
        status_publicacao: 'draft' | 'published' | 'archived';
        exibir_na_home: boolean;
        destaque: boolean;
        hero_image_url: string;
        headline: string;
        resumo: string;
        descricao: string;
        cta_label: string;
        cta_target: string;
        tags: unknown;
        highlights: unknown;
        metadata: Record<string, unknown>;
      }[]>`
        SELECT id, slug, nome, status_publicacao, exibir_na_home, destaque, hero_image_url, headline, resumo, descricao, cta_label, cta_target, tags, highlights, metadata
        FROM site_public_empreendimentos
        WHERE crm_empreendimento_id = ${empreendimentoId}
        LIMIT 1
      `,
      sql<{
        id: number;
        bloco: string | null;
        numero: string | null;
        status: string | null;
        status_venda: number | null;
        valor: number | null;
        metragem: number | null;
        raw: unknown;
      }[]>`
        SELECT id, bloco, numero, status, status_venda, valor, metragem, raw
        FROM cv_unidades
        WHERE id_empreendimento = ${empreendimentoId}
        ORDER BY (raw->>'andar')::int ASC NULLS LAST, (raw->>'coluna')::int ASC NULLS LAST, numero ASC NULLS LAST
      `,
      sql<{
        id: number;
        id_unidade: number | null;
        valor: number | null;
        status: string | null;
        data_venda: string | null;
        raw: unknown;
      }[]>`
        SELECT id, id_unidade, valor, status, data_venda::text, raw
        FROM cv_vendas
        WHERE id_empreendimento = ${empreendimentoId}
        ORDER BY data_venda DESC NULLS LAST
      `,
      sql<{
        id: string;
        nome: string;
        tipo: string;
        content_type: string | null;
        size_bytes: number | null;
        uploaded_by: string;
        created_at: string;
      }[]>`
        SELECT id, nome, tipo, content_type, size_bytes, uploaded_by, created_at::text
        FROM cv_materiais
        WHERE id_empreendimento = ${empreendimentoId}
        ORDER BY created_at DESC
      `,
      sql<{ exists: boolean }[]>`
        SELECT EXISTS(SELECT 1 FROM cv_empreendimento_images WHERE id_empreendimento = ${empreendimentoId}) AS exists
      `,
      sql<{
        id: string;
        cv_unidade_id: number;
        status_publicacao: string;
        titulo_publico: string;
        preco_revenda: number | null;
        corretor_nome: string;
        owner_name: string;
      }[]>`
        SELECT id, cv_unidade_id, status_publicacao, titulo_publico, preco_revenda, corretor_nome, owner_name
        FROM site_public_resales
        WHERE cv_empreendimento_id = ${empreendimentoId}
        ORDER BY updated_at DESC
      `,
      sql<{
        cv_unidade_id: number;
        visible_on_site: boolean;
      }[]>`
        SELECT cv_unidade_id, visible_on_site
        FROM site_public_unit_visibility
        WHERE cv_empreendimento_id = ${empreendimentoId}
      `,
      sql<{
        id: string;
        title: string;
        version_label: string;
        mime_type: string | null;
        size_bytes: number | null;
        public_url: string;
        created_at: string;
      }[]>`
        SELECT id, title, version_label, mime_type, size_bytes, public_url, created_at::text
        FROM site_public_internal_tables
        WHERE cv_empreendimento_id = ${empreendimentoId}
        ORDER BY updated_at DESC, created_at DESC
      `,
    ]);

    const empreendimento = empRows[0];
    if (!empreendimento) {
      return NextResponse.json({ error: 'Empreendimento não encontrado.' }, { status: 404 });
    }

    const raw = parseJsonObject(empreendimento.raw);
    const site = siteRows[0] ?? null;
    const manualImage = imageRows[0]?.exists === true;
    const visibilityByUnit = new Map<number, boolean>(
      visibilityRows.map((row) => [row.cv_unidade_id, row.visible_on_site])
    );
    const salesByUnit = new Map<number, {
      reservaId: number;
      ownerName: string;
      ownerEmail: string;
      ownerPhone: string;
      ownerDocument: string;
      corretorNome: string;
      corretorEmail: string;
      status: string;
      saleValue: number | null;
      soldAt: string | null;
    }>();

    for (const sale of vendaRows) {
      if (!sale.id_unidade) continue;
      const saleRaw = parseJsonObject(sale.raw);
      salesByUnit.set(sale.id_unidade, {
        reservaId: sale.id,
        ownerName: String(saleRaw.cliente ?? ''),
        ownerEmail: String(saleRaw.email ?? ''),
        ownerPhone: String(saleRaw.telefone ?? ''),
        ownerDocument: String(saleRaw.documento ?? ''),
        corretorNome: String(saleRaw.corretor ?? ''),
        corretorEmail: String(saleRaw.corretor_email ?? ''),
        status: String(sale.status ?? ''),
        saleValue: sale.valor ?? null,
        soldAt: sale.data_venda ?? null,
      });
    }

    const units = unidadeRows.map((unit) => {
      const unitRaw = parseJsonObject(unit.raw);
      const sale = salesByUnit.get(unit.id);
      const resale = resaleRows.find((entry) => entry.cv_unidade_id === unit.id) ?? null;
      const normalizedStatus = String(unit.status ?? '').toLowerCase();
      const defaultVisible = normalizedStatus.includes('disp') || normalizedStatus.includes('res');
      const siteVisible = visibilityByUnit.get(unit.id) ?? defaultVisible;
      return {
        id: unit.id,
        bloco: unit.bloco,
        numero: unit.numero,
        status: unit.status,
        statusVenda: unit.status_venda,
        valor: unit.valor,
        metragem: unit.metragem,
        andar: unitRaw.andar ?? null,
        coluna: unitRaw.coluna ?? null,
        tipologia: unitRaw.tipologia ?? unitRaw.tipo ?? null,
        siteVisible,
        raw: unitRaw,
        owner: sale
          ? {
              reservaId: sale.reservaId,
              name: sale.ownerName,
              email: sale.ownerEmail,
              phone: sale.ownerPhone,
              document: sale.ownerDocument,
              brokerName: sale.corretorNome,
              brokerEmail: sale.corretorEmail,
              status: sale.status,
              saleValue: sale.saleValue,
              soldAt: sale.soldAt,
            }
          : null,
        resale,
      };
    });

    const counts = units.reduce(
      (acc, unit) => {
        acc.total += 1;
        const status = String(unit.status ?? '').toLowerCase();
        if (status.includes('disp')) acc.available += 1;
        else if (status.includes('res')) acc.reserved += 1;
        else if (status.includes('vend')) acc.sold += 1;
        return acc;
      },
      { total: 0, available: 0, reserved: 0, sold: 0 }
    );

    // Specs calculados a partir das unidades — mesmo dado que o site real computa
    // a partir do que foi empurrado por pushUnidades. Só informativo aqui.
    const areas = units.map((u) => u.metragem).filter((v): v is number => v != null && v > 0);
    const dormitorios = units
      .map((u) => (u.raw.dormitorios != null ? Number(u.raw.dormitorios) : null))
      .filter((v): v is number => v != null && Number.isFinite(v));
    const andares = units
      .map((u) => (u.andar != null ? Number(u.andar) : null))
      .filter((v): v is number => v != null && Number.isFinite(v));
    const specs = {
      areaMin: areas.length ? Math.min(...areas) : null,
      areaMax: areas.length ? Math.max(...areas) : null,
      dormitoriosMin: dormitorios.length ? Math.min(...dormitorios) : null,
      dormitoriosMax: dormitorios.length ? Math.max(...dormitorios) : null,
      andares: andares.length ? Math.max(...andares) : null,
    };

    const crmMedia = [
      raw.foto
        ? {
            id: `crm-cover-${empreendimentoId}`,
            kind: 'image',
            origin: 'cvcrm',
            title: 'Foto principal do CV CRM',
            publicUrl: String(raw.foto),
            thumbnailUrl: String(raw.foto),
          }
        : null,
      raw.logo
        ? {
            id: `crm-logo-${empreendimentoId}`,
            kind: 'logo',
            origin: 'cvcrm',
            title: 'Logo do CV CRM',
            publicUrl: String(raw.logo),
            thumbnailUrl: String(raw.logo),
          }
        : null,
      raw.foto_listagem
        ? {
            id: `crm-listing-${empreendimentoId}`,
            kind: 'image',
            origin: 'cvcrm',
            title: 'Foto de listagem do CV CRM',
            publicUrl: String(raw.foto_listagem),
            thumbnailUrl: String(raw.foto_listagem),
          }
        : null,
    ].filter(Boolean);

    const cvMaterials = [
      ...(parseJsonArray<Record<string, unknown>>(raw.materiais_campanha).map((item) => ({
        id: `cv-mat-${String(item.idarquivo ?? '')}`,
        nome: String(item.titulo || item.nome || 'Material CV CRM'),
        tipo: 'campanha',
        sizeBytes: Number(item.tamanho ?? 0) || null,
        downloadUrl: String(item.arquivo ?? ''),
        fonte: 'cvcrm' as const,
      }))),
      ...(parseJsonArray<Record<string, unknown>>(raw.plantas).map((item) => ({
        id: `cv-planta-${String(item.idplanta ?? '')}`,
        nome: String(item.nome || 'Planta'),
        tipo: 'planta',
        sizeBytes: null,
        downloadUrl: String(item.img_planta_servidor ?? ''),
        fonte: 'cvcrm' as const,
      }))),
    ];

    const materials = [
      ...cvMaterials,
      ...materialRows.map((material) => ({
        ...material,
        downloadUrl: `/api/empreendimentos/${empreendimentoId}/materiais/${material.id}`,
        fonte: 'manual' as const,
      })),
    ];

    const siteRowId = site?.id ?? `site-emp-${empreendimentoId}`;
    const mediaRows = site
      ? await sql<{
          id: string;
          kind: string;
          origin: string;
          title: string;
          alt_text: string;
          public_url: string;
          thumbnail_url: string;
          mime_type: string;
          size_bytes: number | null;
          width: number | null;
          height: number | null;
          is_primary: boolean;
          sort_order: number;
          metadata: Record<string, unknown>;
        }[]>`
          SELECT id, kind, origin, title, alt_text, public_url, thumbnail_url, mime_type, size_bytes, width, height, is_primary, sort_order, metadata
          FROM site_public_media_assets
          WHERE empreendimento_id = ${siteRowId}
          ORDER BY is_primary DESC, sort_order ASC, created_at ASC
        `
      : [];

    const gatedAssetRows = site
      ? await sql<{
          id: string;
          title: string;
          slug: string;
          asset_type: 'ebook' | 'brochure' | 'document';
          public_url: string;
          thumbnail_url: string;
          mime_type: string;
          size_bytes: number | null;
          active: boolean;
          lead_tag: string;
          metadata: Record<string, unknown>;
        }[]>`
          SELECT id, title, slug, asset_type, public_url, thumbnail_url, mime_type, size_bytes, active, lead_tag, metadata
          FROM site_public_gated_assets
          WHERE site_empreendimento_id = ${siteRowId}
          ORDER BY updated_at DESC, created_at DESC
        `
      : [];

    return NextResponse.json({
      empreendimento: {
        id: empreendimento.id,
        nome: empreendimento.nome,
        situacao: empreendimento.situacao,
        tipo: empreendimento.tipo,
        foto: raw.foto ?? null,
        logo: raw.logo ?? null,
        imageUrl: manualImage ? `/api/empreendimentos/${empreendimentoId}/image` : raw.foto ?? null,
        linkDisponibilidade: raw.link_disponibilidade ?? null,
        segmento: (raw.segmento as Array<{ nome?: string }>)?.[0]?.nome ?? null,
        cidade: raw.cidade ?? null,
        bairro: raw.bairro ?? null,
        estado: raw.estado ?? null,
        endereco: raw.endereco ?? raw.logradouro ?? null,
        dataEntrega: raw.data_entrega ?? null,
        andamento: raw.andamento ?? null,
      },
      crmMedia,
      specs,
      siteConfig: site
        ? {
            id: site.id,
            slug: site.slug,
            status: site.status_publicacao,
            enabled: site.status_publicacao === 'published',
            showOnHome: site.exibir_na_home,
            destaque: site.destaque,
            heroImageUrl: site.hero_image_url,
            headline: site.headline,
            resumo: site.resumo,
            descricao: site.descricao,
            ctaLabel: site.cta_label,
            ctaTarget: site.cta_target,
        tags: parseJsonArray<string>(site.tags),
        highlights: parseJsonArray<string>(site.highlights),
        metadata: site.metadata,
      }
        : null,
      counts,
      units,
      materials,
      internalTables: internalTableRows.map((row) => ({
        id: row.id,
        title: row.title,
        versionLabel: row.version_label,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        publicUrl: row.public_url,
        createdAt: row.created_at,
      })),
      mediaAssets: mediaRows.map((row) => ({
        id: row.id,
        kind: row.kind,
        origin: row.origin,
        title: row.title,
        altText: row.alt_text,
        publicUrl: row.public_url,
        thumbnailUrl: row.thumbnail_url,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        width: row.width,
        height: row.height,
        isPrimary: row.is_primary,
        sortOrder: row.sort_order,
        metadata: row.metadata,
      })),
      gatedAssets: gatedAssetRows.map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        type: row.asset_type,
        publicUrl: row.public_url,
        thumbnailUrl: row.thumbnail_url,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        active: row.active,
        leadTag: row.lead_tag,
        metadata: row.metadata,
      })),
      resales: resaleRows,
    });
  } catch (error) {
    logger.error({ error }, '[site-vision/project-detail] erro ao carregar detalhe:');
    return NextResponse.json({ error: 'Erro ao carregar detalhe do empreendimento.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  try {
    const { id } = await params;
    const empreendimentoId = Number(id);
    if (!Number.isFinite(empreendimentoId)) {
      return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
    }

    const body = (await request.json()) as {
      enabled?: unknown;
      showOnHome?: unknown;
      destaque?: unknown;
      slug?: unknown;
      headline?: unknown;
      resumo?: unknown;
      descricao?: unknown;
      heroImageUrl?: unknown;
      ctaLabel?: unknown;
      ctaTarget?: unknown;
      tags?: unknown;
      highlights?: unknown;
      videoUrl?: unknown;
      vagasLabel?: unknown;
      displayName?: unknown;
      shortDescription?: unknown;
      locationLabel?: unknown;
      addressLine?: unknown;
      stageLabel?: unknown;
      deliveryLabel?: unknown;
      areaLabel?: unknown;
      bedroomsLabel?: unknown;
      suitesLabel?: unknown;
      parkingLabel?: unknown;
      floorsLabel?: unknown;
      unitsLabel?: unknown;
      cardHeroImageUrl?: unknown;
      detailHeroImageUrl?: unknown;
      logoUrl?: unknown;
      heroVideoUrl?: unknown;
      cardVideoUrl?: unknown;
      whatsappNumber?: unknown;
      clientPortalUrl?: unknown;
      technicalAssistUrl?: unknown;
    };

    await ensureSchema();
    const crmRows = await sql<{ id: number; nome: string }[]>`
      SELECT id, nome
      FROM cv_empreendimentos
      WHERE id = ${empreendimentoId}
      LIMIT 1
    `;
    const crm = crmRows[0];
    if (!crm) {
      return NextResponse.json({ error: 'Empreendimento não encontrado.' }, { status: 404 });
    }

    const currentRows = await sql<{
      id: string;
      slug: string;
      nome: string;
      cidade: string;
      bairro: string;
      headline: string;
      resumo: string;
      descricao: string;
      hero_image_url: string;
      cta_label: string;
      cta_target: string;
      tags: unknown;
      highlights: unknown;
      metadata: Record<string, unknown>;
      status_publicacao: 'draft' | 'published' | 'archived';
      exibir_na_home: boolean;
      destaque: boolean;
    }[]>`
      SELECT id, slug, nome, cidade, bairro, headline, resumo, descricao, hero_image_url, cta_label, cta_target, tags, highlights, metadata, status_publicacao, exibir_na_home, destaque
      FROM site_public_empreendimentos
      WHERE crm_empreendimento_id = ${empreendimentoId}
      LIMIT 1
    `;

    const current = currentRows[0];
    const enabled = typeof body.enabled === 'boolean' ? body.enabled : current?.status_publicacao === 'published';
    const showOnHome = typeof body.showOnHome === 'boolean' ? body.showOnHome : current?.exibir_na_home ?? true;
    const destaque = typeof body.destaque === 'boolean' ? body.destaque : current?.destaque ?? false;
    const rowId = current?.id ?? `site-emp-${empreendimentoId}`;
    const slug = typeof body.slug === 'string' && body.slug.trim().length > 0
      ? body.slug.trim()
      : current?.slug ?? `empreendimento-${empreendimentoId}`;
    const headline = typeof body.headline === 'string' ? body.headline.trim() : current?.headline ?? '';
    const resumo = typeof body.resumo === 'string' ? body.resumo.trim() : current?.resumo ?? '';
    const descricao = typeof body.descricao === 'string' ? body.descricao.trim() : current?.descricao ?? '';
    const heroImageUrl = typeof body.heroImageUrl === 'string' ? body.heroImageUrl.trim() : current?.hero_image_url ?? '';
    const ctaLabel = typeof body.ctaLabel === 'string' && body.ctaLabel.trim().length > 0 ? body.ctaLabel.trim() : current?.cta_label ?? 'Quero saber mais';
    const ctaTarget = typeof body.ctaTarget === 'string' ? body.ctaTarget.trim() : current?.cta_target ?? '';
    const tags = Array.isArray(body.tags) ? body.tags.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : (Array.isArray(current?.tags) ? current.tags : []);
    const highlights = Array.isArray(body.highlights) ? body.highlights.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : (Array.isArray(current?.highlights) ? current.highlights : []);
    const currentMetadata = (current?.metadata ?? {}) as SiteProjectMetadata;
    const metadata: SiteProjectMetadata = {
      ...currentMetadata,
      ...(typeof body.videoUrl === 'string' ? { videoUrl: body.videoUrl.trim() } : {}),
      ...(typeof body.vagasLabel === 'string' ? { vagasLabel: body.vagasLabel.trim() } : {}),
      ...(typeof body.displayName === 'string' ? { displayName: body.displayName.trim() } : {}),
      ...(typeof body.shortDescription === 'string' ? { shortDescription: body.shortDescription.trim() } : {}),
      ...(typeof body.locationLabel === 'string' ? { locationLabel: body.locationLabel.trim() } : {}),
      ...(typeof body.addressLine === 'string' ? { addressLine: body.addressLine.trim() } : {}),
      ...(typeof body.stageLabel === 'string' ? { stageLabel: body.stageLabel.trim() } : {}),
      ...(typeof body.deliveryLabel === 'string' ? { deliveryLabel: body.deliveryLabel.trim() } : {}),
      ...(typeof body.areaLabel === 'string' ? { areaLabel: body.areaLabel.trim() } : {}),
      ...(typeof body.bedroomsLabel === 'string' ? { bedroomsLabel: body.bedroomsLabel.trim() } : {}),
      ...(typeof body.suitesLabel === 'string' ? { suitesLabel: body.suitesLabel.trim() } : {}),
      ...(typeof body.parkingLabel === 'string' ? { parkingLabel: body.parkingLabel.trim() } : {}),
      ...(typeof body.floorsLabel === 'string' ? { floorsLabel: body.floorsLabel.trim() } : {}),
      ...(typeof body.unitsLabel === 'string' ? { unitsLabel: body.unitsLabel.trim() } : {}),
      ...(typeof body.cardHeroImageUrl === 'string' ? { cardHeroImageUrl: body.cardHeroImageUrl.trim() } : {}),
      ...(typeof body.detailHeroImageUrl === 'string' ? { detailHeroImageUrl: body.detailHeroImageUrl.trim() } : {}),
      ...(typeof body.logoUrl === 'string' ? { logoUrl: body.logoUrl.trim() } : {}),
      ...(typeof body.heroVideoUrl === 'string' ? { heroVideoUrl: body.heroVideoUrl.trim() } : {}),
      ...(typeof body.cardVideoUrl === 'string' ? { cardVideoUrl: body.cardVideoUrl.trim() } : {}),
      ...(typeof body.whatsappNumber === 'string' ? { whatsappNumber: body.whatsappNumber.trim() } : {}),
      ...(typeof body.clientPortalUrl === 'string' ? { clientPortalUrl: body.clientPortalUrl.trim() } : {}),
      ...(typeof body.technicalAssistUrl === 'string' ? { technicalAssistUrl: body.technicalAssistUrl.trim() } : {}),
    };

    await sql`
      INSERT INTO site_public_empreendimentos (
        id, slug, nome, status_publicacao, destaque, exibir_na_home, crm_empreendimento_id,
        cidade, bairro, headline, resumo, descricao, hero_image_url, cta_label, cta_target, tags, highlights, metadata, updated_at
      ) VALUES (
        ${rowId},
        ${slug},
        ${current?.nome ?? crm.nome},
        ${enabled ? 'published' : 'draft'},
        ${destaque},
        ${showOnHome},
        ${empreendimentoId},
        ${current?.cidade ?? ''},
        ${current?.bairro ?? ''},
        ${headline},
        ${resumo},
        ${descricao},
        ${heroImageUrl},
        ${ctaLabel},
        ${ctaTarget},
        ${JSON.stringify(tags)},
        ${JSON.stringify(highlights)},
        ${JSON.stringify(metadata)},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        status_publicacao = EXCLUDED.status_publicacao,
        destaque = EXCLUDED.destaque,
        exibir_na_home = EXCLUDED.exibir_na_home,
        headline = EXCLUDED.headline,
        resumo = EXCLUDED.resumo,
        descricao = EXCLUDED.descricao,
        hero_image_url = EXCLUDED.hero_image_url,
        cta_label = EXCLUDED.cta_label,
        cta_target = EXCLUDED.cta_target,
        tags = EXCLUDED.tags,
        highlights = EXCLUDED.highlights,
        metadata = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at
    `;

    try {
      await pushEmpreendimentoConfig(empreendimentoId, {
        ...(typeof body.shortDescription === 'string' ? { descricaoCurta: body.shortDescription.trim() } : {}),
        ...(typeof body.descricao === 'string' ? { descricao: descricao } : {}),
        ...(typeof body.logoUrl === 'string' ? { logoUrl: body.logoUrl.trim() } : {}),
        ...(typeof body.videoUrl === 'string' ? { videoUrl: body.videoUrl.trim() } : {}),
        ...(typeof body.vagasLabel === 'string' ? { vagasLabel: body.vagasLabel.trim() } : {}),
      });
    } catch (pushError) {
      logger.error({ pushError, empreendimentoId }, '[site-vision/project-detail] falha ao sincronizar conteudo com o site real');
      return NextResponse.json(
        { error: `Salvo localmente, mas não foi possível sincronizar com o site real: ${pushError instanceof Error ? pushError.message : pushError}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error({ error }, '[site-vision/project-detail] erro ao atualizar publicacao:');
    return NextResponse.json({ error: 'Erro ao atualizar empreendimento.' }, { status: 500 });
  }
}
