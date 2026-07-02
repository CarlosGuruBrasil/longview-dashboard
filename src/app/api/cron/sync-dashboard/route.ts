import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { isCronAuthorized, unauthorizedJson } from '@/lib/internal-auth';

const META_API_VERSION = 'v21.0';
const META_PAGE_ID     = '259079394232614';

type ApiListResponse = {
  data?: unknown[];
};

type ProjectResponse = {
  idempreendimento?: string | number;
};

function isId(value: string | number | undefined): value is string | number {
  return Boolean(value);
}

function settledData(result: PromiseSettledResult<unknown>): unknown {
  return result.status === 'fulfilled' && result.value && typeof result.value === 'object'
    ? (result.value as { data?: unknown }).data ?? null
    : null;
}

function listData(value: unknown): unknown[] {
  return value && typeof value === 'object' && Array.isArray((value as ApiListResponse).data)
    ? (value as ApiListResponse).data ?? []
    : [];
}

function errorMessage(error: unknown): string {
  return axios.isAxiosError(error) ? error.message : error instanceof Error ? error.message : String(error);
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return unauthorizedJson();

  const META_TOKEN  = process.env.META_TOKEN!;
  const META_ACT_ID = process.env.META_ACT_ID!;
  const CV_EMAIL    = process.env.CV_CRM_EMAIL!;
  const CV_TOKEN    = process.env.CV_CRM_TOKEN!;

  const { sql, ensureSchema } = await import('@/lib/pg');
  await ensureSchema();

  const errors: string[] = [];

  // ---------- META ----------
  try {
    const metaBase = `https://graph.facebook.com/${META_API_VERSION}/${META_ACT_ID}`;
    const auth     = { access_token: META_TOKEN };
    const params   = { date_preset: 'maximum' };

    const [global, camps, campDetails, adsets, demo, region, platform, device, daily, monthly, forms, page] =
      await Promise.allSettled([
        axios.get(`${metaBase}/insights`, { params: { level: 'account', fields: 'spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,cpp,actions,cost_per_action_type', ...params, ...auth }, timeout: 20000 }),
        axios.get(`${metaBase}/insights`, { params: { level: 'campaign', fields: 'campaign_id,campaign_name,spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,actions,cost_per_action_type,date_start,date_stop', ...params, limit: 500, ...auth }, timeout: 20000 }),
        axios.get(`${metaBase}/campaigns`, { params: { fields: 'id,name,created_time,start_time,stop_time,status,objective,buying_type,daily_budget,lifetime_budget,spend_cap', limit: 1000, ...auth }, timeout: 20000 }),
        axios.get(`${metaBase}/insights`, { params: { level: 'adset', fields: 'campaign_id,campaign_name,adset_id,adset_name,spend,impressions,clicks,reach,cpc,cpm,ctr,actions,cost_per_action_type', ...params, limit: 500, ...auth }, timeout: 20000 }),
        axios.get(`${metaBase}/insights`, { params: { level: 'account', fields: 'clicks,impressions,spend,reach', breakdowns: 'gender,age', ...params, ...auth }, timeout: 20000 }),
        axios.get(`${metaBase}/insights`, { params: { level: 'account', fields: 'clicks,impressions,spend,reach', breakdowns: 'region', ...params, ...auth }, timeout: 20000 }),
        axios.get(`${metaBase}/insights`, { params: { level: 'account', fields: 'clicks,impressions,spend,reach,actions', breakdowns: 'publisher_platform', ...params, ...auth }, timeout: 20000 }),
        axios.get(`${metaBase}/insights`, { params: { level: 'account', fields: 'clicks,impressions,spend,reach', breakdowns: 'device_platform', ...params, ...auth }, timeout: 20000 }),
        axios.get(`${metaBase}/insights`, { params: { level: 'account', fields: 'spend,impressions,clicks,reach,actions', time_increment: 1, date_preset: 'last_90d', limit: 90, ...auth }, timeout: 20000 }),
        axios.get(`${metaBase}/insights`, { params: { level: 'account', fields: 'spend,impressions,clicks,reach,actions', time_increment: 'monthly', date_preset: 'maximum', limit: 60, ...auth }, timeout: 20000 }),
        axios.get(`https://graph.facebook.com/${META_API_VERSION}/${META_PAGE_ID}/leadgen_forms`, { params: { fields: 'id,name,status,leads_count,created_time', limit: 50, ...auth }, timeout: 15000 }),
        axios.get(`https://graph.facebook.com/${META_API_VERSION}/${META_PAGE_ID}`, { params: { fields: 'id,name,fan_count,followers_count,instagram_business_account', ...auth }, timeout: 10000 }),
      ]);

    const get = settledData;

    const metaData = {
      global:          listData(get(global))[0] ?? null,
      campaigns:       listData(get(camps)),
      campaignDetails: listData(get(campDetails)),
      adsets:          listData(get(adsets)),
      demographics:    listData(get(demo)),
      regions:         listData(get(region)),
      platforms:       listData(get(platform)),
      devices:         listData(get(device)),
      daily:           listData(get(daily)),
      monthly:         listData(get(monthly)),
      leadForms:       listData(get(forms)),
      page:            get(page) ?? null,
    };

    await sql`
      INSERT INTO project_state (key, data) VALUES ('meta_cache', ${JSON.stringify({ data: metaData, updatedAt: new Date().toISOString() })})
      ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data
    `;
    console.log('[sync-dashboard] Meta cache atualizado');
  } catch (e: unknown) {
    errors.push('meta: ' + errorMessage(e));
  }

  // ---------- ESTOQUE ----------
  try {
    const headers = { email: CV_EMAIL, token: CV_TOKEN, Accept: 'application/json' };
    const projRes = await axios.get(
      'https://longviewempreendimentos.cvcrm.com.br/api/v1/cadastros/empreendimentos',
      { headers, timeout: 15000 }
    );
    const projects = Array.isArray(projRes.data) ? projRes.data as ProjectResponse[] : [];
    const ids = projects.map((p) => p.idempreendimento).filter(isId);

    const estoqueResults = await Promise.allSettled(
      ids.map((id) => {
        const idText = String(id);
        return (
        axios.get(`https://longviewempreendimentos.cvcrm.com.br/api/v1/cadastros/empreendimentos/${id}`,
          { params: { limite_dados_unidade: 1000 }, headers, timeout: 15000 }
        ).then(r => ({ id: idText, data: r.data }))
        );
      })
    );

    const estoqueMap: Record<string, unknown> = {};
    estoqueResults.forEach((r) => {
      if (r.status === 'fulfilled') estoqueMap[r.value.id] = r.value.data;
    });

    await sql`
      INSERT INTO project_state (key, data) VALUES ('estoque_cache', ${JSON.stringify({ projects, estoque: estoqueMap, updatedAt: new Date().toISOString() })})
      ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data
    `;
    console.log('[sync-dashboard] Estoque cache atualizado');
  } catch (e: unknown) {
    errors.push('estoque: ' + errorMessage(e));
  }

  return NextResponse.json({ ok: true, errors, updatedAt: new Date().toISOString() });
}
