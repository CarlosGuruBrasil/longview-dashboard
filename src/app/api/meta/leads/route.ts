/**
 * /api/meta/leads
 *
 * GET → lista todos os formulários de leads da página e seus leads brutos
 *       ?form_id=xxx → leads de um formulário específico
 *       ?since=YYYY-MM-DD → filtro de data
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { kv } from '@vercel/kv';
import axios from 'axios';

const META_BASE  = 'https://graph.facebook.com/v21.0';
const PAGE_ID    = '259079394232614'; // Longview Empreendimentos
const CACHE_TTL  = 900; // 15 min — leads mudam mais frequentemente

function metaAuth() {
  return { access_token: process.env.META_TOKEN };
}

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const ip = getClientIp(request);
  const rl = await rateLimit(`meta_leads:${ip}`, 20, 60);
  if (!rl.success) return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 });

  const { searchParams } = new URL(request.url);
  const formId       = searchParams.get('form_id');
  const since        = searchParams.get('since');
  const forceRefresh = searchParams.get('refresh') === 'true';

  const cacheKey = `meta_leads_${formId ?? 'all'}_${since ?? 'all'}`;

  // Tentar cache
  if (!forceRefresh) {
    try {
      const cached = await kv.get<any>(cacheKey);
      if (cached) return NextResponse.json({ ...cached, _cached: true });
    } catch { /* non-critical */ }
  }

  try {
    // 1. Buscar formulários de leads da página
    const formsRes = await axios.get(`${META_BASE}/${PAGE_ID}/leadgen_forms`, {
      params: {
        fields: 'id,name,status,leads_count,created_time,questions',
        limit: 100,
        ...metaAuth(),
      },
      timeout: 15000,
    });

    const forms: any[] = (formsRes as any).data?.data ?? [];

    // 2. Se form_id específico, buscar leads desse formulário
    if (formId) {
      const leadsRes = await axios.get(`${META_BASE}/${formId}/leads`, {
        params: {
          fields: 'id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id',
          limit: 500,
          ...(since ? { filtering: JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: Math.floor(new Date(since).getTime() / 1000) }]) } : {}),
          ...metaAuth(),
        },
        timeout: 20000,
      });

      const result = {
        forms,
        leads:     (leadsRes as any).data?.data ?? [],
        form_id:   formId,
        updatedAt: new Date().toISOString(),
      };

      try { await kv.set(cacheKey, result, { ex: CACHE_TTL }); } catch { /* non-critical */ }
      return NextResponse.json(result);
    }

    // 3. Buscar leads de todos os formulários em paralelo (limitado aos 5 mais recentes ativos)
    const activeForms = forms
      .filter(f => f.status !== 'ARCHIVED')
      .slice(0, 5);

    const leadsPromises = activeForms.map(form =>
      axios.get(`${META_BASE}/${form.id}/leads`, {
        params: {
          fields: 'id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id',
          limit: 200,
          ...metaAuth(),
        },
        timeout: 20000,
      }).then((r: any) => ({ form_id: form.id, form_name: form.name, leads: r.data?.data ?? [] }))
        .catch(() => ({ form_id: form.id, form_name: form.name, leads: [], _error: true }))
    );

    const leadsPerForm = await Promise.all(leadsPromises);

    // Achatar todos os leads com referência ao formulário de origem
    const allLeads = leadsPerForm.flatMap(f =>
      f.leads.map((l: any) => ({ ...l, _form_name: f.form_name }))
    );

    const result = {
      forms,
      leads:       allLeads,
      leads_by_form: leadsPerForm,
      total_leads: allLeads.length,
      updatedAt:   new Date().toISOString(),
    };

    try { await kv.set(cacheKey, result, { ex: CACHE_TTL }); } catch { /* non-critical */ }
    return NextResponse.json(result);

  } catch (err: any) {
    console.error('[meta/leads] Erro:', err.response?.data || err.message);
    return NextResponse.json(
      { error: 'Erro ao buscar leads Meta', details: err.response?.data || err.message },
      { status: 500 }
    );
  }
}
