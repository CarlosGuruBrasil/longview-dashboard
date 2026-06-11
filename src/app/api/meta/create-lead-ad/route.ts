/**
 * POST /api/meta/create-lead-ad
 *
 * Cria anuncios de lead generation via Graph API usando o META_TOKEN
 * do Vercel — token com permissao leads_retrieval que o MCP do Claude
 * nao possui. Suporta criacao em lote (array de ads).
 *
 * Body: {
 *   ads: [{
 *     ad_name:       string
 *     ad_set_id:     string
 *     video_id:      string
 *     image_hash:    string
 *     form_id:       string
 *     message:       string
 *     headline:      string
 *     page_id?:      string  (padrao: PAGE_ID do env)
 *   }]
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import axios from 'axios';

const META_BASE = 'https://graph.facebook.com/v21.0';
const PAGE_ID   = process.env.META_PAGE_ID  || '259079394232614';
const TOKEN     = process.env.META_TOKEN;

interface AdPayload {
  ad_name:    string;
  ad_set_id:  string;
  video_id:   string;
  image_hash: string;
  form_id:    string;
  message:    string;
  headline:   string;
  page_id?:   string;
}

interface AdResult {
  ad_name:   string;
  ad_set_id: string;
  ok:        boolean;
  ad_id?:    string;
  error?:    string;
}

async function createSingleAd(payload: AdPayload): Promise<AdResult> {
  const pageId = payload.page_id || PAGE_ID;

  const creativeSpec = {
    page_id: pageId,
    video_data: {
      video_id:   payload.video_id,
      image_hash: payload.image_hash,
      message:    payload.message,
      title:      payload.headline,
      call_to_action: {
        type:  'LEARN_MORE',
        value: { lead_gen_form_id: payload.form_id },
      },
    },
  };

  try {
    const res = await axios.post(
      `${META_BASE}/${payload.ad_set_id}/ads`,
      {
        name:             payload.ad_name,
        creative:         { object_story_spec: creativeSpec },
        status:           'PAUSED',
        access_token:     TOKEN,
      },
      { timeout: 20000 }
    );

    const adId = res.data?.id;
    if (!adId) throw new Error('ID do anuncio nao retornado pela API');

    return { ad_name: payload.ad_name, ad_set_id: payload.ad_set_id, ok: true, ad_id: adId };

  } catch (err: any) {
    const detail =
      err.response?.data?.error?.error_user_msg ||
      err.response?.data?.error?.message        ||
      err.message;
    return { ad_name: payload.ad_name, ad_set_id: payload.ad_set_id, ok: false, error: detail };
  }
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

  if (!TOKEN) {
    return NextResponse.json({ error: 'META_TOKEN nao configurado no Vercel' }, { status: 500 });
  }

  let body: { ads: AdPayload[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  }

  const { ads } = body;

  if (!Array.isArray(ads) || ads.length === 0) {
    return NextResponse.json({ error: 'Campo ads deve ser um array nao vazio' }, { status: 400 });
  }

  // Valida campos obrigatorios
  for (const ad of ads) {
    for (const field of ['ad_name', 'ad_set_id', 'video_id', 'image_hash', 'form_id', 'message', 'headline'] as const) {
      if (!ad[field]) {
        return NextResponse.json(
          { error: `Campo obrigatorio ausente: ${field}`, ad },
          { status: 400 }
        );
      }
    }
  }

  // Processa em lotes de 3 para nao saturar rate limit
  const results: AdResult[] = [];
  const BATCH = 3;

  for (let i = 0; i < ads.length; i += BATCH) {
    const batch = ads.slice(i, i + BATCH);
    const batchResults = await Promise.allSettled(batch.map(createSingleAd));
    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(r.value);
      else results.push({ ad_name: '?', ad_set_id: '?', ok: false, error: r.reason?.message });
    }
    if (i + BATCH < ads.length) await new Promise(r => setTimeout(r, 1000));
  }

  const created = results.filter(r => r.ok).length;
  const failed  = results.filter(r => !r.ok).length;

  return NextResponse.json({
    ok:      failed === 0,
    created,
    failed,
    results,
  });
}

// GET: health check + lista os IDs que serao usados
export async function GET() {
  return NextResponse.json({
    ok:       true,
    endpoint: 'POST /api/meta/create-lead-ad',
    token_configured: !!TOKEN,
    default_page_id:  PAGE_ID,
    body_schema: {
      ads: [{
        ad_name:    'string — nome do anuncio',
        ad_set_id:  'string — ID do conjunto de anuncios',
        video_id:   'string — ID do video ja enviado na conta',
        image_hash: 'string — hash da imagem thumbnail',
        form_id:    'string — ID do formulario instant',
        message:    'string — texto principal do anuncio',
        headline:   'string — titulo abaixo do video',
        page_id:    'string? — opcional, usa PAGE_ID do env por padrao',
      }],
    },
  });
}
