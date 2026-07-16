import { NextResponse } from 'next/server';
import { verifyPermission } from '@/lib/auth';
import { sql } from '@/lib/pg';
import logger from '@/lib/logger';

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

type LatestSyncRow = { latest: string | null };

function asNumber(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

export async function GET() {
  const user = await verifyPermission('viewSiteVision');
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  try {
    const [gatedAssetRows, topPageRows, topCtaRows, analyticsTotalsRows, latestSiteContentRows] = await Promise.all([
      sql<GatedAssetRow[]>`
        SELECT
          g.id,
          g.title,
          g.slug,
          g.asset_type,
          g.active,
          g.size_bytes,
          g.updated_at::text,
          sp.nome AS empreendimento_nome,
          COUNT(l.id) FILTER (
            WHERE l.payload->>'gatedAssetId' = g.id
               OR l.payload->>'gatedAssetSlug' = g.slug
          )::int AS leads
        FROM site_public_gated_assets g
        LEFT JOIN site_public_empreendimentos sp ON sp.id = g.site_empreendimento_id
        LEFT JOIN site_public_lead_submissions l ON TRUE
        GROUP BY g.id, sp.nome
        ORDER BY g.updated_at DESC
        LIMIT 16
      `,
      sql<TopPageRow[]>`
        SELECT
          page_type,
          page_key,
          page_path,
          views,
          unique_sessions,
          lead_submissions,
          cta_clicks,
          whatsapp_clicks,
          updated_at::text
        FROM site_public_page_snapshots
        ORDER BY views DESC, unique_sessions DESC, updated_at DESC
        LIMIT 12
      `,
      sql<TopCtaRow[]>`
        SELECT
          button_name,
          COUNT(*)::int AS total,
          MAX(created_at)::text AS latest
        FROM site_public_analytics_events
        WHERE COALESCE(button_name, '') <> ''
        GROUP BY button_name
        ORDER BY COUNT(*) DESC, MAX(created_at) DESC
        LIMIT 8
      `,
      sql<AnalyticsTotalsRow[]>`
        SELECT
          COUNT(DISTINCT session_id)::int AS sessions,
          COUNT(*) FILTER (WHERE event_name = 'page_view')::int AS page_views,
          COUNT(*) FILTER (WHERE event_name = 'click_cta')::int AS cta_clicks,
          COUNT(*) FILTER (WHERE event_name = 'click_whatsapp')::int AS whatsapp_clicks,
          COUNT(*) FILTER (WHERE event_name = 'download_ebook')::int AS ebook_downloads,
          (SELECT COUNT(*) FROM site_public_cookie_consents WHERE analytics = true)::int AS analytics_consents,
          (SELECT COUNT(*) FROM site_public_cookie_consents WHERE marketing = true)::int AS marketing_consents
        FROM site_public_analytics_events
      `,
      sql<LatestSyncRow[]>`
        SELECT GREATEST(
          COALESCE((SELECT MAX(updated_at) FROM site_public_empreendimentos), '-infinity'::timestamptz),
          COALESCE((SELECT MAX(updated_at) FROM site_public_media_assets), '-infinity'::timestamptz),
          COALESCE((SELECT MAX(updated_at) FROM site_public_settings), '-infinity'::timestamptz),
          COALESCE((SELECT MAX(updated_at) FROM site_public_resales), '-infinity'::timestamptz),
          COALESCE((SELECT MAX(updated_at) FROM site_public_gated_assets), '-infinity'::timestamptz)
        )::text AS latest
      `,
    ]);

    const analyticsTotals = analyticsTotalsRows[0];

    return NextResponse.json({
      gatedAssets: gatedAssetRows.map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        type: row.asset_type,
        active: row.active,
        sizeBytes: asNumber(row.size_bytes),
        updatedAt: row.updated_at,
        projectName: row.empreendimento_nome,
        leads: asNumber(row.leads),
      })),
      topPages: topPageRows.map((row) => ({
        pageType: row.page_type,
        pageKey: row.page_key,
        pagePath: row.page_path,
        views: asNumber(row.views),
        uniqueSessions: asNumber(row.unique_sessions),
        leadSubmissions: asNumber(row.lead_submissions),
        ctaClicks: asNumber(row.cta_clicks),
        whatsappClicks: asNumber(row.whatsapp_clicks),
        updatedAt: row.updated_at,
      })),
      topCtas: topCtaRows.map((row) => ({
        buttonName: row.button_name,
        total: asNumber(row.total),
        latest: row.latest,
      })),
      analytics: {
        sessions: asNumber(analyticsTotals?.sessions),
        pageViews: asNumber(analyticsTotals?.page_views),
        ctaClicks: asNumber(analyticsTotals?.cta_clicks),
        whatsappClicks: asNumber(analyticsTotals?.whatsapp_clicks),
        ebookDownloads: asNumber(analyticsTotals?.ebook_downloads),
        analyticsConsents: asNumber(analyticsTotals?.analytics_consents),
        marketingConsents: asNumber(analyticsTotals?.marketing_consents),
      },
      timestamps: {
        siteContentSyncAt: latestSiteContentRows[0]?.latest ?? null,
      },
    });
  } catch (error) {
    logger.error({ error }, '[site-vision/analytics] error:');
    return NextResponse.json({ error: 'Erro ao carregar analytics.' }, { status: 500 });
  }
}
