/**
 * /api/meta/publish
 *
 * POST → publicar post no Facebook e/ou Instagram
 * 
 * Body:
 *   message     string    — texto do post
 *   image_url   string?   — URL pública da imagem (para posts com imagem)
 *   platforms   string[]  — ['facebook', 'instagram'] (default: ['facebook'])
 *   scheduled_publish_time? number — timestamp Unix para agendamento
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import axios from 'axios';

const META_BASE = 'https://graph.facebook.com/v21.0';
const PAGE_ID   = '259079394232614'; // Longview Empreendimentos

function metaAuth() {
  return { access_token: process.env.META_TOKEN };
}

// GET → buscar posts publicados recentemente
export async function GET(request: NextRequest) {
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform') ?? 'facebook';

  try {
    if (platform === 'instagram') {
      // Buscar Instagram Business Account ID
      const igAccountRes = await axios.get(`${META_BASE}/${PAGE_ID}`, {
        params: { fields: 'instagram_business_account', ...metaAuth() },
        timeout: 10000,
      });
      const igId = (igAccountRes as any).data?.instagram_business_account?.id;
      if (!igId) return NextResponse.json({ error: 'Conta Instagram não conectada à página' }, { status: 400 });

      const postsRes = await axios.get(`${META_BASE}/${igId}/media`, {
        params: {
          fields: 'id,media_type,media_url,permalink,thumbnail_url,timestamp,caption,like_count,comments_count',
          limit: 20,
          ...metaAuth(),
        },
        timeout: 15000,
      });
      return NextResponse.json({ platform: 'instagram', posts: (postsRes as any).data?.data ?? [] });
    }

    // Facebook page posts
    const postsRes = await axios.get(`${META_BASE}/${PAGE_ID}/posts`, {
      params: {
        fields: 'id,message,story,created_time,full_picture,permalink_url,likes.summary(true),comments.summary(true)',
        limit: 20,
        ...metaAuth(),
      },
      timeout: 15000,
    });
    return NextResponse.json({ platform: 'facebook', posts: (postsRes as any).data?.data ?? [] });

  } catch (err: any) {
    return NextResponse.json({ error: err.response?.data || err.message }, { status: 500 });
  }
}

// POST → publicar
export async function POST(request: NextRequest) {
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  // Rate limit rigoroso para publicações
  const ip = getClientIp(request);
  const rl = await rateLimit(`meta_publish:${admin.userId}`, 10, 3600); // 10 posts por hora
  if (!rl.success) {
    return NextResponse.json({ error: 'Limite de publicações atingido (10/hora)' }, { status: 429 });
  }

  const body = await request.json();
  const { message, image_url, platforms = ['facebook'], scheduled_publish_time } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: 'message é obrigatório' }, { status: 400 });
  }

  const results: Record<string, any> = {};

  // ─── Publicar no Facebook ───────────────────────────────────────────────────
  if (platforms.includes('facebook')) {
    try {
      const fbPayload: Record<string, any> = { message };
      if (image_url) fbPayload.url = image_url;
      if (scheduled_publish_time) {
        fbPayload.scheduled_publish_time = scheduled_publish_time;
        fbPayload.published = false;
      }

      const endpoint = image_url
        ? `${META_BASE}/${PAGE_ID}/photos`   // post com imagem
        : `${META_BASE}/${PAGE_ID}/feed`;    // post de texto

      const fbRes = await axios.post(endpoint, fbPayload, {
        params: metaAuth(),
        timeout: 20000,
      });
      results.facebook = { success: true, post_id: (fbRes as any).data?.id || (fbRes as any).data?.post_id };
      console.log(`[meta/publish] FB post publicado por ${admin.name}: ${results.facebook.post_id}`);
    } catch (err: any) {
      results.facebook = { success: false, error: err.response?.data || err.message };
    }
  }

  // ─── Publicar no Instagram ─────────────────────────────────────────────────
  if (platforms.includes('instagram')) {
    if (!image_url) {
      results.instagram = { success: false, error: 'Instagram requer image_url — posts de texto puro não são suportados' };
    } else {
      try {
        // 1. Buscar IG Business Account
        const igAccountRes = await axios.get(`${META_BASE}/${PAGE_ID}`, {
          params: { fields: 'instagram_business_account', ...metaAuth() },
          timeout: 10000,
        });
        const igId = (igAccountRes as any).data?.instagram_business_account?.id;

        if (!igId) {
          results.instagram = { success: false, error: 'Conta Instagram não conectada à página Facebook' };
        } else {
          // 2. Criar container de mídia
          const containerRes = await axios.post(`${META_BASE}/${igId}/media`, {
            image_url,
            caption: message,
            ...(scheduled_publish_time ? { published: false } : {}),
          }, { params: metaAuth(), timeout: 20000 });

          const containerId = (containerRes as any).data?.id;

          // 3. Publicar container
          const publishRes = await axios.post(`${META_BASE}/${igId}/media_publish`, {
            creation_id: containerId,
          }, { params: metaAuth(), timeout: 20000 });

          results.instagram = { success: true, media_id: (publishRes as any).data?.id };
          console.log(`[meta/publish] IG post publicado por ${admin.name}: ${results.instagram.media_id}`);
        }
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
