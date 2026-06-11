/**
 * POST /api/meta/create-lead-ad  — cria anuncios em lote
 * GET  /api/meta/create-lead-ad?token=xxx&exec=1 — executa os 12 anuncios HBM hardcoded
 * Auth: query param ?token=LEAD_AD_TOKEN
 */
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const META_BASE     = 'https://graph.facebook.com/v21.0';
const PAGE_ID       = process.env.META_PAGE_ID || '259079394232614';
const META_TOKEN    = process.env.META_TOKEN;
const LEAD_AD_TOKEN = process.env.LEAD_AD_TOKEN || process.env.CRON_SECRET;

const FORM_ID   = '1298188975776677';
const IMG_HASH  = '3b7d5874b1c00fb96b1e307e897ab3c2';

const COPIES = [
  {
    video_id: '1355363606481492',
    label:    'Lucas',
    message:  'O Saco dos Limoes foi um dos bairros que mais se valorizou em Florianopolis nos ultimos 12 meses. O Hub Beira Mar ainda tem 8 apartamentos de 2 suites com vista direta para o mar, a partir de R$ 1,3 milhao. Entrada de 10%, parcelas mensais e chaves em janeiro de 2028.',
    headline: 'Invista onde Florianopolis mais cresce',
  },
  {
    video_id: '1685716349138194',
    label:    'Diego',
    message:  'Imagine acordar com o mar na sua janela todos os dias. No Hub Beira Mar, apartamentos de 2 suites com vista para a Beira-Mar Sul de Florianopolis. Area de ate 88m2, rooftop com piscina panoramica, spa e coworking. A partir de R$ 1,3 milhao. Apenas 8 unidades disponiveis.',
    headline: 'Vista para o mar, todos os dias, da sua janela',
  },
  {
    video_id: '2144337682964102',
    label:    'Nilton',
    message:  'Saco dos Limoes, Florianopolis. Vista direta para o mar, 2 suites, ate 88m2, rooftop com piscina panoramica. A partir de R$ 1,3 milhao com entrada de 10% e chaves em janeiro de 2028. Restam apenas 8 unidades.',
    headline: 'Hub Beira Mar | 8 unidades com vista para o mar',
  },
];

const AD_SETS = [
  { id: '120249914439430415', label: 'Brasil Amplo'       },
  { id: '120249914440730415', label: 'Grande Florianopolis'},
  { id: '120249914442360415', label: 'Retargeting Engajados'},
  { id: '120249914443640415', label: 'Retargeting Videos CRM'},
];

interface AdResult {
  ad_name:   string;
  ad_set_id: string;
  ok:        boolean;
  ad_id?:    string;
  error?:    string;
}

function isAuthorized(request: NextRequest): boolean {
  const allowed = LEAD_AD_TOKEN;
  if (!allowed) return false;
  const qToken = new URL(request.url).searchParams.get('token');
  if (qToken === allowed) return true;
  const bearer = (request.headers.get('authorization') || '').replace('Bearer ', '');
  return bearer === allowed;
}

async function createAd(adSetId: string, adName: string, videoId: string, message: string, headline: string): Promise<AdResult> {
  const creativeSpec = {
    page_id: PAGE_ID,
    video_data: {
      video_id:   videoId,
      image_hash: IMG_HASH,
      message,
      title:      headline,
      call_to_action: { type: 'LEARN_MORE', value: { lead_gen_form_id: FORM_ID } },
    },
  };
  try {
    const res = await axios.post(
      `${META_BASE}/${adSetId}/ads`,
      { name: adName, creative: { object_story_spec: creativeSpec }, status: 'PAUSED', access_token: META_TOKEN },
      { timeout: 20000 }
    );
    const adId = res.data?.id;
    if (!adId) throw new Error('ID nao retornado');
    return { ad_name: adName, ad_set_id: adSetId, ok: true, ad_id: adId };
  } catch (err: any) {
    const detail = err.response?.data?.error?.error_user_msg || err.response?.data?.error?.message || err.message;
    return { ad_name: adName, ad_set_id: adSetId, ok: false, error: detail };
  }
}

// GET: health check ou execucao dos 12 anuncios HBM (?exec=1)
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

  const exec = new URL(request.url).searchParams.get('exec');
  if (exec !== '1') {
    return NextResponse.json({ ok: true, meta_token_configured: !!META_TOKEN, page_id: PAGE_ID });
  }

  if (!META_TOKEN) return NextResponse.json({ error: 'META_TOKEN nao configurado' }, { status: 500 });

  // Gera os 12 anuncios: 3 videos x 4 ad sets
  const tasks: Array<() => Promise<AdResult>> = [];
  for (const adSet of AD_SETS) {
    for (const copy of COPIES) {
      const adName = `HBM | ${copy.label} | ${adSet.label}`;
      tasks.push(() => createAd(adSet.id, adName, copy.video_id, copy.message, copy.headline));
    }
  }

  const results: AdResult[] = [];
  const BATCH = 3;
  for (let i = 0; i < tasks.length; i += BATCH) {
    const settled = await Promise.allSettled(tasks.slice(i, i + BATCH).map(t => t()));
    for (const r of settled) {
      results.push(r.status === 'fulfilled' ? r.value : { ad_name:'?', ad_set_id:'?', ok:false, error:String((r as PromiseRejectedResult).reason) });
    }
    if (i + BATCH < tasks.length) await new Promise(r => setTimeout(r, 1000));
  }

  const created = results.filter(r => r.ok).length;
  const failed  = results.filter(r => !r.ok).length;
  return NextResponse.json({ ok: failed === 0, created, failed, results });
}

// POST: aceita payload customizado
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
  if (!META_TOKEN) return NextResponse.json({ error: 'META_TOKEN nao configurado' }, { status: 500 });

  let body: { ads: any[] };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON invalido' }, { status: 400 }); }

  const { ads } = body;
  if (!Array.isArray(ads) || ads.length === 0) return NextResponse.json({ error: 'ads vazio' }, { status: 400 });

  const results: AdResult[] = [];
  for (let i = 0; i < ads.length; i += 3) {
    const settled = await Promise.allSettled(
      ads.slice(i, i + 3).map((ad: any) => createAd(ad.ad_set_id, ad.ad_name, ad.video_id, ad.message, ad.headline))
    );
    for (const r of settled) {
      results.push(r.status === 'fulfilled' ? r.value : { ad_name:'?', ad_set_id:'?', ok:false, error:String((r as PromiseRejectedResult).reason) });
    }
    if (i + 3 < ads.length) await new Promise(r => setTimeout(r, 1000));
  }

  const created = results.filter(r => r.ok).length;
  const failed  = results.filter(r => !r.ok).length;
  return NextResponse.json({ ok: failed === 0, created, failed, results });
}
