import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getValidRDToken } from '../token/route';
import axios from 'axios';

const RD_BASE = 'https://api.rd.services';

type ContactPatchBody = Record<string, unknown> & {
  email?: string;
  uuid?: string;
};

async function getToken() {
  return (await getValidRDToken()) || process.env.RD_TOKEN_PRIVATE || null;
}

function axiosError(err: unknown): { error: unknown; status: number } {
  return axios.isAxiosError(err)
    ? { error: err.response?.data || err.message, status: err.response?.status || 500 }
    : { error: err instanceof Error ? err.message : String(err), status: 500 };
}

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const token = await getToken();
  if (!token) return NextResponse.json({ error: 'Token RD Station não configurado. Acesse /api/rd/token para autorizar.' }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  const uuid  = searchParams.get('uuid');
  if (!email && !uuid) return NextResponse.json({ error: 'Informe email ou uuid' }, { status: 400 });

  try {
    const endpoint = uuid
      ? `${RD_BASE}/platform/contacts/uuid:${uuid}`
      : `${RD_BASE}/platform/contacts/email:${encodeURIComponent(email!)}`;
    const res = await axios.get(endpoint, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });
    return NextResponse.json(res.data);
  } catch (err: unknown) {
    const { error, status } = axiosError(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const token = await getToken();
  if (!token) return NextResponse.json({ error: 'Token RD Station não configurado.' }, { status: 500 });

  const body = await request.json() as ContactPatchBody;
  const { email, uuid, ...fields } = body;
  if (!email && !uuid) return NextResponse.json({ error: 'email ou uuid obrigatório' }, { status: 400 });

  try {
    const endpoint = uuid
      ? `${RD_BASE}/platform/contacts/uuid:${uuid}`
      : `${RD_BASE}/platform/contacts/email:${encodeURIComponent(email ?? '')}`;
    const res = await axios.patch(endpoint, fields, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 15000,
    });
    return NextResponse.json(res.data);
  } catch (err: unknown) {
    const { error, status } = axiosError(err);
    return NextResponse.json({ error }, { status });
  }
}
