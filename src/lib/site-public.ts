import { readUsers } from '@/lib/db-kv';
import { ensureSchema, sql } from '@/lib/pg';

export type PublicProjectSummary = {
  id: string;
  slug: string;
  nome: string;
  displayName: string;
  cidade: string;
  bairro: string;
  locationLabel: string;
  headline: string;
  resumo: string;
  shortDescription: string;
  heroImageUrl: string;
  cardHeroImageUrl: string;
  logoUrl: string;
  stageLabel: string;
  deliveryLabel: string;
  ctaLabel: string;
  ctaTarget: string;
  destaque: boolean;
  exibirNaHome: boolean;
  mediaCount: number;
  publishedAt: string | null;
};

export type PublicMediaAsset = {
  id: string;
  kind: string;
  title: string;
  altText: string;
  publicUrl: string;
  thumbnailUrl: string;
  isPrimary: boolean;
  sortOrder: number;
};

export type PublicGatedAsset = {
  id: string;
  title: string;
  slug: string;
  type: 'ebook' | 'brochure' | 'document';
  publicUrl: string;
  thumbnailUrl: string;
  leadTag: string;
};

export type PublicResale = {
  id: string;
  slug: string;
  title: string;
  price: number | null;
  heroImageUrl: string;
  brokerName: string;
};

export type PublicProjectDetail = PublicProjectSummary & {
  descricao: string;
  addressLine: string;
  detailHeroImageUrl: string;
  heroVideoUrl: string;
  cardVideoUrl: string;
  whatsappNumber: string;
  clientPortalUrl: string;
  technicalAssistUrl: string;
  tags: string[];
  highlights: string[];
  specs: Array<{ label: string; value: string }>;
  mediaAssets: PublicMediaAsset[];
  gatedAssets: PublicGatedAsset[];
  resales: PublicResale[];
  visibleUnits: Array<{
    id: number;
    bloco: string;
    numero: string;
    tipologia: string;
    areaPrivativa: string;
    bedrooms: string;
    suites: string;
    parkingSpaces: string;
    priceLabel: string;
    statusLabel: string;
  }>;
  stats: {
    totalUnits: number;
    availableUnits: number;
    reservedUnits: number;
    soldUnits: number;
  };
};

export type PublicTeamMember = {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  position: string;
  company: string;
  avatarUrl: string;
  professionalId: string;
  professionalIdType: string;
};

type SiteTeamSettings = {
  visibleUserIds: string[];
};

type PublicProjectMetadata = {
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
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function asProjectMetadata(value: unknown): PublicProjectMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as PublicProjectMetadata;
}

function safeMetadataString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatMoneyLabel(value: string | number | null | undefined) {
  if (value == null || value === '') return 'Sob consulta';
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 'Sob consulta';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(parsed);
}

function isBrokerCandidate(user: Awaited<ReturnType<typeof readUsers>>[number]) {
  const position = (user.profile?.position ?? '').toLowerCase();
  const professionalType = (user.profile?.professionalIdType ?? '').toLowerCase();
  return (
    user.role === 'Corretor' ||
    professionalType === 'creci' ||
    position.includes('corretor') ||
    position.includes('consultor')
  );
}

export async function listPublishedProjects(): Promise<PublicProjectSummary[]> {
  await ensureSchema();
  const rows = await sql<{
    id: string;
    slug: string;
    nome: string;
    cidade: string;
    bairro: string;
    headline: string;
    resumo: string;
    hero_image_url: string;
    metadata: unknown;
    cta_label: string;
    cta_target: string;
    destaque: boolean;
    exibir_na_home: boolean;
    media_count: number;
    published_at: string | null;
  }[]>`
    SELECT
      e.id,
      e.slug,
      e.nome,
      e.cidade,
      e.bairro,
      e.headline,
      e.resumo,
      e.hero_image_url,
      e.metadata,
      e.cta_label,
      e.cta_target,
      e.destaque,
      e.exibir_na_home,
      COUNT(m.id)::int AS media_count,
      e.published_at
    FROM site_public_empreendimentos e
    LEFT JOIN site_public_media_assets m ON m.empreendimento_id = e.id
    WHERE e.status_publicacao = 'published'
    GROUP BY e.id
    ORDER BY e.destaque DESC, e.exibir_na_home DESC, e.updated_at DESC
  `;

  return rows.map((row) => ({
    ...(function () {
      const metadata = asProjectMetadata(row.metadata);
      const displayName = safeMetadataString(metadata.displayName) || row.nome;
      const locationLabel = safeMetadataString(metadata.locationLabel) || [row.bairro, row.cidade].filter(Boolean).join(' • ');
      const shortDescription = safeMetadataString(metadata.shortDescription) || row.headline || row.resumo;
      const cardHeroImageUrl = safeMetadataString(metadata.cardHeroImageUrl) || row.hero_image_url;
      return {
        displayName,
        locationLabel,
        shortDescription,
        cardHeroImageUrl,
        logoUrl: safeMetadataString(metadata.logoUrl),
        stageLabel: safeMetadataString(metadata.stageLabel),
        deliveryLabel: safeMetadataString(metadata.deliveryLabel),
      };
    })(),
    id: row.id,
    slug: row.slug,
    nome: row.nome,
    cidade: row.cidade,
    bairro: row.bairro,
    headline: row.headline,
    resumo: row.resumo,
    heroImageUrl: row.hero_image_url,
    ctaLabel: row.cta_label,
    ctaTarget: row.cta_target,
    destaque: row.destaque,
    exibirNaHome: row.exibir_na_home,
    mediaCount: Number(row.media_count ?? 0),
    publishedAt: row.published_at,
  }));
}

export async function getPublishedProjectBySlug(slug: string): Promise<PublicProjectDetail | null> {
  await ensureSchema();

  const [project] = await sql<{
    id: string;
    slug: string;
    nome: string;
    cidade: string;
    bairro: string;
    headline: string;
    resumo: string;
    descricao: string;
    hero_image_url: string;
    metadata: unknown;
    cta_label: string;
    cta_target: string;
    destaque: boolean;
    exibir_na_home: boolean;
    tags: unknown;
    highlights: unknown;
    crm_empreendimento_id: number | null;
    published_at: string | null;
  }[]>`
    SELECT
      id,
      slug,
      nome,
      cidade,
      bairro,
      headline,
      resumo,
      descricao,
      hero_image_url,
      metadata,
      cta_label,
      cta_target,
      destaque,
      exibir_na_home,
      tags,
      highlights,
      crm_empreendimento_id,
      published_at
    FROM site_public_empreendimentos
    WHERE LOWER(slug) = LOWER(${slug}) AND status_publicacao = 'published'
    LIMIT 1
  `;

  if (!project) return null;

  const [mediaAssets, gatedAssets, resales, statsRows, visibleUnitsRows] = await Promise.all([
    sql<{
      id: string;
      kind: string;
      title: string;
      alt_text: string;
      public_url: string;
      thumbnail_url: string;
      is_primary: boolean;
      sort_order: number;
    }[]>`
      SELECT id, kind, title, alt_text, public_url, thumbnail_url, is_primary, sort_order
      FROM site_public_media_assets
      WHERE empreendimento_id = ${project.id}
      ORDER BY is_primary DESC, sort_order ASC, created_at DESC
    `,
    sql<{
      id: string;
      title: string;
      slug: string;
      asset_type: 'ebook' | 'brochure' | 'document';
      public_url: string;
      thumbnail_url: string;
      lead_tag: string;
    }[]>`
      SELECT id, title, slug, asset_type, public_url, thumbnail_url, lead_tag
      FROM site_public_gated_assets
      WHERE site_empreendimento_id = ${project.id} AND active = true
      ORDER BY updated_at DESC
    `,
    sql<{
      id: string;
      slug: string;
      titulo_publico: string;
      preco_revenda: string | number | null;
      hero_image_url: string;
      corretor_nome: string;
      cv_unidade_id: number;
    }[]>`
      SELECT id, slug, titulo_publico, preco_revenda, hero_image_url, corretor_nome, cv_unidade_id
      FROM site_public_resales
      WHERE cv_empreendimento_id = ${project.crm_empreendimento_id ?? -1} AND status_publicacao = 'published'
      ORDER BY destaque DESC, updated_at DESC
    `,
    sql<{
      total_units: number;
      available_units: number;
      reserved_units: number;
      sold_units: number;
    }[]>`
      SELECT
        COUNT(*)::int AS total_units,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(u.status, '')) LIKE '%disp%')::int AS available_units,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(u.status, '')) LIKE '%res%')::int AS reserved_units,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(u.status, '')) LIKE '%vend%' OR u.status_venda = 3)::int AS sold_units
      FROM cv_unidades u
      LEFT JOIN site_public_unit_visibility v ON v.cv_unidade_id = u.id
      WHERE u.id_empreendimento = ${project.crm_empreendimento_id ?? -1}
        AND COALESCE(v.visible_on_site, true) = true
    `,
    sql<{
      id: number;
      bloco: string | null;
      numero: string | null;
      status: string | null;
      valor: string | number | null;
      metragem: string | number | null;
      tipologia: string | null;
      raw: Record<string, unknown>;
    }[]>`
      SELECT u.id, u.bloco, u.numero, u.status, u.valor, u.metragem, u.tipologia, u.raw
      FROM cv_unidades u
      LEFT JOIN site_public_unit_visibility v ON v.cv_unidade_id = u.id
      WHERE u.id_empreendimento = ${project.crm_empreendimento_id ?? -1}
        AND COALESCE(v.visible_on_site, true) = true
      ORDER BY
        CASE
          WHEN LOWER(COALESCE(u.status, '')) LIKE '%disp%' THEN 0
          WHEN LOWER(COALESCE(u.status, '')) LIKE '%res%' THEN 1
          ELSE 2
        END,
        COALESCE(u.valor, 0) ASC,
        u.id ASC
      LIMIT 6
    `,
  ]);

  const stats = statsRows[0] ?? { total_units: 0, available_units: 0, reserved_units: 0, sold_units: 0 };
  const metadata = asProjectMetadata(project.metadata);
  const displayName = safeMetadataString(metadata.displayName) || project.nome;
  const locationLabel = safeMetadataString(metadata.locationLabel) || [project.bairro, project.cidade].filter(Boolean).join(' • ');
  const shortDescription = safeMetadataString(metadata.shortDescription) || project.headline || project.resumo;
  const cardHeroImageUrl = safeMetadataString(metadata.cardHeroImageUrl) || project.hero_image_url;
  const detailHeroImageUrl = safeMetadataString(metadata.detailHeroImageUrl) || project.hero_image_url;
  const unitSpecs = [
    { label: 'Área privativa', value: safeMetadataString(metadata.areaLabel) },
    { label: 'Dormitórios', value: safeMetadataString(metadata.bedroomsLabel) },
    { label: 'Suítes', value: safeMetadataString(metadata.suitesLabel) },
    { label: 'Vagas', value: safeMetadataString(metadata.parkingLabel) },
    { label: 'Andares', value: safeMetadataString(metadata.floorsLabel) },
    { label: 'Unidades', value: safeMetadataString(metadata.unitsLabel) },
  ].filter((item) => item.value);

  return {
    id: project.id,
    slug: project.slug,
    nome: project.nome,
    displayName,
    cidade: project.cidade,
    bairro: project.bairro,
    locationLabel,
    headline: project.headline,
    resumo: project.resumo,
    shortDescription,
    descricao: project.descricao,
    addressLine: safeMetadataString(metadata.addressLine),
    heroImageUrl: project.hero_image_url,
    cardHeroImageUrl,
    detailHeroImageUrl,
    logoUrl: safeMetadataString(metadata.logoUrl),
    stageLabel: safeMetadataString(metadata.stageLabel),
    deliveryLabel: safeMetadataString(metadata.deliveryLabel),
    heroVideoUrl: safeMetadataString(metadata.heroVideoUrl),
    cardVideoUrl: safeMetadataString(metadata.cardVideoUrl),
    whatsappNumber: safeMetadataString(metadata.whatsappNumber),
    clientPortalUrl: safeMetadataString(metadata.clientPortalUrl),
    technicalAssistUrl: safeMetadataString(metadata.technicalAssistUrl),
    ctaLabel: project.cta_label,
    ctaTarget: project.cta_target,
    destaque: project.destaque,
    exibirNaHome: project.exibir_na_home,
    mediaCount: mediaAssets.length,
    publishedAt: project.published_at,
    tags: asStringArray(project.tags),
    highlights: asStringArray(project.highlights),
    specs: unitSpecs,
    mediaAssets: mediaAssets.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      altText: row.alt_text,
      publicUrl: row.public_url,
      thumbnailUrl: row.thumbnail_url,
      isPrimary: row.is_primary,
      sortOrder: row.sort_order,
    })),
    gatedAssets: gatedAssets.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      type: row.asset_type,
      publicUrl: row.public_url,
      thumbnailUrl: row.thumbnail_url,
      leadTag: row.lead_tag,
    })),
    resales: resales.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.titulo_publico || `Revenda ${row.cv_unidade_id}`,
      price: row.preco_revenda == null ? null : Number(row.preco_revenda),
      heroImageUrl: row.hero_image_url,
      brokerName: row.corretor_nome,
    })),
    visibleUnits: visibleUnitsRows.map((row) => ({
      id: row.id,
      bloco: row.bloco ?? '',
      numero: row.numero ?? '',
      tipologia: row.tipologia ?? '',
      areaPrivativa: safeMetadataString(row.raw?.area_privativa) || safeMetadataString(row.raw?.areaprivativa) || (row.metragem == null ? '' : String(row.metragem)),
      bedrooms: safeMetadataString(row.raw?.dormitorios) || safeMetadataString(row.raw?.quartos),
      suites: safeMetadataString(row.raw?.suites),
      parkingSpaces: safeMetadataString(row.raw?.vagas) || safeMetadataString(row.raw?.vaga_garagem) || safeMetadataString(row.raw?.numero_vagas),
      priceLabel: formatMoneyLabel(row.valor),
      statusLabel: row.status || 'Disponibilidade em atualização',
    })),
    stats: {
      totalUnits: Number(stats.total_units ?? 0),
      availableUnits: Number(stats.available_units ?? 0),
      reservedUnits: Number(stats.reserved_units ?? 0),
      soldUnits: Number(stats.sold_units ?? 0),
    },
  };
}

export async function listPublicTeamMembers(): Promise<PublicTeamMember[]> {
  await ensureSchema();
  const [users, settingsRows] = await Promise.all([
    readUsers(),
    sql<{ value: SiteTeamSettings }[]>`
      SELECT value
      FROM site_public_settings
      WHERE key = 'site_team_visibility'
      LIMIT 1
    `,
  ]);

  const settings = settingsRows[0]?.value ?? { visibleUserIds: [] };
  const visibleIds = new Set(Array.isArray(settings.visibleUserIds) ? settings.visibleUserIds : []);

  return users
    .filter((entry) => isBrokerCandidate(entry))
    .filter((entry) => (visibleIds.size === 0 ? true : visibleIds.has(entry.id)))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      email: entry.email,
      phone: entry.profile?.phone ?? '',
      whatsapp: entry.profile?.whatsapp ?? '',
      position: entry.profile?.position ?? entry.role,
      company: entry.profile?.company ?? 'LongView',
      avatarUrl: entry.profile?.avatarUrl ?? '',
      professionalId: entry.profile?.professionalId ?? '',
      professionalIdType: entry.profile?.professionalIdType ?? '',
    }));
}
