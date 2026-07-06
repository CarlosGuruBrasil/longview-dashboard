import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? (() => { throw new Error('[LongView] JWT_SECRET nao configurado. Defina no .env.local') })();
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || '';
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || '';
const META_API_VERSION = 'v19.0';

export const revalidate = 0;
export const runtime = 'nodejs';

type AuthUser = { role?: string };

async function verifyAuth(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch { return null; }
}

// GET /api/meta/creatives
// Retorna criativos (thumbnail, vídeo, título, body) de anúncios ativos
export async function GET() {
  const authUser = await verifyAuth();
  if (!authUser) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) {
    return NextResponse.json({ creatives: [], error: 'Meta não configurada.' });
  }

  try {
    // 1. Busca anúncios ativos com seus criativos
    const adsUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/act_${META_AD_ACCOUNT_ID}/ads`);
    adsUrl.searchParams.set('access_token', META_ACCESS_TOKEN);
    adsUrl.searchParams.set('effective_status', '["ACTIVE","PAUSED"]');
    adsUrl.searchParams.set('limit', '50');
    adsUrl.searchParams.set('fields', [
      'id', 'name', 'status', 'campaign_id', 'campaign{name}',
      'adset{name}',
      'creative{id,name,title,body,call_to_action_type,thumbnail_url,video_id,object_story_spec}'
    ].join(','));

    const adsRes = await fetch(adsUrl.toString(), { next: { revalidate: 0 } });
    const adsData = await adsRes.json() as {
      data?: Array<{
        id: string;
        name: string;
        status: string;
        campaign_id: string;
        campaign?: { name: string };
        adset?: { name: string };
        creative?: {
          id: string;
          name?: string;
          title?: string;
          body?: string;
          call_to_action_type?: string;
          thumbnail_url?: string;
          video_id?: string;
          object_story_spec?: {
            video_data?: { title?: string; message?: string };
            link_data?: { message?: string; name?: string };
          };
        };
      }>;
      error?: { message: string };
    };

    if (adsData.error) {
      return NextResponse.json({ creatives: [], error: adsData.error.message });
    }

    const creatives = (adsData.data ?? []).map(ad => {
      const c = ad.creative;
      const storyTitle = c?.object_story_spec?.video_data?.title ?? c?.object_story_spec?.link_data?.name;
      const storyBody  = c?.object_story_spec?.video_data?.message ?? c?.object_story_spec?.link_data?.message;
      const hasVideo   = !!c?.video_id;

      return {
        adId: ad.id,
        adName: ad.name,
        campaignId: ad.campaign_id,
        campaignName: ad.campaign?.name ?? 'Sem campanha',
        adsetName: ad.adset?.name ?? '',
        format: hasVideo ? 'video' : 'image',
        thumbnailUrl: c?.thumbnail_url ?? null,
        videoId: c?.video_id ?? null,
        videoUrl: c?.video_id ? `https://www.facebook.com/video/${c.video_id}` : null,
        title: c?.title ?? storyTitle ?? ad.name,
        body: c?.body ?? storyBody ?? '',
        callToAction: c?.call_to_action_type ?? '',
        targeting: ad.adset?.name ?? '',
      };
    });

    return NextResponse.json({ creatives });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[meta/creatives]', msg);
    return NextResponse.json({ creatives: [], error: msg });
  }
}
