import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, isSecretAuthorized, unauthorizedJson } from '@/lib/internal-auth';

// ponytail: temporary probe to find the valid StatusVerificacoesId with the ConstruPoint
// support team — delete this route once /api/cron/sync-construpoint works end to end.
export const runtime = 'nodejs';

const AUTH_URL = 'https://Authenticate.construpoint.com.br/api/Token';
const BASE_URL = 'https://apiext.construpoint.com.br/api/RelatorioCKL';

async function getToken(): Promise<string> {
  const basicAuth = process.env.CONSTRUPOINT_BASIC_AUTH;
  const username  = process.env.CONSTRUPOINT_USERNAME;
  const password  = process.env.CONSTRUPOINT_PASSWORD;
  if (!basicAuth || !username || !password) throw new Error('Construpoint credentials are not configured.');

  const body = new URLSearchParams({ grant_type: 'password', username, password });
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basicAuth}` },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`auth ${res.status}: ${text}`);
  return (JSON.parse(text) as { access_token: string }).access_token;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret');
  const headerSecret = getBearerToken(request);
  if (
    !isSecretAuthorized(process.env.CRON_SECRET, querySecret) &&
    !isSecretAuthorized(process.env.CRON_SECRET, headerSecret)
  ) {
    return unauthorizedJson();
  }

  const p = url.searchParams;
  const endpoint = p.get('endpoint') ?? 'InspecoesPorModeloCustomQualidade';
  const payload: Record<string, unknown> = {
    BeginDate: p.get('BeginDate') ?? '2025-01-01',
    EndDate: p.get('EndDate') ?? '2025-12-31',
    ModelTypeId: Number(p.get('ModelTypeId') ?? 1),
    HistoricoCompleto: p.get('HistoricoCompleto') === 'true',
    CamposPersonalizados: p.get('CamposPersonalizados') === 'true',
    WorkId: [],
  };
  if (p.has('StatusVerificacoesId')) payload.StatusVerificacoesId = Number(p.get('StatusVerificacoesId'));
  if (p.has('ReviewId')) payload.ReviewId = Number(p.get('ReviewId'));

  try {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    return NextResponse.json({ sentPayload: payload, status: res.status, body: text.slice(0, 2000) });
  } catch (error: unknown) {
    return NextResponse.json({ sentPayload: payload, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
