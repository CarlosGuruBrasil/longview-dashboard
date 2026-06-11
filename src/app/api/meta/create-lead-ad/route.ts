import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const G          = 'https://graph.facebook.com/v21.0';
const PAGE_ID    = '259079394232614';
const ACT        = 'act_913791682330789';
const AUTH_TOKEN = process.env.LEAD_AD_TOKEN || process.env.CRON_SECRET;
const FORM_ID    = '1298188975776677';
const IMG_HASH   = '3b7d5874b1c00fb96b1e307e897ab3c2';
const END        = '2026-06-30T23:59:59-03:00';

const COPIES = [
  { video_id:'1355363606481492', label:'Lucas',  msg:'O Saco dos Limoes foi um dos bairros que mais se valorizou em Florianopolis nos ultimos 12 meses. O Hub Beira Mar ainda tem 8 apartamentos de 2 suites com vista direta para o mar, a partir de R$ 1,3 milhao. Entrada de 10%, parcelas mensais e chaves em janeiro de 2028.',  hl:'Invista onde Florianopolis mais cresce' },
  { video_id:'1685716349138194', label:'Diego',  msg:'Imagine acordar com o mar na sua janela todos os dias. No Hub Beira Mar, apartamentos de 2 suites com vista para a Beira-Mar Sul de Florianopolis. Area de ate 88m2, rooftop com piscina panoramica. A partir de R$ 1,3 milhao. Apenas 8 unidades disponiveis.', hl:'Vista para o mar, todos os dias, da sua janela' },
  { video_id:'2144337682964102', label:'Nilton', msg:'Saco dos Limoes, Florianopolis. Vista direta para o mar, 2 suites, ate 88m2, rooftop com piscina panoramica. A partir de R$ 1,3 milhao com entrada de 10% e chaves em janeiro de 2028. Restam apenas 8 unidades.', hl:'Hub Beira Mar | 8 unidades com vista para o mar' },
];

const ADSETS_DEF = [
  { camp:'ret',   name:'HBM | Retargeting | Viram Videos + Leads CRM', budget:24000, targeting:{ geo_locations:{ countries:['BR'] }, custom_audiences:[{id:'120246234223350415'},{id:'120247232761650415'},{id:'120249899124900415'}] } },
];

// Ad sets ja criados com sucesso — usados na etapa de anuncios
const EXISTING_ADSETS = [
  { name:'HBM | Formulario | Grande Florianopolis',    id:'120249915947690415', ok:true },
  { name:'HBM | Retargeting | IG + FB Engajados 365d', id:'120249915947700415', ok:true },
  { name:'HBM | Formulario | Brasil Amplo | 28-55',    id:'120249916157890415', ok:true },
];

function auth(req: NextRequest): boolean {
  if (!AUTH_TOKEN) return false;
  const q = new URL(req.url).searchParams.get('token');
  if (q === AUTH_TOKEN) return true;
  return (req.headers.get('authorization')||'').replace('Bearer ','') === AUTH_TOKEN;
}

async function api(token: string, path: string, data: object) {
  return axios.post(`${G}/${path}`, { ...data, access_token: token }, { timeout: 20000 });
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error:'401' }, { status:401 });

  const url   = new URL(req.url);
  const exec  = url.searchParams.get('exec');
  const token = url.searchParams.get('user_token') || '';

  if (exec !== '1') return NextResponse.json({ ok:true, ready:true });
  if (!token)       return NextResponse.json({ error:'user_token obrigatorio como query param' }, { status:400 });
  const step = url.searchParams.get('step') || 'all';

  const log: any[] = [];

  // Campanhas ja criadas com sucesso via token Longview
  const campL = '120249915769170415'; // HUB Beira Mar | Leads | Formulario | Jun 2026
  const campR = '120249915769150415'; // HUB Beira Mar | Retargeting | Leads | Jun 2026
  log.push({ step:'campaigns', campL, campR, note:'usando campanhas existentes' });

  // 2. Criar 4 adsets com daily_budget
  const adsetRes = await Promise.all(ADSETS_DEF.map(async cfg => {
    const campId = cfg.camp === 'leads' ? campL : campR;
    try {
      const r = await api(token, `${ACT}/adsets`, {
        name: cfg.name, campaign_id: campId,
        billing_event: 'IMPRESSIONS', optimization_goal: 'LEAD_GENERATION',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        destination_type: 'ON_AD', daily_budget: cfg.budget,
        promoted_object: { page_id: PAGE_ID }, targeting: cfg.targeting,
        status: 'PAUSED',
      });
      return { name:cfg.name, id:(r as any).data?.id, ok:true };
    } catch (e: any) {
      const err = e.response?.data?.error?.error_user_msg || e.response?.data?.error?.message || e.message;
      return { name:cfg.name, id:null, ok:false, error:err };
    }
  }));
  log.push({ step:'adsets', results:adsetRes });
  const validAdSets = [...EXISTING_ADSETS, ...adsetRes.filter(a => a.ok && a.id)];

  if (step === 'adsets') {
    return NextResponse.json({ ok: validAdSets.length > 0, adsets:adsetRes, validAdSets, log });
  }

  // step=ads: pula criacao de adsets, usa apenas os EXISTING_ADSETS
  // adset_idx=0,1,2 para processar um adset por vez (evita timeout)
  let finalAdSets = step === 'ads' ? EXISTING_ADSETS : validAdSets;
  const adsetIdx = url.searchParams.get('adset_idx');
  if (adsetIdx !== null) {
    const idx = parseInt(adsetIdx);
    finalAdSets = finalAdSets.filter((_:any, i:number) => i === idx);
  }

  // 3. Criar 12 anuncios
  const adRes: any[] = [];
  for (const adSet of finalAdSets) {
    for (const copy of COPIES) {
      try {
        const r = await api(token, `${ACT}/ads`, {
          name:     `HBM | ${copy.label} | ${adSet.name.replace('HBM | ','').split(' |')[0]}`,
          adset_id: adSet.id,
          status:   'PAUSED',
          creative: { object_story_spec: { page_id: PAGE_ID, video_data: {
            video_id: copy.video_id, image_hash: IMG_HASH,
            message: copy.msg, title: copy.hl,
            call_to_action: { type:'LEARN_MORE', value:{ lead_gen_form_id: FORM_ID } },
          }}},
        });
        adRes.push({ ad:`HBM|${copy.label}`, adset:adSet.name, ok:true, id:(r as any).data?.id });
      } catch (e: any) {
        const err = (e as any).response?.data?.error?.error_user_msg || (e as any).response?.data?.error?.message || (e as any).message;
        adRes.push({ ad:`HBM|${copy.label}`, adset:adSet.name, ok:false, error:err });
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  const created = adRes.filter(r => r.ok).length;
  const failed  = adRes.filter(r => !r.ok).length;
  return NextResponse.json({
    ok: failed===0 && validAdSets.length===4,
    campaigns: { leads:campL, retargeting:campR },
    adsets: adsetRes,
    ads: { created, failed, results:adRes },
    log,
  });
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error:'401' }, { status:401 });
  return NextResponse.json({ ok:true, info:'Use GET ?exec=1&user_token=TOKEN' });
}
