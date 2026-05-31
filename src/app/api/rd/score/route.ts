import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import axios from 'axios';

const SCORE_TIERS = [
  { min: 75, label: 'quente', conversion_id: 'lead_quente_longview' },
  { min: 40, label: 'morno',  conversion_id: 'lead_morno_longview'  },
  { min: 0,  label: 'frio',   conversion_id: 'lead_frio_longview'   },
];

function getTier(score: number) {
  return SCORE_TIERS.find(t => score >= t.min) ?? SCORE_TIERS[SCORE_TIERS.length - 1];
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const ip = getClientIp(request);
  const rl = await rateLimit(`rd_score:${ip}`, 60, 60);
  if (!rl.success) return NextResponse.json({ error: 'Rate limit atingido' }, { status: 429 });

  const body = await request.json();
  const { email, score, nome, telefone, origem } = body;

  if (!email || score === undefined) {
    return NextResponse.json({ error: 'email e score são obrigatórios' }, { status: 400 });
  }

  const apiKey = process.env.RD_TOKEN_PUBLIC;
  if (!apiKey) return NextResponse.json({ error: 'RD_TOKEN_PUBLIC não configurado' }, { status: 500 });

  const tier = getTier(Number(score));

  const payload: Record<string, any> = {
    conversion_identifier: tier.conversion_id,
    email,
    cf_score_intencao:    String(score),
    cf_temperatura_lead:  tier.label,
    cf_origem_captacao:   origem || 'meta_ads',
    cf_data_score:        new Date().toISOString().split('T')[0],
    tags: [`score_${tier.label}`, 'longview_dashboard'],
    available_for_mailing: true,
    legal_bases: [{ category: 'communications', type: 'consent', status: 'granted' }],
  };

  if (nome)     payload.name           = nome;
  if (telefone) payload.personal_phone = telefone;

  try {
    const res = await axios.post(
      'https://api.rd.services/platform/events',
      { event_type: 'CONVERSION', event_family: 'CDP', payload },
      { params: { api_key: apiKey }, timeout: 15000 }
    );
    console.log(`[rd/score] ${score} (${tier.label}) → ${email}`);
    return NextResponse.json({
      success: true, email, score: Number(score),
      temperatura: tier.label, conversion_sent: tier.conversion_id, rd_response: res.data,
    });
  } catch (err: any) {
    console.error('[rd/score]', err.response?.data || err.message);
    return NextResponse.json(
      { error: 'Erro ao enviar score', details: err.response?.data || err.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  if (!email) return NextResponse.json({ error: 'email obrigatório' }, { status: 400 });

  const token = process.env.RD_TOKEN_PRIVATE;
  if (!token) return NextResponse.json({ error: 'RD_TOKEN_PRIVATE não configurado' }, { status: 500 });

  try {
    const res = await axios.get(
      `https://api.rd.services/platform/contacts/email:${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
    );
    const c = res.data;
    return NextResponse.json({
      found: true, email,
      contact: {
        uuid: c.uuid, name: c.name,
        score_intencao:    c.cf_score_intencao   || null,
        temperatura:       c.cf_temperatura_lead || null,
        origem:            c.cf_origem_captacao  || null,
        data_score:        c.cf_data_score       || null,
        tags:              c.tags                || [],
        lead_score_nativo: c.lead_score          || null,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.response?.data || err.message }, { status: err.response?.status || 500 });
  }
}
