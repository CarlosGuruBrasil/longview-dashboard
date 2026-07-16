import { NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { readProjects, readUsers } from '@/lib/db-kv';
import logger from '@/lib/logger';

type LeadStatusRow = { status: string | null; total: string | number };
type LatestSyncRow = { latest: string | null };
type CountRow = { total: string | number };
type CrmProjectRow = { id: number; nome: string; situacao: string | null; tipo: string | null };
type SiteOverviewRow = {
  site_projects: string | number;
  published_projects: string | number;
  draft_projects: string | number;
  featured_projects: string | number;
  linked_crm_projects: string | number;
  media_assets: string | number;
  site_leads: string | number;
  pending_site_leads: string | number;
  delivered_site_leads: string | number;
  failed_site_leads: string | number;
  resales: string | number;
  published_resales: string | number;
  internal_tables: string | number;
  gated_assets: string | number;
  analytics_events: string | number;
  cookie_consents: string | number;
  page_snapshots: string | number;
};
type SiteProjectRow = {
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
type InventoryRow = {
  id: number;
  nome: string;
  total_units: string | number;
  available_units: string | number;
  reserved_units: string | number;
  sold_units: string | number;
  linked_pages: string | number;
};
type ResaleRow = {
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
type InternalTableRow = {
  id: string;
  title: string;
  version_label: string;
  size_bytes: string | number | null;
  created_at: string;
  empreendimento_nome: string | null;
};
type GatedAssetRow = {
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
type TopPageRow = {
  page_type: string;
  page_key: string;
  page_path: string;
  views: string | number;
  unique_sessions: string | number;
  lead_submissions: string | number;
  cta_clicks: string | number;
  whatsapp_clicks: string | number;
  updated_at: string;
};
type TopCtaRow = {
  button_name: string;
  total: string | number;
  latest: string | null;
};
type AnalyticsTotalsRow = {
  sessions: string | number;
  page_views: string | number;
  cta_clicks: string | number;
  whatsapp_clicks: string | number;
  ebook_downloads: string | number;
  analytics_consents: string | number;
  marketing_consents: string | number;
};
type SiteLeadSyncRow = {
  latest_site_lead: string | null;
  latest_cvcrm_dispatch: string | null;
};
type SiteWarningRow = {
  drafts: string | number;
  sem_crm: string | number;
  sem_midia: string | number;
  sem_hero: string | number;
  revendas_sem_hero: string | number;
};
type SyncRunRow = {
  id: number;
  integration: 'cvcrm' | 'site-api' | 'media-import' | 'legacy-sync';
  status: 'success' | 'warning' | 'error' | 'running';
  scope: string;
  summary: string;
  created_at: string;
};
type IntegrationHealthRow = {
  integration_key: string;
  latest_status: 'received' | 'processed' | 'sent' | 'warning' | 'error' | 'skipped' | null;
  latest_summary: string | null;
  latest_created_at: string | null;
  events_24h: string | number;
  issues_24h: string | number;
  ok_24h: string | number;
};

function asNumber(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

async function runQuery<T>(label: string, fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (error) {
    logger.error({ error, label }, '[site-vision] query failed:');
    throw error;
  }
}

async function runOptionalQuery<T>(label: string, fallback: unknown, fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === '42P01' || pgError.code === '42703') {
      logger.warn({ label, code: pgError.code }, '[site-vision] optional query fallback applied:');
      return fallback as T;
    }
    logger.error({ error, label }, '[site-vision] optional query failed:');
    throw error;
  }
}

const SITE_TABLES = [
  'site_public_settings',
  'site_public_empreendimentos',
  'site_public_media_assets',
  'site_public_lead_submissions',
  'site_public_sync_runs',
  'site_public_resales',
  'site_public_internal_tables',
  'site_public_gated_assets',
  'site_public_analytics_events',
  'site_public_cookie_consents',
  'site_public_page_snapshots',
] as const;

type SiteTableRow = { table_name: string };

export async function GET(request: Request) {
  const user = await verifyPermission('viewSiteVision');
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  try {
    const scope = new URL(request.url).searchParams.get('scope');
    const [projects, users] = await Promise.all([readProjects(), readUsers()]);

    const userBreakdown = users.reduce(
      (acc, current) => {
        acc.total += 1;
        if (current.permissions?.isAdmin === true || current.role === 'Desenvolvedor') acc.admins += 1;
        if (current.role === 'Corretor') acc.corretores += 1;
        if (current.role === 'Parceiro') acc.parceiros += 1;
        return acc;
      },
      { total: 0, admins: 0, corretores: 0, parceiros: 0 }
    );

    const payload = {
      overview: {
        internalProjects: projects.length,
        crmProjects: 0,
        siteProjects: 0,
        publishedProjects: 0,
        draftProjects: 0,
        featuredProjects: 0,
        linkedCrmProjects: 0,
        leads: 0,
        siteLeads: 0,
        pendingSiteLeads: 0,
        deliveredSiteLeads: 0,
        failedSiteLeads: 0,
        units: 0,
        soldUnits: 0,
        materials: 0,
        mediaAssets: 0,
        resales: 0,
        publishedResales: 0,
        internalTables: 0,
        gatedAssets: 0,
        analyticsEvents: 0,
        cookieConsents: 0,
        pageSnapshots: 0,
      },
      leadStatus: [] as Array<{ status: string; total: number }>,
      siteLeadStatus: [] as Array<{ status: string; total: number }>,
      crmPortfolio: [] as Array<{ id: number; nome: string; situacao: string | null; tipo: string | null }>,
      sitePortfolio: [] as Array<{
        id: string;
        slug: string;
        nome: string;
        status: 'draft' | 'published' | 'archived';
        destaque: boolean;
        crmProjectId: number | null;
        crmNome: string | null;
        cidade: string;
        bairro: string;
        heroImageUrl: string;
        mediaCount: number;
        updatedAt: string;
      }>,
      inventory: [] as Array<{
        id: number;
        nome: string;
        totalUnits: number;
        availableUnits: number;
        reservedUnits: number;
        soldUnits: number;
        linkedPages: number;
      }>,
      resales: [] as Array<{
        id: string;
        slug: string;
        title: string;
        status: 'draft' | 'published' | 'archived' | 'sold';
        destaque: boolean;
        projectName: string | null;
        cvUnitId: number;
        heroImageUrl: string;
        brokerName: string;
        price: number | null;
        unitLabel: string;
        updatedAt: string;
      }>,
      internalTables: [] as Array<{
        id: string;
        title: string;
        projectName: string | null;
        versionLabel: string;
        sizeBytes: number | null;
        createdAt: string;
      }>,
      gatedAssets: [] as Array<{
        id: string;
        title: string;
        slug: string;
        type: 'ebook' | 'brochure' | 'document';
        active: boolean;
        projectName: string | null;
        sizeBytes: number | null;
        leads: number;
        updatedAt: string;
      }>,
      analytics: {
        sessions: 0,
        pageViews: 0,
        ctaClicks: 0,
        whatsappClicks: 0,
        ebookDownloads: 0,
        analyticsConsents: 0,
        marketingConsents: 0,
      },
      topPages: [] as Array<{
        pageType: string;
        pageKey: string;
        path: string;
        views: number;
        uniqueSessions: number;
        leads: number;
        ctaClicks: number;
        whatsappClicks: number;
        updatedAt: string;
      }>,
      topCtas: [] as Array<{
        name: string;
        total: number;
        latestAt: string | null;
      }>,
      timestamps: {
        leadsSyncAt: null as string | null,
        estoqueSyncAt: null as string | null,
        siteContentSyncAt: null as string | null,
        latestSiteLeadAt: null as string | null,
        latestLeadDispatchAt: null as string | null,
      },
      integrations: [
        {
          key: 'database',
          label: 'Banco principal',
          status: process.env.DATABASE_URL ? 'online' : 'offline',
          value: process.env.DATABASE_URL ? 'Postgres configurado' : 'Sem Postgres',
          description: process.env.DATABASE_URL
            ? 'O dashboard e o Site Vision usam a mesma base principal com isolamento lógico.'
            : 'Sem DATABASE_URL, o modulo opera apenas com dados locais.',
        },
        {
          key: 'site-schema',
          label: 'Camada do site',
          status: process.env.DATABASE_URL ? 'warning' : 'offline',
          value: process.env.DATABASE_URL ? 'Aguardando leitura' : 'Indisponivel',
          description: 'Reune conteudo, midias, revendas, leads, analytics e governanca do portal.',
        },
        {
          key: 'cvcrm',
          label: 'CV CRM',
          status: process.env.CV_CRM_EMAIL && process.env.CV_CRM_TOKEN ? 'online' : 'warning',
          value: process.env.CV_CRM_EMAIL && process.env.CV_CRM_TOKEN ? 'Credenciais presentes' : 'Credenciais ausentes',
          description: 'Integra estoque, empreendimentos e o despacho comercial dos leads.',
        },
        {
          key: 'analytics',
          label: 'Analytics',
          status: 'warning',
          value: 'Aguardando eventos',
          description: 'Vai consolidar GA4, eventos proprios, paginas mais vistas e CTAs mais clicados.',
        },
      ],
      projectPortfolio: projects.slice(0, 8),
      userBreakdown,
      contentWarnings: [] as Array<{ key: string; label: string; total: number; description: string }>,
      syncRuns: [] as Array<{
        id: number;
        integration: string;
        status: 'success' | 'warning' | 'error' | 'running';
        scope: string;
        summary: string;
        createdAt: string;
      }>,
      integrationHealth: [] as Array<{
        key: string;
        latestStatus: string | null;
        latestSummary: string | null;
        latestAt: string | null;
        events24h: number;
        issues24h: number;
        ok24h: number;
      }>,
      schema: {
        siteTables: 0,
        siteReady: false,
      },
    };

    if (!process.env.DATABASE_URL) {
      if (scope === 'portfolio') {
        return NextResponse.json({
          crmPortfolio: payload.crmPortfolio,
          sitePortfolio: payload.sitePortfolio,
        });
      }
      return NextResponse.json(payload);
    }

    const { ensureSchema, sql } = await import('@/lib/pg');
    await ensureSchema();

    const [
      crmProjectsCountRows,
      leadsCountRows,
      unitsCountRows,
      soldUnitsCountRows,
      materialsCountRows,
      leadStatusRows,
      latestLeadSyncRows,
      latestStockSyncRows,
      crmPortfolioRows,
      siteOverviewRows,
      siteLeadStatusRows,
      sitePortfolioRows,
      inventoryRows,
      resaleRows,
      internalTableRows,
      gatedAssetRows,
      analyticsTotalsRows,
      topPageRows,
      topCtaRows,
      latestSiteContentRows,
      siteLeadSyncRows,
      siteWarningRows,
      siteTablesRows,
      syncRunsRows,
      integrationHealthRows,
    ] = await Promise.all([
      runQuery('crmProjectsCountRows', () => sql<CountRow[]>`SELECT COUNT(*) AS total FROM cv_empreendimentos`),
      runQuery('leadsCountRows', () => sql<CountRow[]>`SELECT COUNT(*) AS total FROM leads`),
      runQuery('unitsCountRows', () => sql<CountRow[]>`SELECT COUNT(*) AS total FROM cv_unidades`),
      runQuery('soldUnitsCountRows', () => sql<CountRow[]>`SELECT COUNT(*) AS total FROM cv_unidades WHERE status ILIKE '%vend%' OR status_venda = 3`),
      runQuery('materialsCountRows', () => sql<CountRow[]>`SELECT COUNT(*) AS total FROM cv_materiais`),
      runQuery('leadStatusRows', () => sql<LeadStatusRow[]>`
        SELECT COALESCE(status, 'Sem status') AS status, COUNT(*) AS total
        FROM leads
        GROUP BY COALESCE(status, 'Sem status')
        ORDER BY COUNT(*) DESC
        LIMIT 6
      `),
      runQuery('latestLeadSyncRows', () => sql<LatestSyncRow[]>`SELECT MAX(synced_at)::text AS latest FROM leads`),
      runQuery('latestStockSyncRows', () => sql<LatestSyncRow[]>`SELECT MAX(synced_at)::text AS latest FROM cv_empreendimentos`),
      runQuery('crmPortfolioRows', () => sql<CrmProjectRow[]>`
        SELECT id, nome, situacao, tipo
        FROM cv_empreendimentos
        ORDER BY synced_at DESC NULLS LAST, nome ASC
        LIMIT 8
      `),
      runOptionalQuery('siteOverviewRows', [{
        site_projects: 0,
        published_projects: 0,
        draft_projects: 0,
        featured_projects: 0,
        linked_crm_projects: 0,
        media_assets: 0,
        site_leads: 0,
        pending_site_leads: 0,
        delivered_site_leads: 0,
        failed_site_leads: 0,
        resales: 0,
        published_resales: 0,
        internal_tables: 0,
        gated_assets: 0,
        analytics_events: 0,
        cookie_consents: 0,
        page_snapshots: 0,
      }], () => sql<SiteOverviewRow[]>`
        SELECT
          COUNT(*) AS site_projects,
          COUNT(*) FILTER (WHERE status_publicacao = 'published') AS published_projects,
          COUNT(*) FILTER (WHERE status_publicacao = 'draft') AS draft_projects,
          COUNT(*) FILTER (WHERE destaque = true) AS featured_projects,
          COUNT(*) FILTER (WHERE crm_empreendimento_id IS NOT NULL) AS linked_crm_projects,
          (SELECT COUNT(*) FROM site_public_media_assets) AS media_assets,
          (SELECT COUNT(*) FROM site_public_lead_submissions) AS site_leads,
          (SELECT COUNT(*) FROM site_public_lead_submissions WHERE status = 'pending') AS pending_site_leads,
          (SELECT COUNT(*) FROM site_public_lead_submissions WHERE status IN ('sent', 'qualified')) AS delivered_site_leads,
          (SELECT COUNT(*) FROM site_public_lead_submissions WHERE status = 'error') AS failed_site_leads,
          (SELECT COUNT(*) FROM site_public_resales) AS resales,
          (SELECT COUNT(*) FROM site_public_resales WHERE status_publicacao = 'published') AS published_resales,
          (SELECT COUNT(*) FROM site_public_internal_tables) AS internal_tables,
          (SELECT COUNT(*) FROM site_public_gated_assets) AS gated_assets,
          (SELECT COUNT(*) FROM site_public_analytics_events) AS analytics_events,
          (SELECT COUNT(*) FROM site_public_cookie_consents) AS cookie_consents,
          (SELECT COUNT(*) FROM site_public_page_snapshots) AS page_snapshots
        FROM site_public_empreendimentos
      `),
      runQuery('siteLeadStatusRows', () => sql<LeadStatusRow[]>`
        SELECT COALESCE(status, 'pending') AS status, COUNT(*) AS total
        FROM site_public_lead_submissions
        GROUP BY COALESCE(status, 'pending')
        ORDER BY COUNT(*) DESC
        LIMIT 6
      `),
      runQuery('sitePortfolioRows', () => sql<SiteProjectRow[]>`
        SELECT
          e.id,
          e.slug,
          e.nome,
          e.status_publicacao,
          e.destaque,
          e.crm_empreendimento_id,
          c.nome AS crm_nome,
          e.cidade,
          e.bairro,
          e.hero_image_url,
          e.updated_at::text AS updated_at,
          COUNT(m.id) AS media_count
        FROM site_public_empreendimentos e
        LEFT JOIN site_public_media_assets m ON m.empreendimento_id = e.id
        LEFT JOIN cv_empreendimentos c ON c.id = e.crm_empreendimento_id
        GROUP BY e.id, c.nome
        ORDER BY
          CASE e.status_publicacao
            WHEN 'published' THEN 0
            WHEN 'draft' THEN 1
            ELSE 2
          END,
          e.destaque DESC,
          e.updated_at DESC
        LIMIT 8
      `),
      runQuery('inventoryRows', () => sql<InventoryRow[]>`
        SELECT
          e.id,
          e.nome,
          COUNT(u.id) AS total_units,
          COUNT(*) FILTER (WHERE COALESCE(u.status, '') ILIKE 'disp%') AS available_units,
          COUNT(*) FILTER (WHERE COALESCE(u.status, '') ILIKE 'res%') AS reserved_units,
          COUNT(*) FILTER (WHERE COALESCE(u.status, '') ILIKE 'vend%' OR u.status_venda = 3) AS sold_units,
          COUNT(DISTINCT s.id) AS linked_pages
        FROM cv_empreendimentos e
        LEFT JOIN cv_unidades u ON u.id_empreendimento = e.id
        LEFT JOIN site_public_empreendimentos s ON s.crm_empreendimento_id = e.id
        GROUP BY e.id, e.nome
        ORDER BY available_units DESC, sold_units DESC, e.nome ASC
        LIMIT 8
      `),
      runOptionalQuery('resaleRows', [], () => sql<ResaleRow[]>`
        SELECT
          r.id,
          r.slug,
          r.status_publicacao,
          r.destaque,
          r.titulo_publico,
          r.preco_revenda,
          r.corretor_nome,
          r.hero_image_url,
          r.updated_at::text AS updated_at,
          r.cv_unidade_id,
          r.cv_empreendimento_id,
          e.nome AS empreendimento_nome,
          u.numero AS unidade_numero,
          u.bloco AS unidade_bloco
        FROM site_public_resales r
        LEFT JOIN cv_empreendimentos e ON e.id = r.cv_empreendimento_id
        LEFT JOIN cv_unidades u ON u.id = r.cv_unidade_id
        ORDER BY
          CASE r.status_publicacao
            WHEN 'published' THEN 0
            WHEN 'draft' THEN 1
            WHEN 'sold' THEN 2
            ELSE 3
          END,
          r.destaque DESC,
          r.updated_at DESC
        LIMIT 8
      `),
      runOptionalQuery('internalTableRows', [], () => sql<InternalTableRow[]>`
        SELECT
          t.id,
          t.title,
          t.version_label,
          t.size_bytes,
          t.created_at::text AS created_at,
          COALESCE(sp.nome, ce.nome) AS empreendimento_nome
        FROM site_public_internal_tables t
        LEFT JOIN site_public_empreendimentos sp ON sp.id = t.site_empreendimento_id
        LEFT JOIN cv_empreendimentos ce ON ce.id = t.cv_empreendimento_id
        ORDER BY t.updated_at DESC
        LIMIT 8
      `),
      runOptionalQuery('gatedAssetRows', [], () => sql<GatedAssetRow[]>`
        SELECT
          g.id,
          g.title,
          g.slug,
          g.asset_type,
          g.active,
          g.size_bytes,
          g.updated_at::text AS updated_at,
          sp.nome AS empreendimento_nome,
          COUNT(l.id) FILTER (
            WHERE l.payload->>'gatedAssetId' = g.id
               OR l.payload->>'gatedAssetSlug' = g.slug
          ) AS leads
        FROM site_public_gated_assets g
        LEFT JOIN site_public_empreendimentos sp ON sp.id = g.site_empreendimento_id
        LEFT JOIN site_public_lead_submissions l ON TRUE
        GROUP BY g.id, sp.nome
        ORDER BY g.updated_at DESC
        LIMIT 8
      `),
      runOptionalQuery('analyticsTotalsRows', [{
        sessions: 0,
        page_views: 0,
        cta_clicks: 0,
        whatsapp_clicks: 0,
        ebook_downloads: 0,
        analytics_consents: 0,
        marketing_consents: 0,
      }], () => sql<AnalyticsTotalsRow[]>`
        SELECT
          COUNT(DISTINCT session_id) AS sessions,
          COUNT(*) FILTER (WHERE event_name = 'page_view') AS page_views,
          COUNT(*) FILTER (WHERE event_name = 'click_cta') AS cta_clicks,
          COUNT(*) FILTER (WHERE event_name = 'click_whatsapp') AS whatsapp_clicks,
          COUNT(*) FILTER (WHERE event_name = 'download_ebook') AS ebook_downloads,
          (SELECT COUNT(*) FROM site_public_cookie_consents WHERE analytics = true) AS analytics_consents,
          (SELECT COUNT(*) FROM site_public_cookie_consents WHERE marketing = true) AS marketing_consents
        FROM site_public_analytics_events
      `),
      runOptionalQuery('topPageRows', [], () => sql<TopPageRow[]>`
        SELECT
          page_type,
          page_key,
          page_path,
          views,
          unique_sessions,
          lead_submissions,
          cta_clicks,
          whatsapp_clicks,
          updated_at::text AS updated_at
        FROM site_public_page_snapshots
        ORDER BY views DESC, unique_sessions DESC, updated_at DESC
        LIMIT 8
      `),
      runOptionalQuery('topCtaRows', [], () => sql<TopCtaRow[]>`
        SELECT
          button_name,
          COUNT(*) AS total,
          MAX(created_at)::text AS latest
        FROM site_public_analytics_events
        WHERE COALESCE(button_name, '') <> ''
        GROUP BY button_name
        ORDER BY COUNT(*) DESC, MAX(created_at) DESC
        LIMIT 8
      `),
      runOptionalQuery('latestSiteContentRows', [{ latest: null }], () => sql<LatestSyncRow[]>`
        SELECT GREATEST(
          COALESCE((SELECT MAX(updated_at) FROM site_public_empreendimentos), '-infinity'::timestamptz),
          COALESCE((SELECT MAX(updated_at) FROM site_public_media_assets), '-infinity'::timestamptz),
          COALESCE((SELECT MAX(updated_at) FROM site_public_settings), '-infinity'::timestamptz),
          COALESCE((SELECT MAX(updated_at) FROM site_public_resales), '-infinity'::timestamptz),
          COALESCE((SELECT MAX(updated_at) FROM site_public_gated_assets), '-infinity'::timestamptz)
        )::text AS latest
      `),
      runQuery('siteLeadSyncRows', () => sql<SiteLeadSyncRow[]>`
        SELECT
          MAX(created_at)::text AS latest_site_lead,
          MAX(sent_to_cvcrm_at)::text AS latest_cvcrm_dispatch
        FROM site_public_lead_submissions
      `),
      runOptionalQuery('siteWarningRows', [{
        drafts: 0,
        sem_crm: 0,
        sem_midia: 0,
        sem_hero: 0,
        revendas_sem_hero: 0,
      }], () => sql<SiteWarningRow[]>`
        SELECT
          COUNT(*) FILTER (WHERE e.status_publicacao = 'draft') AS drafts,
          COUNT(*) FILTER (WHERE e.crm_empreendimento_id IS NULL) AS sem_crm,
          COUNT(*) FILTER (WHERE COALESCE(e.hero_image_url, '') = '') AS sem_hero,
          COUNT(*) FILTER (WHERE COALESCE(media_stats.media_count, 0) = 0) AS sem_midia,
          (SELECT COUNT(*) FROM site_public_resales r WHERE COALESCE(r.hero_image_url, '') = '') AS revendas_sem_hero
        FROM site_public_empreendimentos e
        LEFT JOIN (
          SELECT empreendimento_id, COUNT(*) AS media_count
          FROM site_public_media_assets
          GROUP BY empreendimento_id
        ) AS media_stats ON media_stats.empreendimento_id = e.id
      `),
      runOptionalQuery('siteTablesRows', [] as SiteTableRow[], () => sql<SiteTableRow[]>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY(${SITE_TABLES as unknown as string[]})
      `),
      runQuery('syncRunsRows', () => sql<SyncRunRow[]>`
        SELECT id, integration, status, scope, summary, created_at::text AS created_at
        FROM site_public_sync_runs
        ORDER BY created_at DESC
        LIMIT 6
      `),
      runOptionalQuery('integrationHealthRows', [] as IntegrationHealthRow[], () => sql<IntegrationHealthRow[]>`
        WITH normalized AS (
          SELECT
            CASE
              WHEN COALESCE(system_target, '') <> '' THEN system_source || ' -> ' || system_target
              ELSE system_source
            END AS integration_key,
            status,
            summary,
            created_at,
            ROW_NUMBER() OVER (
              PARTITION BY CASE
                WHEN COALESCE(system_target, '') <> '' THEN system_source || ' -> ' || system_target
                ELSE system_source
              END
              ORDER BY created_at DESC
            ) AS rn
          FROM integration_events
        )
        SELECT
          integration_key,
          MAX(CASE WHEN rn = 1 THEN status END) AS latest_status,
          MAX(CASE WHEN rn = 1 THEN summary END) AS latest_summary,
          MAX(created_at)::text AS latest_created_at,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS events_24h,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours' AND status IN ('warning', 'error')) AS issues_24h,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours' AND status IN ('received', 'processed', 'sent')) AS ok_24h
        FROM normalized
        GROUP BY integration_key
        ORDER BY MAX(created_at) DESC
      `),
    ]);

    const siteOverview = siteOverviewRows[0];
    const siteWarnings = siteWarningRows[0];
    const siteTables = new Set(siteTablesRows.map((row) => row.table_name)).size;
    const analyticsTotals = analyticsTotalsRows[0];

    payload.overview.crmProjects = asNumber(crmProjectsCountRows[0]?.total);
    payload.overview.leads = asNumber(leadsCountRows[0]?.total);
    payload.overview.units = asNumber(unitsCountRows[0]?.total);
    payload.overview.soldUnits = asNumber(soldUnitsCountRows[0]?.total);
    payload.overview.materials = asNumber(materialsCountRows[0]?.total);
    payload.overview.siteProjects = asNumber(siteOverview?.site_projects);
    payload.overview.publishedProjects = asNumber(siteOverview?.published_projects);
    payload.overview.draftProjects = asNumber(siteOverview?.draft_projects);
    payload.overview.featuredProjects = asNumber(siteOverview?.featured_projects);
    payload.overview.linkedCrmProjects = asNumber(siteOverview?.linked_crm_projects);
    payload.overview.mediaAssets = asNumber(siteOverview?.media_assets);
    payload.overview.siteLeads = asNumber(siteOverview?.site_leads);
    payload.overview.pendingSiteLeads = asNumber(siteOverview?.pending_site_leads);
    payload.overview.deliveredSiteLeads = asNumber(siteOverview?.delivered_site_leads);
    payload.overview.failedSiteLeads = asNumber(siteOverview?.failed_site_leads);
    payload.overview.resales = asNumber(siteOverview?.resales);
    payload.overview.publishedResales = asNumber(siteOverview?.published_resales);
    payload.overview.internalTables = asNumber(siteOverview?.internal_tables);
    payload.overview.gatedAssets = asNumber(siteOverview?.gated_assets);
    payload.overview.analyticsEvents = asNumber(siteOverview?.analytics_events);
    payload.overview.cookieConsents = asNumber(siteOverview?.cookie_consents);
    payload.overview.pageSnapshots = asNumber(siteOverview?.page_snapshots);
    payload.leadStatus = leadStatusRows.map((row) => ({
      status: row.status ?? 'Sem status',
      total: asNumber(row.total),
    }));
    payload.siteLeadStatus = siteLeadStatusRows.map((row) => ({
      status: row.status ?? 'pending',
      total: asNumber(row.total),
    }));
    payload.crmPortfolio = crmPortfolioRows;
    payload.sitePortfolio = sitePortfolioRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      nome: row.nome,
      status: row.status_publicacao,
      destaque: row.destaque,
      crmProjectId: row.crm_empreendimento_id,
      crmNome: row.crm_nome,
      cidade: row.cidade,
      bairro: row.bairro,
      heroImageUrl: row.hero_image_url,
      mediaCount: asNumber(row.media_count),
      updatedAt: row.updated_at,
    }));
    if (scope === 'portfolio') {
      return NextResponse.json({
        crmPortfolio: payload.crmPortfolio,
        sitePortfolio: payload.sitePortfolio,
      });
    }
    payload.inventory = inventoryRows.map((row) => ({
      id: row.id,
      nome: row.nome,
      totalUnits: asNumber(row.total_units),
      availableUnits: asNumber(row.available_units),
      reservedUnits: asNumber(row.reserved_units),
      soldUnits: asNumber(row.sold_units),
      linkedPages: asNumber(row.linked_pages),
    }));
    payload.resales = resaleRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.titulo_publico || `Revenda ${row.unidade_numero ?? row.cv_unidade_id}`,
      status: row.status_publicacao,
      destaque: row.destaque,
      projectName: row.empreendimento_nome,
      cvUnitId: row.cv_unidade_id,
      heroImageUrl: row.hero_image_url,
      brokerName: row.corretor_nome,
      price: row.preco_revenda == null ? null : asNumber(row.preco_revenda),
      unitLabel: [row.unidade_bloco ? `Bloco ${row.unidade_bloco}` : null, row.unidade_numero ? `Unidade ${row.unidade_numero}` : null]
        .filter(Boolean)
        .join(' • '),
      updatedAt: row.updated_at,
    }));
    payload.internalTables = internalTableRows.map((row) => ({
      id: row.id,
      title: row.title,
      projectName: row.empreendimento_nome,
      versionLabel: row.version_label,
      sizeBytes: row.size_bytes == null ? null : asNumber(row.size_bytes),
      createdAt: row.created_at,
    }));
    payload.gatedAssets = gatedAssetRows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      type: row.asset_type,
      active: row.active,
      projectName: row.empreendimento_nome,
      sizeBytes: row.size_bytes == null ? null : asNumber(row.size_bytes),
      leads: asNumber(row.leads),
      updatedAt: row.updated_at,
    }));
    payload.analytics = {
      sessions: asNumber(analyticsTotals?.sessions),
      pageViews: asNumber(analyticsTotals?.page_views),
      ctaClicks: asNumber(analyticsTotals?.cta_clicks),
      whatsappClicks: asNumber(analyticsTotals?.whatsapp_clicks),
      ebookDownloads: asNumber(analyticsTotals?.ebook_downloads),
      analyticsConsents: asNumber(analyticsTotals?.analytics_consents),
      marketingConsents: asNumber(analyticsTotals?.marketing_consents),
    };
    payload.topPages = topPageRows.map((row) => ({
      pageType: row.page_type,
      pageKey: row.page_key,
      path: row.page_path,
      views: asNumber(row.views),
      uniqueSessions: asNumber(row.unique_sessions),
      leads: asNumber(row.lead_submissions),
      ctaClicks: asNumber(row.cta_clicks),
      whatsappClicks: asNumber(row.whatsapp_clicks),
      updatedAt: row.updated_at,
    }));
    payload.topCtas = topCtaRows.map((row) => ({
      name: row.button_name,
      total: asNumber(row.total),
      latestAt: row.latest,
    }));
    payload.timestamps.leadsSyncAt = latestLeadSyncRows[0]?.latest ?? null;
    payload.timestamps.estoqueSyncAt = latestStockSyncRows[0]?.latest ?? null;
    payload.timestamps.siteContentSyncAt = latestSiteContentRows[0]?.latest ?? null;
    payload.timestamps.latestSiteLeadAt = siteLeadSyncRows[0]?.latest_site_lead ?? null;
    payload.timestamps.latestLeadDispatchAt = siteLeadSyncRows[0]?.latest_cvcrm_dispatch ?? null;
    payload.schema.siteTables = siteTables;
    payload.schema.siteReady = siteTables >= SITE_TABLES.length;
    payload.syncRuns = syncRunsRows.map((row) => ({
      id: row.id,
      integration: row.integration,
      status: row.status,
      scope: row.scope,
      summary: row.summary,
      createdAt: row.created_at,
    }));
    payload.integrationHealth = integrationHealthRows.map((row) => ({
      key: row.integration_key,
      latestStatus: row.latest_status,
      latestSummary: row.latest_summary,
      latestAt: row.latest_created_at,
      events24h: asNumber(row.events_24h),
      issues24h: asNumber(row.issues_24h),
      ok24h: asNumber(row.ok_24h),
    }));

    payload.contentWarnings = [
      {
        key: 'drafts',
        label: 'Rascunhos pendentes',
        total: asNumber(siteWarnings?.drafts),
        description: 'Empreendimentos criados no banco mas ainda nao publicados no site.',
      },
      {
        key: 'sem-crm',
        label: 'Sem vinculo com CV CRM',
        total: asNumber(siteWarnings?.sem_crm),
        description: 'Conteudos sem relacionamento com o empreendimento espelhado do CRM.',
      },
      {
        key: 'sem-midia',
        label: 'Sem midia cadastrada',
        total: asNumber(siteWarnings?.sem_midia),
        description: 'Paginas que ainda nao possuem galeria ou material visual suficiente.',
      },
      {
        key: 'sem-hero',
        label: 'Sem imagem hero',
        total: asNumber(siteWarnings?.sem_hero),
        description: 'Empreendimentos sem imagem principal definida para o portal.',
      },
      {
        key: 'resales-sem-hero',
        label: 'Revendas sem capa',
        total: asNumber(siteWarnings?.revendas_sem_hero),
        description: 'Revendas criadas sem hero image definida para publicacao.',
      },
    ];

    const integrationCards = payload.integrationHealth.slice(0, 6).map((item) => {
      const status =
        item.issues24h > 0 ? 'warning' : item.events24h > 0 ? 'online' : 'warning';
      return {
        key: item.key.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        label: item.key,
        status,
        value:
          item.events24h > 0
            ? `${item.ok24h} eventos ok / ${item.issues24h} alerta(s) em 24h`
            : 'Sem eventos recentes',
        description: [
          item.latestSummary || 'Sem resumo recente.',
          item.latestAt ? `Ultimo evento: ${item.latestAt}` : null,
        ].filter(Boolean).join(' • '),
      };
    });

    payload.integrations = [
      payload.integrations[0],
      {
        key: 'site-schema',
        label: 'Camada do site',
        status: payload.schema.siteReady ? 'online' : 'warning',
        value: payload.schema.siteReady
          ? `${payload.schema.siteTables} tabelas prontas`
          : `${payload.schema.siteTables} tabelas encontradas`,
        description: payload.schema.siteReady
          ? 'O Site Vision cobre conteudo, revendas, leads, analytics e governanca do portal.'
          : 'A estrutura base existe, mas ainda precisa ser populada para operar como cockpit completo do site.',
      },
      ...integrationCards,
      {
        key: 'analytics',
        label: 'Analytics',
        status: payload.overview.analyticsEvents > 0 ? 'online' : 'warning',
        value:
          payload.overview.analyticsEvents > 0
            ? `${payload.analytics.pageViews} page views e ${payload.analytics.ctaClicks} CTAs`
            : 'Aguardando eventos',
        description: 'Mede paginas, botoes, funil de conversao e aceite de cookies com base em eventos do proprio site.',
      },
    ];

    return NextResponse.json(payload);
  } catch (error) {
    logger.error({ error }, '[site-vision] erro ao montar payload:');
    return NextResponse.json({ error: 'Erro ao carregar Site Vision.' }, { status: 500 });
  }
}
