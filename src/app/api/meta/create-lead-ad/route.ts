import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const META_BASE     = 'https://graph.facebook.com/v21.0';
const PAGE_ID       = process.env.META_PAGE_ID || '259079394232614';
const META_TOKEN    = process.env.META_TOKEN;
const LEAD_AD_TOKEN = process.env.LEAD_AD_TOKEN || process.env.CRON_SECRET;
const ACT           = 'act_913791682330789';

const FORM_ID  = '1298188975776677';
const IMG_HASH = '3b7d5874b1c00fb96b1e307e897ab3c2';

const CAMP_LEADS      = '120249915204770415';
const CAMP_RETARGET   = '120249915205310415';
const END_TIME        = '2026-06-30T23:59:59-03:00';

const COPIES = [
  { video_id: '1355363606481492', label: 'Lucas',  message: 'O Saco dos Limoes foi um dos bairros que mais se valorizou em Florianopolis nos ultimos 12 meses. O Hub Beira Mar ainda tem 8 apartamentos de 2 suites com vista direta para o mar, a partir de R$ 1,3 milhao. Entrada de 10%, parcelas mensais e chaves em janeiro de 2028.', headline: 'Invista onde Florianopolis mais cresce' },
  { video_id: '1685716349138194', label: 'Diego',  message: 'Imagine acordar com o mar na sua janela todos os dias. No Hub Beira Mar, apartamentos de 2 suites com vista para a Beira-Mar Sul de Florianopolis. Area de ate 88m2, rooftop com piscina panoramica, spa e coworking. A partir de R$ 1,3 milhao. Apenas 8 unidades disponiveis.', headline: 'Vista para o mar, todos os dias, da sua janela' },
  { video_id: '2144337682964102', label: 'Nilton', message: 'Saco dos Limoes, Florianopolis. Vista direta para o mar, 2 suites, ate 88m2, rooftop com piscina panoramica. A partir de R$ 1,3 milhao com entrada de 10% e chaves em janeiro de 2028. Restam apenas 8 unidades.', headline: 'Hub Beira Mar | 8 unidades com vista para o mar' },
];

interface AdResult { ad_name: string; ad_set_id: string; ok: boolean; ad_id?: string; error?: string; }

function isAuthorized(request: NextRequest): boolean {
  const allowed = LEAD_AD_TOKEN;
  if (!allowed) return false;
  const qToken = new URL(request.url).searchParams.get('token');
  if (qToken === allowed) return true;
  return (request.headers.get('authorization') || '').replace('Bearer ', '') === allowed;
}

async function createAdSet(campaignId: string, name: string, targeting: object): Promise<{id:string|null,err:string|null}> {
  try {
    const res = await axios.post(`${META_BASE}/${ACT}/adsets`, {
      name, campaign_id: campaignId, billing_event: 'IMPRESSIONS',
      optimization_goal: 'LEAD_GENERATION', destination_type: 'ON_AD',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      promoted_object: { page_id: PAGE_ID }, targeting,
      status: 'PAUSED', start_time: new Date().toISOString(), end_time: END_TIME,
      access_token: META_TOKEN,
    }, { timeout: 15000 });
    return {id: res.data?.id || null, err: null};
  } catch (err: any) {
    const msg = err.response?.data?.error?.error_user_msg || err.response?.data?.error?.message || err.message;
    return {id: null, err: msg};
  }
}

async function createAd(adSetId: string, adName: string, videoId: string, message: string, headline: string): Promise<AdResult> {
  try {
    const res = await axios.post(`${META_BASE}/${ACT}/ads`, {
      name: adName, adset_id: adSetId, status: 'PAUSED', access_token: META_TOKEN,
      creative: { object_story_spec: { page_id: PAGE_ID, video_data: {
        video_id: videoId, image_hash: IMG_HASH, message, title: headline,
        call_to_action: { type: 'LEARN_MORE', value: { lead_gen_form_id: FORM_ID } },
      }}},
    }, { timeout: 20000 });
    const adId = res.data?.id;
    if (!adId) throw new Error('ID nao retornado');
    return { ad_name: adName, ad_set_id: adSetId, ok: true, ad_id: adId };
  } catch (err: any) {
    const detail = err.response?.data?.error?.error_user_msg || err.response?.data?.error?.message || err.message;
    return { ad_name: adName, ad_set_id: adSetId, ok: false, error: detail };
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
  const exec = new URL(request.url).searchParams.get('exec');
  if (exec !== '1') return NextResponse.json({ ok: true, meta_token_configured: !!META_TOKEN, act: ACT });
  if (!META_TOKEN) return NextResponse.json({ error: 'META_TOKEN nao configurado' }, { status: 500 });

  // Cria 4 ad sets nas campanhas ja existentes
  const [rAmplo, rGfloripa, rEngajados, rVideos] = await Promise.all([
    createAdSet(CAMP_LEADS,    'HBM | Formulario | Brasil Amplo | 28-55',       { geo_locations: { countries: ['BR'] }, age_min: 28, age_max: 55 }),
    createAdSet(CAMP_LEADS,    'HBM | Formulario | Grande Florianopolis',        { geo_locations: { custom_locations: [{ latitude: -27.5935, longitude: -48.5761, radius: 30, distance_unit: 'kilometer' }] }, age_min: 28, age_max: 60 }),
    createAdSet(CAMP_RETARGET, 'HBM | Retargeting | IG + FB Engajados 365d',   { geo_locations: { countries: ['BR'] }, custom_audiences: [{ id: '120249105925720415' }, { id: '120249105927630415' }, { id: '120246234250200415' }, { id: '120247232752100415' }] }),
    createAdSet(CAMP_RETARGET, 'HBM | Retargeting | Viram Videos + Leads CRM', { geo_locations: { countries: ['BR'] }, custom_audiences: [{ id: '120246234223350415' }, { id: '120247232761650415' }, { id: '120249899124900415' }] }),
  ]);
  const asErrors = [rAmplo.err, rGfloripa.err, rEngajados.err, rVideos.err].filter(Boolean);
  const asAmplo = rAmplo.id; const asGfloripa = rGfloripa.id; const asEngajados = rEngajados.id; const asVideos = rVideos.id;

  const adSets = [
    { id: asAmplo,     label: 'Brasil Amplo' },
    { id: asGfloripa,  label: 'Grande Florianopolis' },
    { id: asEngajados, label: 'Retargeting Engajados' },
    { id: asVideos,    label: 'Retargeting Videos CRM' },
  ].filter(a => a.id);

  // Cria 12 anuncios
  const tasks: Array<() => Promise<AdResult>> = [];
  for (const adSet of adSets) {
    for (const copy of COPIES) {
      const name = `HBM | ${copy.label} | ${adSet.label}`;
      tasks.push(() => createAd(adSet.id!, name, copy.video_id, copy.message, copy.headline));
    }
  }

  const results: AdResult[] = [];
  for (let i = 0; i < tasks.length; i += 3) {
    const settled = await Promise.allSettled(tasks.slice(i, i + 3).map(t => t()));
    for (const r of settled) {
      results.push(r.status === 'fulfilled' ? r.value : { ad_name:'?', ad_set_id:'?', ok:false, error:String((r as PromiseRejectedResult).reason) });
    }
    if (i + 3 < tasks.length) await new Promise(r => setTimeout(r, 1200));
  }

  const created = results.filter(r => r.ok).length;
  const failed  = results.filter(r => !r.ok).length;
  return NextResponse.json({ ok: failed === 0, campaigns: { leads: CAMP_LEADS, retargeting: CAMP_RETARGET }, ad_set_errors: asErrors, ad_sets: adSets, created, failed, results });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
  if (!META_TOKEN) return NextResponse.json({ error: 'META_TOKEN nao configurado' }, { status: 500 });
  let body: { ads: any[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalido' }, { status: 400 }); }
  const { ads } = body;
  if (!Array.isArray(ads) || !ads.length) return NextResponse.json({ error: 'ads vazio' }, { status: 400 });
  const results: AdResult[] = [];
  for (let i = 0; i < ads.length; i += 3) {
    const settled = await Promise.allSettled(ads.slice(i, i + 3).map((ad: any) => createAd(ad.ad_set_id, ad.ad_name, ad.video_id, ad.message, ad.headline)));
    for (const r of settled) results.push(r.status === 'fulfilled' ? r.value : { ad_name:'?', ad_set_id:'?', ok:false, error:String((r as PromiseRejectedResult).reason) });
    if (i + 3 < ads.length) await new Promise(r => setTimeout(r, 1000));
  }
  const created = results.filter(r => r.ok).length;
  const failed  = results.filter(r => !r.ok).length;
  return NextResponse.json({ ok: failed === 0, created, failed, results });
}
