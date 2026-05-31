/**
 * /api/meta/publish
 * GET  → posts recentes do Facebook ou Instagram
 * POST → publicar post em Facebook e/ou Instagram
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import axios from 'axios';

const META_BASE = 'https://graph.facebook.com/v21.0';
const PAGE_ID   = '259079394232614';

function sysAuth() {
  return { access_token: process.env.META_TOKEN };
}

// Busca page access token dinamicamente — necessário para posts e publicação
async function getPageToken(): Promise<string> {
  try {
    const res = await axios.get(`${META_BASE}/${PAGE_ID}`, {
      params: { fields: 'access_token', ...sysAuth() },
      timeout: 10000,
    });
    return (res as any).data?.access_token || (process.env.META_TOKEN as string);
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
      const igAccountRes = await axios.get(`${META_BASE}/${PAGE_ID}`, {
        params: { fields: 'instagram_business_account', access_token: pageToken },
        timeout: 10000,
      });
      const igId = (igAccountRes as any).data?.instagram_business_account?.id;
      if (!igId) return NextResponse.json({ error: 'Conta Instagram não encontrada', posts: [] });

      const postsRes = await axios.get(`${META_BASE}/${igId}/media`, {
        params: {
          fields: 'id,media_type,media_url,permalink,thumbnail_url,timestamp,caption,like_count,comments_count',
          limit: 20,
          access_token: pageToken,
        },
        timeout: 15000,
      });
      return NextResponse.json({ platform: 'instagram', posts: (postsRes as any).data?.data ?? [] });
    }

    // Facebook — usa page token
    const postsRes = await axios.get(`${META_BASE}/${PAGE_ID}/feed`, {
      params: {
        fields: 'id,message,story,created_time,full_picture,permalink_url,likes.summary(true),comments.summary(true)',
        limit: 20,
        access_token: pageToken,
      },
      timeout: 15000,
    });
    return NextResponse.json({ platform: 'facebook', posts: (postsRes as any).data?.data ?? [] });

  } catch (err: any) {
    console.error('[meta/publish GET]', err.response?.data || err.message);
    return NextResponse.json(
      { error: 'Erro ao buscar posts', details: err.response?.data || err.message, posts: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const ip = getClientIp(request);
  const rl = await rateLimit(`meta_publish:${admin.userId}`, 10, 3600);
  if (!rl.success) return NextResponse.json({ error: 'Limite de publicações atingido (10/hora)' }, { status: 429 });

  const body = await request.json();
  const { message, image_url, platforms = ['facebook'], scheduled_publish_time } = body;

  if (!message?.trim()) return NextResponse.json({ error: 'message é obrigatório' }, { status: 400 });

  const pageToken = await getPageToken();
  const results: Record<string, any> = {};

  if (platforms.includes('facebook')) {
    try {
      const endpoint = image_url ? `${META_BASE}/${PAGE_ID}/photos` : `${META_BASE}/${PAGE_ID}/feed`;
      const payload: Record<string, any> = { message, access_token: pageToken };
      if (image_url) payload.url = image_url;
      if (scheduled_publish_time) { payload.scheduled_publish_time = scheduled_publish_time; payload.published = false; }

      const fbRes = await axios.post(endpoint, payload, { timeout: 20000 });
      results.facebook = { success: true, post_id: (fbRes as any).data?.id || (fbRes as any).data?.post_id };
      console.log(`[meta/publish] FB post por ${admin.name}: ${results.facebook.post_id}`);
    } catch (err: any) {
      results.facebook = { success: false, error: err.response?.data || err.message };
    }
  }

  if (platforms.includes('instagram')) {
    if (!image_url) {
      results.instagram = { success: false, error: 'Instagram requer image_url' };
    } else {
      try {
        const igRes = await axios.get(`${META_BASE}/${PAGE_ID}`, {
          params: { fields: 'instagram_business_account', access_token: pageToken },
          timeout: 10000,
        });
        const igId = (igRes as any).data?.instagram_business_account?.id;
        if (!igId) throw new Error('Conta Instagram não conectada');

        const containerRes = await axios.post(`${META_BASE}/${igId}/media`, {
          image_url, caption: message,
        }, { params: { access_token: pageToken }, timeout: 20000 });

        const publishRes = await axios.post(`${META_BASE}/${igId}/media_publish`, {
          creation_id: (containerRes as any).data?.id,
        }, { params: { access_token: pageToken }, timeout: 20000 });

        results.instagram = { success: true, media_id: (publishRes as any).data?.id };
        console.log(`[meta/publish] IG post por ${admin.name}: ${results.instagram.media_id}`);
      } catch (err: any) {
        results.instagram = { success: false, error: err.response?.data || err.message };
      }
    }
  }

  const anySuccess = Object.values(results).some((r: any) => r.success);
  return NextResponse.json(
    { results, published_by: admin.name, published_at: new Date().toISOString() },
    { status: anySuccess ? 200 : 500 }
  );
}
