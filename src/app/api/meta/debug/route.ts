import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// Rota de diagnóstico temporária — aceita token direto para inspeção
export async function GET(request: NextRequest) {
  // Usa o token do env OU o passado via query (para teste externo)
  const queryToken = request.nextUrl.searchParams.get('t');
  const META_TOKEN  = queryToken || process.env.META_TOKEN;
  const META_ACT_ID = process.env.META_ACT_ID;

  if (!META_TOKEN) {
    return NextResponse.json({ error: 'Token ausente' }, { status: 400 });
  }

  const [debugRes, meRes, adAccountRes, pagesRes, leadFormsRes] = await Promise.allSettled([
    axios.get(`https://graph.facebook.com/v21.0/debug_token`, {
      params: { input_token: META_TOKEN, access_token: META_TOKEN },
      timeout: 10000,
    }),
    axios.get(`https://graph.facebook.com/v21.0/me`, {
      params: { fields: 'id,name', access_token: META_TOKEN },
      timeout: 10000,
    }),
    axios.get(`https://graph.facebook.com/v21.0/${META_ACT_ID}`, {
      params: { fields: 'id,name,account_status,currency,timezone_name,business', access_token: META_TOKEN },
      timeout: 10000,
    }),
    axios.get(`https://graph.facebook.com/v21.0/me/accounts`, {
      params: { fields: 'id,name,category,tasks', access_token: META_TOKEN },
      timeout: 10000,
    }),
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
    token_debug:   extract(debugRes),
    me:            extract(meRes),
    ad_account:    extract(adAccountRes),
    pages:         extract(pagesRes),
    leadgen_forms: extract(leadFormsRes),
  });
}
