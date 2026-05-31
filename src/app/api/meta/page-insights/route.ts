/**
 * /api/meta/page-insights
 *
 * GET → insights da Página Facebook e conta Instagram:
 *   - Seguidores, alcance, impressões, engajamento da Página
 *   - Followers, reach, impressions do Instagram
 *   - Série temporal de crescimento
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { kv } from '@vercel/kv';
import axios from 'axios';

const META_BASE = 'https://graph.facebook.com/v21.0';
const PAGE_ID   = '259079394232614';
const CACHE_TTL = 3600; // 1h

function metaAuth() {
  return { access_token: process.env.META_TOKEN };
}

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const period       = searchParams.get('period') ?? 'month';
  const forceRefresh = searchParams.get('refresh') === 'true';
  const cacheKey     = `meta_page_insights_${period}`;

  if (!forceRefresh) {
    try {
      const cached = await kv.get<any>(cacheKey);
      if (cached) return NextResponse.json({ ...cached, _cached: true });
    } catch { /* non-critical */ }
  }

  const [pageRes, pageInsightsRes, igAccountRes] = await Promise.allSettled([
    // Dados da página Facebook
    axios.get(`${META_BASE}/${PAGE_ID}`, {
      params: {
        fields: 'id,name,fan_count,followers_count,category,about,website,phone',
        ...metaAuth(),
      },
      timeout: 10000,
    }),

    // Insights da página: alcance, impressões, engajamento
    axios.get(`${META_BASE}/${PAGE_ID}/insights`, {
      params: {
        metric: [
          'page_fans',
          'page_fan_adds',
          'page_fan_removes',
          'page_impressions',
          'page_reach',
          'page_engaged_users',
          'page_post_engagements',
          'page_views_total',
        ].join(','),
        period,
        ...metaAuth(),
      },
      timeout: 15000,
    }),

    // Instagram Business Account
    axios.get(`${META_BASE}/${PAGE_ID}`, {
      params: { fields: 'instagram_business_account', ...metaAuth() },
      timeout: 10000,
    }),
  ]);

  const pageData     = pageRes.status === 'fulfilled' ? (pageRes.value as any).data : null;
  const pageInsights = pageInsightsRes.status === 'fulfilled' ? (pageInsightsRes.value as any).data?.data ?? [] : [];
  const igId         = igAccountRes.status === 'fulfilled'
    ? (igAccountRes.value as any).data?.instagram_business_account?.id
    : null;

  // Instagram insights se disponível
  let igData: any = null;
  let igInsights: any[] = [];

  if (igId) {
    const [igProfileRes, igInsightsRes] = await Promise.allSettled([
      axios.get(`${META_BASE}/${igId}`, {
        params: {
          fields: 'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website',
          ...metaAuth(),
        },
        timeout: 10000,
      }),
      axios.get(`${META_BASE}/${igId}/insights`, {
        params: {
          metric: 'impressions,reach,profile_views,follower_count',
          period,
          ...metaAuth(),
        },
        timeout: 15000,
      }),
    ]);

    igData     = igProfileRes.status === 'fulfilled' ? (igProfileRes.value as any).data : null;
    igInsights = igInsightsRes.status === 'fulfilled' ? (igInsightsRes.value as any).data?.data ?? [] : [];
  }

  const result = {
    facebook: {
      page:     pageData,
      insights: pageInsights,
    },
    instagram: {
      id:       igId,
      profile:  igData,
      insights: igInsights,
    },
    updatedAt: new Date().toISOString(),
  };

  try { await kv.set(cacheKey, result, { ex: CACHE_TTL }); } catch { /* non-critical */ }
  return NextResponse.json(result);
}
