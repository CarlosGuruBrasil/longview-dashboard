import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// Rota temporária de diagnóstico — protegida por secret na query string
// Remover após análise
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== process.env.DEBUG_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const META_TOKEN  = process.env.META_TOKEN;
  const META_ACT_ID = process.env.META_ACT_ID;

  const [debugRes, meRes, adAccountRes, pagesRes, leadFormsRes] = await Promise.allSettled([
    // 1. Escopos e tipo do token
    axios.get(`https://graph.facebook.com/v21.0/debug_token`, {
      params: { input_token: META_TOKEN, access_token: META_TOKEN },
      timeout: 10000,
    }),
    // 2. Identidade
    axios.get(`https://graph.facebook.com/v21.0/me`, {
      params: { fields: 'id,name', access_token: META_TOKEN },
      timeout: 10000,
    }),
    // 3. Conta de anúncios
    axios.get(`https://graph.facebook.com/v21.0/${META_ACT_ID}`, {
      params: { fields: 'id,name,account_status,currency,timezone_name,business', access_token: META_TOKEN },
      timeout: 10000,
    }),
    // 4. Páginas acessíveis (posts + leads)
    axios.get(`https://graph.facebook.com/v21.0/me/accounts`, {
      params: { fields: 'id,name,category,tasks,access_token', access_token: META_TOKEN },
      timeout: 10000,
    }),
    // 5. Formulários de leads (test direto)
    axios.get(`https://graph.facebook.com/v21.0/${META_ACT_ID}/leadgen_forms`, {
      params: { fields: 'id,name,status,leads_count', access_token: META_TOKEN },
      timeout: 10000,
    }),
  ]);

  const extract = (r: any) =>
    r.status === 'fulfilled'
      ? r.value.data
      : { _error: r.reason?.response?.data || r.reason?.message };

  return NextResponse.json({
    token_debug:  extract(debugRes),
    me:           extract(meRes),
    ad_account:   extract(adAccountRes),
    pages:        extract(pagesRes),
    leadgen_forms: extract(leadFormsRes),
    env: {
      META_ACT_ID: META_ACT_ID ? `${META_ACT_ID.slice(0,6)}...` : 'AUSENTE',
      META_TOKEN:  META_TOKEN  ? `${META_TOKEN.slice(0,12)}...` : 'AUSENTE',
    }
  });
}
