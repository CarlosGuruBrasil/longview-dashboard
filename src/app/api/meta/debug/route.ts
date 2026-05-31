import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import axios from 'axios';

export async function GET(request: NextRequest) {
  const admin = await verifyAdminAuth();
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const META_TOKEN  = process.env.META_TOKEN;
  const META_ACT_ID = process.env.META_ACT_ID;

  if (!META_TOKEN) {
    return NextResponse.json({ error: 'META_TOKEN não configurado' }, { status: 500 });
  }

  const [debugRes, meRes, adAccountRes, pagesRes] = await Promise.allSettled([
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
  ]);

  return NextResponse.json({
    token_debug: debugRes.status === 'fulfilled'
      ? (debugRes.value as any).data
      : { error: (debugRes as any).reason?.response?.data || (debugRes as any).reason?.message },
    me: meRes.status === 'fulfilled'
      ? (meRes.value as any).data
      : { error: (meRes as any).reason?.response?.data || (meRes as any).reason?.message },
    ad_account: adAccountRes.status === 'fulfilled'
      ? (adAccountRes.value as any).data
      : { error: (adAccountRes as any).reason?.response?.data || (adAccountRes as any).reason?.message },
    pages: pagesRes.status === 'fulfilled'
      ? (pagesRes.value as any).data
      : { error: (pagesRes as any).reason?.response?.data || (pagesRes as any).reason?.message },
  });
}
