/**
 * /api/meta/campaigns
 * 
 * GET  → lista campanhas com status atual (ACTIVE/PAUSED)
 * PATCH → pausar, ativar ou editar orçamento de campanha/adset
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import axios from 'axios';

const META_BASE = 'https://graph.facebook.com/v21.0';

function metaHeaders() {
  return { access_token: process.env.META_TOKEN };
}

// ─── GET: lista campanhas e adsets com status e orçamento ─────────────────────
export async function GET(request: NextRequest) {
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const META_ACT_ID = process.env.META_ACT_ID;

  const [campaignsRes, adsetsRes] = await Promise.allSettled([
    axios.get(`${META_BASE}/${META_ACT_ID}/campaigns`, {
      params: {
        fields: 'id,name,status,effective_status,objective,buying_type,daily_budget,lifetime_budget,spend_cap,start_time,stop_time,created_time',
        limit: 200,
        ...metaHeaders(),
      },
      timeout: 15000,
    }),
    axios.get(`${META_BASE}/${META_ACT_ID}/adsets`, {
      params: {
        fields: 'id,name,campaign_id,status,effective_status,optimization_goal,daily_budget,lifetime_budget,start_time,end_time,targeting',
        limit: 500,
        ...metaHeaders(),
      },
      timeout: 15000,
    }),
  ]);

  return NextResponse.json({
    campaigns: campaignsRes.status === 'fulfilled' ? (campaignsRes.value as any).data?.data ?? [] : [],
    adsets:    adsetsRes.status === 'fulfilled'    ? (adsetsRes.value    as any).data?.data ?? [] : [],
    errors: {
      campaigns: campaignsRes.status === 'rejected' ? (campaignsRes as any).reason?.response?.data : null,
      adsets:    adsetsRes.status    === 'rejected' ? (adsetsRes    as any).reason?.response?.data : null,
    }
  });
}

// ─── PATCH: pausar, ativar ou editar orçamento ────────────────────────────────
export async function PATCH(request: NextRequest) {
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  // Rate limit agressivo: operações de escrita na Meta têm custo real
  const ip = getClientIp(request);
  const rl = await rateLimit(`meta_write:${admin.userId}`, 20, 60);
  if (!rl.success) {
    return NextResponse.json({ error: 'Limite de operações atingido. Aguarde.' }, { status: 429 });
  }

  const body = await request.json();
  const { id, type, action, daily_budget, lifetime_budget } = body;

  // Validações
  if (!id || !type) {
    return NextResponse.json({ error: 'id e type (campaign|adset) são obrigatórios' }, { status: 400 });
  }
  if (!['campaign', 'adset'].includes(type)) {
    return NextResponse.json({ error: 'type deve ser campaign ou adset' }, { status: 400 });
  }
  if (!action && !daily_budget && !lifetime_budget) {
    return NextResponse.json({ error: 'Informe action (ACTIVE|PAUSED) ou um orçamento' }, { status: 400 });
  }
  if (action && !['ACTIVE', 'PAUSED'].includes(action)) {
    return NextResponse.json({ error: 'action deve ser ACTIVE ou PAUSED' }, { status: 400 });
  }

  // Montar payload
  const updatePayload: Record<string, any> = {};
  if (action) updatePayload.status = action;
  if (daily_budget) updatePayload.daily_budget = Math.round(parseFloat(daily_budget) * 100); // centavos
  if (lifetime_budget) updatePayload.lifetime_budget = Math.round(parseFloat(lifetime_budget) * 100);

  try {
    const res = await axios.post(`${META_BASE}/${id}`, updatePayload, {
      params: metaHeaders(),
      timeout: 15000,
    });

    console.log(`[meta/campaigns] ${type} ${id} atualizado por ${admin.name}: ${JSON.stringify(updatePayload)}`);

    return NextResponse.json({
      success: true,
      id,
      type,
      updated: updatePayload,
      meta_response: (res as any).data,
    });
  } catch (err: any) {
    console.error(`[meta/campaigns] Erro ao atualizar ${type} ${id}:`, err.response?.data);
    return NextResponse.json(
      { error: 'Erro ao atualizar no Meta', details: err.response?.data },
      { status: 500 }
    );
  }
}
