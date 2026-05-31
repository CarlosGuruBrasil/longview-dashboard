import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import axios from 'axios';

const RD_BASE = 'https://api.rd.services';

export async function GET(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const token = process.env.RD_TOKEN_PRIVATE;
  if (!token) return NextResponse.json({ error: 'RD_TOKEN_PRIVATE não configurado' }, { status: 500 });

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
  } catch (err: any) {
    return NextResponse.json({ error: err.response?.data || err.message }, { status: err.response?.status || 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const token = process.env.RD_TOKEN_PRIVATE;
  if (!token) return NextResponse.json({ error: 'RD_TOKEN_PRIVATE não configurado' }, { status: 500 });

  const body = await request.json();
  const { email, uuid, ...fields } = body;
  if (!email && !uuid) return NextResponse.json({ error: 'email ou uuid obrigatório' }, { status: 400 });

  try {
    const endpoint = uuid
      ? `${RD_BASE}/platform/contacts/uuid:${uuid}`
      : `${RD_BASE}/platform/contacts/email:${encodeURIComponent(email)}`;
    const res = await axios.patch(endpoint, fields, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 15000,
    });
    return NextResponse.json(res.data);
  } catch (err: any) {
    return NextResponse.json({ error: err.response?.data || err.message }, { status: err.response?.status || 500 });
  }
}
