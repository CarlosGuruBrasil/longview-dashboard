import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { getValidRDToken } from '../token/route';
import axios from 'axios';

const RD_BASE = 'https://api.rd.services';

export async function GET(request: NextRequest) {
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const token  = await getValidRDToken() || process.env.RD_TOKEN_PRIVATE;
  const apiKey = process.env.RD_TOKEN_PUBLIC;

  const results: Record<string, any> = {
    _config: {
      kv_token:        !!await getValidRDToken(),
      env_token:       !!process.env.RD_TOKEN_PRIVATE,
      api_key_present: !!apiKey,
      note: 'Prioridade: KV (OAuth2 callback) > RD_TOKEN_PRIVATE (env). Se 401, clique em Autorizar RD Station.',
    },
  };

  if (token) {
    const [fieldsRes, accountRes, segRes] = await Promise.allSettled([
      axios.get(`${RD_BASE}/platform/contacts/fields`, {
        headers: { Authorization: `Bearer ${token}` }, timeout: 15000,
      }),
      axios.get(`${RD_BASE}/platform/account/info`, {
        headers: { Authorization: `Bearer ${token}` }, timeout: 10000,
      }),
      axios.get(`${RD_BASE}/platform/segmentations`, {
        headers: { Authorization: `Bearer ${token}` }, timeout: 10000,
      }),
    ]);

    const toData = (r: any) => r.status === 'fulfilled'
      ? { ok: true, data: r.value.data }
      : { ok: false, error: r.reason?.response?.data || r.reason?.message, status: r.reason?.response?.status };

    results.fields_raw    = toData(fieldsRes);
    results.account       = toData(accountRes);
    results.segmentations = toData(segRes);

    if (results.fields_raw.ok) {
      const all = results.fields_raw.data?.fields || [];
      results.schema = {
        total:    all.length,
        standard: all.filter((f: any) => !f.api_identifier?.startsWith('cf_')),
        custom:   all.filter((f: any) =>  f.api_identifier?.startsWith('cf_')),
      };
    }
  }

  // Testar API Key
  if (apiKey) {
    try {
      const testRes = await axios.post(`${RD_BASE}/platform/events`, {
        event_type: 'CONVERSION', event_family: 'CDP',
        payload: { conversion_identifier: '_ping_test', email: 'ping@longview.internal' },
      }, { params: { api_key: apiKey }, timeout: 10000 });
      results.api_key_status = { ok: true, http: testRes.status };
    } catch (err: any) {
      results.api_key_status = { ok: false, http: err.response?.status, error: err.response?.data || err.message };
    }
  }

  return NextResponse.json(results);
}
