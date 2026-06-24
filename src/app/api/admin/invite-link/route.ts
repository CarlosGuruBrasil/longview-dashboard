import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { readKv, writeKv } from '@/lib/db-kv';
import crypto from 'crypto';

export interface InviteToken {
  token: string;
  generatedAt: string;
  generatedBy: string;
}

/** GET /api/admin/invite-link — retorna o token de convite atual */
export async function GET() {
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const invite = await readKv<InviteToken | null>('invite_token', null);
  return NextResponse.json({ invite });
}

/** POST /api/admin/invite-link — gera / rotaciona o token */
export async function POST() {
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const invite: InviteToken = {
    token:       crypto.randomBytes(24).toString('hex'),
    generatedAt: new Date().toISOString(),
    generatedBy: admin.name,
  };

  await writeKv('invite_token', invite);
  return NextResponse.json({ invite });
}
