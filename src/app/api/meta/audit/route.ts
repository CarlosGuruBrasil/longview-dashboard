/**
 * ENDPOINT TEMPORÁRIO DE AUDITORIA — será removido após análise
 * Audita a conta Meta Ads completa e retorna diagnóstico estruturado.
 */
import { NextResponse } from 'next/server';
import axios from 'axios';

const BASE  = 'https://graph.facebook.com/v21.0';
const TOKEN = process.env.META_TOKEN || '';
const ACT   = process.env.META_ACT_ID || '';
const PAGE  = '259079394232614';
const PIXEL = process.env.META_PIXEL_ID || '';

const p = (extra?: object) => ({ access_token: TOKEN, ...extra });

async function safe<T>(label: string, fn: () => Promise<T>): Promise<{ ok: boolean; data?: T; error?: string }> {
  try { return { ok: true, data: await fn() }; }
  catch (e: any) { return { ok: false, error: e.response?.data?.error?.message || e.message }; }
}

export async function GET() {
  const report: Record<string, any> = { ts: new Date().toISOString() };

  // ── 1. Conta de anúncios ──────────────────────────────────────────────────
  const acct = await safe('account', async () => {
    const r = await axios.get(`${BASE}/${ACT}`, {
      params: p({ fields: 'id,name,account_status,currency,timezone_name,spend_cap,amount_spent,balance,business,disable_reason,min_daily_budget,is_prepay_account,funding_source_details' }),
      timeout: 10000,
    });
    return r.data;
  });
  report.account = acct;

  // ── 2. Campanhas ──────────────────────────────────────────────────────────
  const camps = await safe('campaigns', async () => {
    const r = await axios.get(`${BASE}/${ACT}/campaigns`, {
      params: p({ fields: 'id,name,status,objective,effective_status,daily_budget,lifetime_budget,start_time,stop_time,budget_remaining,spend_cap', limit: 50 }),
      timeout: 10000,
    });
    return r.data?.data || [];
  });
  report.campaigns = camps;

  // ── 3. Ad Sets ────────────────────────────────────────────────────────────
  const adsets = await safe('adsets', async () => {
    const r = await axios.get(`${BASE}/${ACT}/adsets`, {
      params: p({ fields: 'id,name,status,effective_status,targeting,optimization_goal,billing_event,daily_budget,bid_strategy,campaign_id', limit: 50 }),
      timeout: 10000,
    });
    return r.data?.data || [];
  });
  report.adsets = adsets;

  // ── 4. Audiências customizadas ────────────────────────────────────────────
  const audiences = await safe('audiences', async () => {
    const r = await axios.get(`${BASE}/${ACT}/customaudiences`, {
      params: p({ fields: 'id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status,operation_status,time_created,time_updated,retention_days', limit: 100 }),
      timeout: 10000,
    });
    return r.data?.data || [];
  });
  report.audiences = audiences;

  // ── 5. Pixel — qualidade de eventos ──────────────────────────────────────
  const pixelStats = await safe('pixel', async () => {
    const r = await axios.get(`${BASE}/${PIXEL}`, {
      params: p({ fields: 'id,name,code,last_fired_time,is_unavailable,owner_business,data_use_setting,config' }),
      timeout: 10000,
    });
    return r.data;
  });
  report.pixel = pixelStats;

  // ── 5b. Eventos do pixel (últimos 7 dias) ─────────────────────────────────
  const pixelEvents = await safe('pixel_events', async () => {
    const r = await axios.get(`${BASE}/${PIXEL}/stats`, {
      params: p({ aggregation: 'event', start_time: Math.floor(Date.now()/1000) - 7*86400, end_time: Math.floor(Date.now()/1000) }),
      timeout: 10000,
    });
    return r.data?.data || [];
  });
  report.pixel_events = pixelEvents;

  // ── 6. Insights — últimos 30 dias ─────────────────────────────────────────
  const insights = await safe('insights_30d', async () => {
    const r = await axios.get(`${BASE}/${ACT}/insights`, {
      params: p({
        fields: 'impressions,reach,clicks,spend,cpc,cpm,ctr,conversions,cost_per_conversion,frequency,actions,action_values',
        date_preset: 'last_30d',
        level: 'account',
      }),
      timeout: 15000,
    });
    return r.data?.data?.[0] || null;
  });
  report.insights_30d = insights;

  // ── 7. Insights — últimos 7 dias ─────────────────────────────────────────
  const insights7 = await safe('insights_7d', async () => {
    const r = await axios.get(`${BASE}/${ACT}/insights`, {
      params: p({
        fields: 'impressions,reach,clicks,spend,cpc,cpm,ctr,conversions,cost_per_conversion,frequency,actions',
        date_preset: 'last_7d',
        level: 'account',
      }),
      timeout: 15000,
    });
    return r.data?.data?.[0] || null;
  });
  report.insights_7d = insights7;

  // ── 8. Campanhas com insights (top 10 ativas) ─────────────────────────────
  const campInsights = await safe('camp_insights', async () => {
    const activeCamps = (camps.data || [])
      .filter((c: any) => c.effective_status === 'ACTIVE')
      .slice(0, 10);

    const results = await Promise.allSettled(
      activeCamps.map((c: any) =>
        axios.get(`${BASE}/${c.id}/insights`, {
          params: p({ fields: 'impressions,reach,clicks,spend,cpc,ctr,actions,cost_per_action_type', date_preset: 'last_7d' }),
          timeout: 8000,
        }).then(r => ({ id: c.id, name: c.name, objective: c.objective, ...r.data?.data?.[0] }))
      )
    );
    return results.filter(r => r.status === 'fulfilled').map((r: any) => r.value);
  });
  report.camp_insights = campInsights;

  // ── 9. Página Meta ────────────────────────────────────────────────────────
  const page = await safe('page', async () => {
    const r = await axios.get(`${BASE}/${PAGE}`, {
      params: p({ fields: 'id,name,fan_count,verification_status,category,about,is_published,tasks' }),
      timeout: 8000,
    });
    return r.data;
  });
  report.page = page;

  // ── 10. Métodos de pagamento ──────────────────────────────────────────────
  const billing = await safe('billing', async () => {
    const r = await axios.get(`${BASE}/${ACT}/funding_source_details`, {
      params: p(),
      timeout: 8000,
    });
    return r.data;
  });
  report.billing = billing;

  return NextResponse.json(report);
}
