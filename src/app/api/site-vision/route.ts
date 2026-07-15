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
type SiteLeadSyncRow = {
  latest_site_lead: string | null;
  latest_cvcrm_dispatch: string | null;
};
type SiteWarningRow = {
  drafts: string | number;
  sem_crm: string | number;
  sem_midia: string | number;
  sem_hero: string | number;
};
type SyncRunRow = {
  id: number;
  integration: 'cvcrm' | 'site-api' | 'media-import' | 'legacy-sync';
  status: 'success' | 'warning' | 'error' | 'running';
  scope: string;
  summary: string;
  created_at: string;
};

function asNumber(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

export async function GET() {
  const user = await verifyPermission('viewSiteVision');
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  try {
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
            : 'Sem DATABASE_URL, o módulo opera apenas com dados locais.',
        },
        {
          key: 'site-schema',
          label: 'Schema do site',
          status: process.env.DATABASE_URL ? 'warning' : 'offline',
          value: process.env.DATABASE_URL ? 'Aguardando leitura' : 'Indisponivel',
          description: 'Separa o conteudo publicado do restante do dashboard dentro do mesmo banco.',
        },
        {
          key: 'cvcrm',
          label: 'CV CRM',
          status: process.env.CV_CRM_EMAIL && process.env.CV_CRM_TOKEN ? 'online' : 'warning',
          value: process.env.CV_CRM_EMAIL && process.env.CV_CRM_TOKEN ? 'Credenciais presentes' : 'Credenciais ausentes',
          description: 'Integração usada para estoque, vínculo de empreendimentos e envio dos leads do site.',
        },
        {
          key: 'meta',
          label: 'Meta Ads',
          status: process.env.META_TOKEN ? 'online' : 'warning',
          value: process.env.META_TOKEN ? 'Token presente' : 'Token ausente',
          description: 'Ajuda a validar origem, campanha e consistência da captação do site.',
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
      schema: {
        siteTables: 0,
        siteReady: false,
      },
    };

    if (!process.env.DATABASE_URL) {
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
      latestSiteContentRows,
      siteLeadSyncRows,
      siteWarningRows,
      siteTablesRows,
      syncRunsRows,
    ] = await Promise.all([
      sql<CountRow[]>`SELECT COUNT(*) AS total FROM cv_empreendimentos`,
      sql<CountRow[]>`SELECT COUNT(*) AS total FROM leads`,
      sql<CountRow[]>`SELECT COUNT(*) AS total FROM cv_unidades`,
      sql<CountRow[]>`SELECT COUNT(*) AS total FROM cv_unidades WHERE status ILIKE '%vend%' OR status_venda = 3`,
      sql<CountRow[]>`SELECT COUNT(*) AS total FROM cv_materiais`,
      sql<LeadStatusRow[]>`
        SELECT COALESCE(status, 'Sem status') AS status, COUNT(*) AS total
        FROM leads
        GROUP BY COALESCE(status, 'Sem status')
        ORDER BY COUNT(*) DESC
        LIMIT 6
      `,
      sql<LatestSyncRow[]>`SELECT MAX(synced_at)::text AS latest FROM leads`,
      sql<LatestSyncRow[]>`SELECT MAX(synced_at)::text AS latest FROM cv_empreendimentos`,
      sql<CrmProjectRow[]>`
        SELECT id, nome, situacao, tipo
        FROM cv_empreendimentos
        ORDER BY synced_at DESC NULLS LAST, nome ASC
        LIMIT 8
      `,
      sql<SiteOverviewRow[]>`
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
          (SELECT COUNT(*) FROM site_public_lead_submissions WHERE status = 'error') AS failed_site_leads
        FROM site_public_empreendimentos
      `,
      sql<LeadStatusRow[]>`
        SELECT COALESCE(status, 'pending') AS status, COUNT(*) AS total
        FROM site_public_lead_submissions
        GROUP BY COALESCE(status, 'pending')
        ORDER BY COUNT(*) DESC
        LIMIT 6
      `,
      sql<SiteProjectRow[]>`
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
      `,
      sql<LatestSyncRow[]>`
        SELECT GREATEST(
          COALESCE((SELECT MAX(updated_at) FROM site_public_empreendimentos), '-infinity'::timestamptz),
          COALESCE((SELECT MAX(updated_at) FROM site_public_media_assets), '-infinity'::timestamptz),
          COALESCE((SELECT MAX(updated_at) FROM site_public_settings), '-infinity'::timestamptz)
        )::text AS latest
      `,
      sql<SiteLeadSyncRow[]>`
        SELECT
          MAX(created_at)::text AS latest_site_lead,
          MAX(sent_to_cvcrm_at)::text AS latest_cvcrm_dispatch
        FROM site_public_lead_submissions
      `,
      sql<SiteWarningRow[]>`
        SELECT
          COUNT(*) FILTER (WHERE e.status_publicacao = 'draft') AS drafts,
          COUNT(*) FILTER (WHERE e.crm_empreendimento_id IS NULL) AS sem_crm,
          COUNT(*) FILTER (WHERE COALESCE(e.hero_image_url, '') = '') AS sem_hero,
          COUNT(*) FILTER (WHERE COALESCE(media_stats.media_count, 0) = 0) AS sem_midia
        FROM site_public_empreendimentos e
        LEFT JOIN (
          SELECT empreendimento_id, COUNT(*) AS media_count
          FROM site_public_media_assets
          GROUP BY empreendimento_id
        ) AS media_stats ON media_stats.empreendimento_id = e.id
      `,
      sql<CountRow[]>`
        SELECT COUNT(*) AS total
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (
            'site_public_settings',
            'site_public_empreendimentos',
            'site_public_media_assets',
            'site_public_lead_submissions',
            'site_public_sync_runs'
          )
      `,
      sql<SyncRunRow[]>`
        SELECT id, integration, status, scope, summary, created_at::text AS created_at
        FROM site_public_sync_runs
        ORDER BY created_at DESC
        LIMIT 6
      `,
    ]);

    const siteOverview = siteOverviewRows[0];
    const siteWarnings = siteWarningRows[0];
    const siteTables = asNumber(siteTablesRows[0]?.total);

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
    payload.leadStatus = leadStatusRows.map((row) => ({
      status: row.status ?? 'Sem status',
      total: asNumber(row.total),
    }));
    payload.siteLeadStatus = siteLeadStatusRows.map((row) => ({
      status: row.status ?? 'pending',
      total: asNumber(row.total),
    }));
    payload.timestamps.leadsSyncAt = latestLeadSyncRows[0]?.latest ?? null;
    payload.timestamps.estoqueSyncAt = latestStockSyncRows[0]?.latest ?? null;
    payload.timestamps.siteContentSyncAt = latestSiteContentRows[0]?.latest ?? null;
    payload.timestamps.latestSiteLeadAt = siteLeadSyncRows[0]?.latest_site_lead ?? null;
    payload.timestamps.latestLeadDispatchAt = siteLeadSyncRows[0]?.latest_cvcrm_dispatch ?? null;
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
    payload.schema.siteTables = siteTables;
    payload.schema.siteReady = siteTables >= 4;
    payload.syncRuns = syncRunsRows.map((row) => ({
      id: row.id,
      integration: row.integration,
      status: row.status,
      scope: row.scope,
      summary: row.summary,
      createdAt: row.created_at,
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
        description: 'Empreendimentos que ainda nao tem imagem principal para a capa do site.',
      },
    ];

    payload.integrations = [
      payload.integrations[0],
      {
        key: 'site-schema',
        label: 'Schema do site',
        status: payload.schema.siteReady ? 'online' : 'warning',
        value: payload.schema.siteReady
          ? `${payload.schema.siteTables} tabelas prontas`
          : `${payload.schema.siteTables} tabelas encontradas`,
        description: payload.schema.siteReady
          ? 'Conteudo, midias, leads e sincronizacoes do site agora estao isolados em tabelas dedicadas do namespace site_public.'
          : 'A estrutura dedicada do site ja existe, mas ainda precisa ser populada para operar como CMS do portal.',
      },
      {
        key: 'cvcrm',
        label: 'CV CRM',
        status:
          process.env.CV_CRM_EMAIL && process.env.CV_CRM_TOKEN
            ? payload.overview.linkedCrmProjects > 0
              ? 'online'
              : 'warning'
            : 'warning',
        value:
          process.env.CV_CRM_EMAIL && process.env.CV_CRM_TOKEN
            ? `${payload.overview.linkedCrmProjects} empreendimentos vinculados`
            : 'Credenciais ausentes',
        description: 'Responsavel por estoque, dados mestres dos empreendimentos e entrega comercial dos leads.',
      },
      {
        key: 'meta',
        label: 'Meta Ads',
        status: process.env.META_TOKEN ? 'online' : 'warning',
        value: process.env.META_TOKEN ? 'Token presente' : 'Token ausente',
        description: 'Usado para consistencia da origem dos leads e comparacao com a captacao do site.',
      },
    ];

    return NextResponse.json(payload);
  } catch (error) {
    logger.error({ error }, '[site-vision] erro ao montar payload:');
    return NextResponse.json({ error: 'Erro ao carregar Site Vision.' }, { status: 500 });
  }
}
