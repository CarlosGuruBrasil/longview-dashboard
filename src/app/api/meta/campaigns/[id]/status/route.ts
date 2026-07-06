import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-longview-key';
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || '';
const META_API_VERSION = 'v19.0';

type AuthUser = { role?: string; email?: string };

async function verifyAuth(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch { return null; }
}

// PATCH /api/meta/campaigns/[id]/status
// Body: { status: 'ACTIVE' | 'PAUSED' }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await verifyAuth();
  if (!authUser) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const allowedRoles = ['Desenvolvedor', 'Gestor', 'Diretoria'];
  if (!allowedRoles.includes(authUser.role ?? '')) {
    return NextResponse.json({ error: 'Permissão insuficiente para alterar campanhas.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json() as { status?: string };
  const newStatus = body.status;

  if (!newStatus || !['ACTIVE', 'PAUSED'].includes(newStatus)) {
    return NextResponse.json({ error: 'Status inválido. Use ACTIVE ou PAUSED.' }, { status: 400 });
  }

  if (!META_ACCESS_TOKEN) {
    return NextResponse.json({ error: 'Token da Meta não configurado.' }, { status: 500 });
  }

  try {
    const url = `https://graph.facebook.com/${META_API_VERSION}/${id}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        access_token: META_ACCESS_TOKEN,
      }),
    });

    const data = await res.json() as { success?: boolean; error?: { message: string } };

    if (!res.ok || !data.success) {
      const msg = data.error?.message ?? 'Erro desconhecido da Meta API';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      campaignId: id,
      newStatus,
      message: `Campanha ${newStatus === 'ACTIVE' ? 'ativada' : 'pausada'} com sucesso.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[meta/campaigns/status]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
