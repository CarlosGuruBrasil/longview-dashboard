/**
 * GET /api/meta/page-insights
 * Facebook + Instagram dados reais.
 * Cache de 1h via KV.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { kv } from '@/lib/kv';
import axios from 'axios';

const META_BASE = 'https://graph.facebook.com/v21.0';
const PAGE_ID   = '259079394232614';
const CACHE_TTL = 3600;

function tok() { return process.env.META_TOKEN ?? ''; }

function daysAgo(n: number) { return Math.floor((Date.now() - n * 86400000) / 1000); }
function nowTs()              { return Math.floor(Date.now() / 1000); }

export async function GET(req: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const force    = req.nextUrl.searchParams.get('refresh') === 'true';
  const cacheKey = 'social_insights_v2';

  if (!force) {
    try {
      const cached = await kv.get<unknown>(cacheKey);
      if (cached) return NextResponse.json({ ...cached as object, _cached: true });
    } catch { /* skip */ }
  }

  const token = tok();
  if (!token) return NextResponse.json({ error: 'META_TOKEN não configurado' }, { status: 503 });

  const since28 = daysAgo(28);
  const until   = nowTs();

  // ── Facebook ──────────────────────────────────────────────────────────────
  const [fbPageRes, igAccountRes] = await Promise.allSettled([
    axios.get(`${META_BASE}/${PAGE_ID}`, {
      params: { fields: 'id,name,fan_count,followers_count,category', access_token: token },
      timeout: 10000,
    }),
    axios.get(`${META_BASE}/${PAGE_ID}`, {
      params: { fields: 'instagram_business_account', access_token: token },
      timeout: 10000,
    }),
  ]);

  const fbPage = fbPageRes.status === 'fulfilled' ? (fbPageRes.value as any).data : null;
  const igId   = igAccountRes.status === 'fulfilled'
    ? (igAccountRes.value as any).data?.instagram_business_account?.id
    : null;

  // ── Instagram ─────────────────────────────────────────────────────────────
  let igProfile: any = null;
  let igReachDaily:     { date: string; value: number }[] = [];
  let igFollowerDaily:  { date: string; value: number }[] = [];

  if (igId) {
    const [profileRes, reachRes, followerRes] = await Promise.allSettled([
      axios.get(`${META_BASE}/${igId}`, {
        params: {
          fields: 'username,name,followers_count,follows_count,media_count,biography',
          access_token: token,
        },
        timeout: 10000,
      }),
      axios.get(`${META_BASE}/${igId}/insights`, {
        params: { metric: 'reach', period: 'day', since: since28, until, access_token: token },
        timeout: 12000,
      }),
      axios.get(`${META_BASE}/${igId}/insights`, {
        params: { metric: 'follower_count', period: 'day', since: since28, until, access_token: token },
        timeout: 12000,
      }),
    ]);

    igProfile = profileRes.status === 'fulfilled' ? (profileRes.value as any).data : null;

    const reachData   = reachRes.status   === 'fulfilled' ? (reachRes.value   as any).data?.data ?? [] : [];
    const followerData = followerRes.status === 'fulfilled' ? (followerRes.value as any).data?.data ?? [] : [];

    igReachDaily    = (reachData[0]?.values ?? []).map((v: any) => ({
      date:  v.end_time?.slice(0, 10) ?? '',
      value: typeof v.value === 'number' ? v.value : 0,
    }));
    igFollowerDaily = (followerData[0]?.values ?? []).map((v: any) => ({
      date:  v.end_time?.slice(0, 10) ?? '',
      value: typeof v.value === 'number' ? v.value : 0,
    }));
  }

  const newFollowers28d = igFollowerDaily.reduce((s, d) => s + d.value, 0);
  const reach28d        = igReachDaily.reduce((s, d) => s + d.value, 0);

  const result = {
    facebook: {
      name:       fbPage?.name       ?? 'Longview Empreendimentos',
      fanCount:   fbPage?.fan_count  ?? 0,
      followers:  fbPage?.followers_count ?? 0,
    },
    instagram: {
      username:      igProfile?.username      ?? 'longviewempreendimentos',
      name:          igProfile?.name          ?? '',
      followers:     igProfile?.followers_count ?? 0,
      following:     igProfile?.follows_count  ?? 0,
      mediaCount:    igProfile?.media_count    ?? 0,
      biography:     igProfile?.biography      ?? '',
      newFollowers28d,
      reach28d,
      reachDaily:    igReachDaily,
      followerDaily: igFollowerDaily,
    },
    updatedAt: new Date().toISOString(),
  };

  try { await kv.set(cacheKey, result, { ex: CACHE_TTL }); } catch { /* skip */ }
  return NextResponse.json(result);
}
