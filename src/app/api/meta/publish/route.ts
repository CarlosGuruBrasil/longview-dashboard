/**
 * /api/meta/publish
 * GET  → posts recentes do Facebook ou Instagram
 * POST → publicar post em Facebook e/ou Instagram
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import axios from 'axios';

const META_BASE = 'https://graph.facebook.com/v21.0';
const PAGE_ID   = '259079394232614';

type PageTokenResponse = { access_token?: string };
type InstagramAccountResponse = { instagram_business_account?: { id?: string } };
type MetaListResponse = { data?: Record<string, unknown>[] };
type MetaPublishResponse = { id?: string; post_id?: string };
type PublishBody = {
  message?: string;
  image_url?: string;
  platforms?: string[];
  scheduled_publish_time?: string | number;
};
type PublishResult =
  | { success: true; post_id?: string }
  | { success: true; media_id?: string }
  | { success: false; error: unknown };

function sysAuth() {
  return { access_token: process.env.META_TOKEN };
}

function errorPayload(err: unknown): unknown {
  return axios.isAxiosError(err) ? err.response?.data || err.message : err instanceof Error ? err.message : String(err);
}

// Busca page access token dinamicamente — necessário para posts e publicação
async function getPageToken(): Promise<string> {
  try {
    const res = await axios.get<PageTokenResponse>(`${META_BASE}/${PAGE_ID}`, {
      params: { fields: 'access_token', ...sysAuth() },
      timeout: 10000,
    });
    return res.data.access_token || (process.env.META_TOKEN as string);
  } catch {
    return process.env.META_TOKEN as string;
  }
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform') ?? 'facebook';

  try {
    const pageToken = await getPageToken();

    if (platform === 'instagram') {
      const igAccountRes = await axios.get<InstagramAccountResponse>(`${META_BASE}/${PAGE_ID}`, {
        params: { fields: 'instagram_business_account', access_token: pageToken },
        timeout: 10000,
      });
      const igId = igAccountRes.data.instagram_business_account?.id;
      if (!igId) return NextResponse.json({ error: 'Conta Instagram não encontrada', posts: [] });

      const postsRes = await axios.get<MetaListResponse>(`${META_BASE}/${igId}/media`, {
        params: {
          fields: 'id,media_type,media_url,permalink,thumbnail_url,timestamp,caption,like_count,comments_count',
          limit: 20,
          access_token: pageToken,
        },
        timeout: 15000,
      });
      return NextResponse.json({ platform: 'instagram', posts: postsRes.data.data ?? [] });
    }

    // Facebook — usa page token
    const postsRes = await axios.get<MetaListResponse>(`${META_BASE}/${PAGE_ID}/feed`, {
      params: {
        fields: 'id,message,story,created_time,full_picture,permalink_url,likes.summary(true),comments.summary(true)',
        limit: 20,
        access_token: pageToken,
      },
      timeout: 15000,
    });
    return NextResponse.json({ platform: 'facebook', posts: postsRes.data.data ?? [] });

  } catch (err: unknown) {
    const details = errorPayload(err);
    console.error('[meta/publish GET]', details);
    return NextResponse.json(
      { error: 'Erro ao buscar posts', details, posts: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const rl = await rateLimit(`meta_publish:${admin.userId}`, 10, 3600);
  if (!rl.success) return NextResponse.json({ error: 'Limite de publicações atingido (10/hora)' }, { status: 429 });

  const body = await request.json() as PublishBody;
  const { message, image_url, platforms = ['facebook'], scheduled_publish_time } = body;

  if (!message?.trim()) return NextResponse.json({ error: 'message é obrigatório' }, { status: 400 });

  const pageToken = await getPageToken();
  const results: Record<string, PublishResult> = {};

  if (platforms.includes('facebook')) {
    try {
      const endpoint = image_url ? `${META_BASE}/${PAGE_ID}/photos` : `${META_BASE}/${PAGE_ID}/feed`;
      const payload: Record<string, unknown> = { message, access_token: pageToken };
      if (image_url) payload.url = image_url;
      if (scheduled_publish_time) { payload.scheduled_publish_time = scheduled_publish_time; payload.published = false; }

      const fbRes = await axios.post<MetaPublishResponse>(endpoint, payload, { timeout: 20000 });
      const postId = fbRes.data.id || fbRes.data.post_id;
      results.facebook = { success: true, post_id: postId };
      console.log(`[meta/publish] FB post por ${admin.name}: ${postId}`);
    } catch (err: unknown) {
      results.facebook = { success: false, error: errorPayload(err) };
    }
  }

  if (platforms.includes('instagram')) {
    if (!image_url) {
      results.instagram = { success: false, error: 'Instagram requer image_url' };
    } else {
      try {
        const igRes = await axios.get<InstagramAccountResponse>(`${META_BASE}/${PAGE_ID}`, {
          params: { fields: 'instagram_business_account', access_token: pageToken },
          timeout: 10000,
        });
        const igId = igRes.data.instagram_business_account?.id;
        if (!igId) throw new Error('Conta Instagram não conectada');

        const containerRes = await axios.post<MetaPublishResponse>(`${META_BASE}/${igId}/media`, {
          image_url, caption: message,
        }, { params: { access_token: pageToken }, timeout: 20000 });

        const publishRes = await axios.post<MetaPublishResponse>(`${META_BASE}/${igId}/media_publish`, {
          creation_id: containerRes.data.id,
        }, { params: { access_token: pageToken }, timeout: 20000 });

        const mediaId = publishRes.data.id;
        results.instagram = { success: true, media_id: mediaId };
        console.log(`[meta/publish] IG post por ${admin.name}: ${mediaId}`);
      } catch (err: unknown) {
        results.instagram = { success: false, error: errorPayload(err) };
      }
    }
  }

  const anySuccess = Object.values(results).some((r) => r.success);
  return NextResponse.json(
    { results, published_by: admin.name, published_at: new Date().toISOString() },
    { status: anySuccess ? 200 : 500 }
  );
}
