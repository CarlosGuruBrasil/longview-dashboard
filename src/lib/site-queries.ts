import { sql } from '@/lib/pg';
import { readProjects, readUsers } from '@/lib/db-kv';
import logger from '@/lib/logger';

// ============================================================================
// TIPOS
// ============================================================================

export type LeadStatusRow = { status: string | null; total: string | number };
export type CountRow = { total: string | number };
export type LatestSyncRow = { latest: string | null };
export type CrmProjectRow = { id: number; nome: string; situacao: string | null; tipo: string | null };

export type SiteProjectRow = {
  id: string;
  slug: string;
  nome: string;
  status_publicacao: 'draft' | 'published' | 'archived';
  destaque: boolean;
  crm_empreendimento_id: number | null;
  crm_nome: string | null;
  cidade: string;
  bairro: string;
  hero_image_url: string;
  updated_at: string;
  media_count: string | number;
};

export type InventoryRow = {
  id: number;
  nome: string;
  total_units: string | number;
  available_units: string | number;
  reserved_units: string | number;
  sold_units: string | number;
  linked_pages: string | number;
};

export type ResaleRow = {
  id: string;
  slug: string;
  status_publicacao: 'draft' | 'published' | 'archived' | 'sold';
  destaque: boolean;
  titulo_publico: string;
  preco_revenda: string | number | null;
  corretor_nome: string;
  hero_image_url: string;
  updated_at: string;
  cv_unidade_id: number;
  cv_empreendimento_id: number;
  empreendimento_nome: string | null;
  unidade_numero: string | null;
  unidade_bloco: string | null;
};

export type GatedAssetRow = {
  id: string;
  title: string;
  slug: string;
  asset_type: 'ebook' | 'brochure' | 'document';
  active: boolean;
  size_bytes: string | number | null;
  updated_at: string;
  empreendimento_nome: string | null;
  leads: string | number;
};

// Tipos públicos para o site
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

export type PublicTeamMember = {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  position: string;
  company: string;
  avatarUrl: string | null;
  visible: boolean;
};

// ============================================================================
// HELPERS
// ============================================================================

export function asNumber(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

// ============================================================================
// QUERIES — Published Projects (para site público)
// ============================================================================

export async function listPublishedProjects(): Promise<PublicProjectSummary[]> {
  const rows = await sql<any[]>`
    SELECT
      e.id,
      e.slug,
      e.nome,
      COALESCE(e.nome_publico, e.nome) AS displayName,
      e.cidade,
      e.bairro,
      CONCAT(e.cidade, ' - ', e.bairro) AS locationLabel,
      e.headline,
      e.resumo,
      COALESCE(e.descricao_curta, e.resumo) AS shortDescription,
      e.hero_image_url AS heroImageUrl,
      COALESCE(e.hero_image_url, e.logo_url) AS cardHeroImageUrl,
      e.logo_url AS logoUrl,
      e.estagio_label AS stageLabel,
      e.entrega_label AS deliveryLabel,
      COALESCE(e.cta_label, 'Ver detalhes') AS ctaLabel,
      COALESCE(e.cta_target, e.slug) AS ctaTarget,
      e.destaque,
      e.exibir_na_home AS exibirNaHome,
      COUNT(m.id) AS mediaCount,
      e.updated_at::text AS publishedAt
    FROM site_public_empreendimentos e
    LEFT JOIN site_public_media_assets m ON m.empreendimento_id = e.id
    WHERE e.status_publicacao = 'published'
    GROUP BY e.id
    ORDER BY e.destaque DESC, e.updated_at DESC
  `;

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    nome: r.nome,
    displayName: r.displayname,
    cidade: r.cidade,
    bairro: r.bairro,
    locationLabel: r.locationlabel,
    headline: r.headline,
    resumo: r.resumo,
    shortDescription: r.shortdescription,
    heroImageUrl: r.heroimageurl,
    cardHeroImageUrl: r.cardheroimageurl,
    logoUrl: r.logo_url,
    stageLabel: r.stagelabel,
    deliveryLabel: r.deliverylabel,
    ctaLabel: r.ctalabel,
    ctaTarget: r.ctatarget,
    destaque: r.destaque,
    exibirNaHome: r.exibir_na_home,
    mediaCount: asNumber(r.mediacount),
    publishedAt: r.publishedat,
  }));
}

// ============================================================================
// QUERIES — Team Members (para site público)
// ============================================================================

export async function listPublicTeamMembers(): Promise<PublicTeamMember[]> {
  const rows = await sql<any[]>`
    SELECT
      id,
      name,
      email,
      phone,
      whatsapp,
      position,
      company,
      avatar_url AS avatarUrl,
      visible
    FROM site_public_team_members
    WHERE visible = true
    ORDER BY position, name
  `;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    whatsapp: r.whatsapp,
    position: r.position,
    company: r.company,
    avatarUrl: r.avatarurl,
    visible: r.visible,
  }));
}
