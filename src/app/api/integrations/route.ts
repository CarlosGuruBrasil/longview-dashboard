import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { sql, ensureSchema } from '@/lib/pg';
import type { Integration, IntegrationPlatform, IntegrationStatus } from '@/app/marketing-vision/types';

const JWT_SECRET = process.env.JWT_SECRET ?? (() => { throw new Error('[LongView] JWT_SECRET nao configurado. Defina no .env.local') })();
export const runtime = 'nodejs';

type AuthUser = { role?: string; email?: string };

async function verifyAuth(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch { return null; }
}

async function ensureIntegrationsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS integrations (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      platform TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      account_id TEXT,
      account_name TEXT,
      api_key TEXT,
      api_token TEXT,
      extra_config JSONB DEFAULT '{}',
      last_sync TIMESTAMPTZ,
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

// GET /api/integrations — lista integrações salvas + status das conectadas via env
export async function GET() {
  const authUser = await verifyAuth();
  if (!authUser) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  await ensureSchema();
  await ensureIntegrationsTable();

  const rows = await sql<{
    id: string; platform: string; name: string; status: string;
    account_id: string | null; account_name: string | null;
    last_sync: string | null; error_message: string | null;
  }[]>`SELECT id, platform, name, status, account_id, account_name, last_sync, error_message FROM integrations ORDER BY created_at ASC`;

  // Integração da Meta via variáveis de ambiente (sempre presente se configurada)
  const metaToken = process.env.META_ACCESS_TOKEN;
  const metaAccountId = process.env.META_AD_ACCOUNT_ID;
  const cvEmail = process.env.CV_CRM_EMAIL;
  const cvToken = process.env.CV_CRM_TOKEN;

  const envIntegrations: Integration[] = [];

  if (metaToken && metaAccountId) {
    const metaInDb = rows.find(r => r.platform === 'meta');
    if (!metaInDb) {
      envIntegrations.push({
        id: 'env-meta',
        platform: 'meta',
        name: 'Meta Ads (Facebook & Instagram)',
        status: 'connected',
        accountId: metaAccountId,
        accountName: 'Configurada via variável de ambiente',
        lastSync: new Date().toISOString(),
      });
    }
  }

  if (cvEmail && cvToken) {
    const cvInDb = rows.find(r => r.platform === 'cv_crm');
    if (!cvInDb) {
      envIntegrations.push({
        id: 'env-cv',
        platform: 'cv_crm',
        name: 'CV CRM',
        status: 'connected',
        accountName: cvEmail,
        lastSync: new Date().toISOString(),
      });
    }
  }

  const dbIntegrations: Integration[] = rows.map(r => ({
    id: r.id,
    platform: r.platform as IntegrationPlatform,
    name: r.name,
    status: r.status as IntegrationStatus,
    accountId: r.account_id ?? undefined,
    accountName: r.account_name ?? undefined,
    lastSync: r.last_sync ?? undefined,
    errorMessage: r.error_message ?? undefined,
  }));

  return NextResponse.json({ integrations: [...envIntegrations, ...dbIntegrations] });
}

// POST /api/integrations — salva nova integração
export async function POST(request: NextRequest) {
  const authUser = await verifyAuth();
  if (!authUser) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const allowedRoles = ['Desenvolvedor', 'Diretoria', 'Gestor'];
  if (!allowedRoles.includes(authUser.role ?? '')) {
    return NextResponse.json({ error: 'Permissão insuficiente.' }, { status: 403 });
  }

  const body = await request.json() as {
    platform: string; name: string; apiKey?: string; apiToken?: string;
    accountId?: string; accountName?: string;
  };

  await ensureSchema();
  await ensureIntegrationsTable();

  const [row] = await sql<{ id: string }[]>`
    INSERT INTO integrations (platform, name, status, account_id, account_name, api_key, api_token)
    VALUES (
      ${body.platform}, ${body.name}, 'pending',
      ${body.accountId ?? null}, ${body.accountName ?? null},
      ${body.apiKey ?? null}, ${body.apiToken ?? null}
    )
    RETURNING id
  `;

  return NextResponse.json({ ok: true, id: row.id });
}

// DELETE /api/integrations?id=xxx
export async function DELETE(request: NextRequest) {
  const authUser = await verifyAuth();
  if (!authUser) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const allowedRoles = ['Desenvolvedor', 'Diretoria'];
  if (!allowedRoles.includes(authUser.role ?? '')) {
    return NextResponse.json({ error: 'Permissão insuficiente.' }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 });

  await ensureIntegrationsTable();
  await sql`DELETE FROM integrations WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
