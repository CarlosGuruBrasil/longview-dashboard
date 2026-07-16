import { readUsers } from '@/lib/db-kv';
import { ensureSchema, sql } from '@/lib/pg';

export type PublicProjectSummary = {
  id: string;
  slug: string;
  nome: string;
  cidade: string;
  bairro: string;
  headline: string;
  resumo: string;
  heroImageUrl: string;
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
  tags: string[];
  highlights: string[];
  mediaAssets: PublicMediaAsset[];
  gatedAssets: PublicGatedAsset[];
  resales: PublicResale[];
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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
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

  const [mediaAssets, gatedAssets, resales, statsRows] = await Promise.all([
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
  ]);

  const stats = statsRows[0] ?? { total_units: 0, available_units: 0, reserved_units: 0, sold_units: 0 };

  return {
    id: project.id,
    slug: project.slug,
    nome: project.nome,
    cidade: project.cidade,
    bairro: project.bairro,
    headline: project.headline,
    resumo: project.resumo,
    descricao: project.descricao,
    heroImageUrl: project.hero_image_url,
    ctaLabel: project.cta_label,
    ctaTarget: project.cta_target,
    destaque: project.destaque,
    exibirNaHome: project.exibir_na_home,
    mediaCount: mediaAssets.length,
    publishedAt: project.published_at,
    tags: asStringArray(project.tags),
    highlights: asStringArray(project.highlights),
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
