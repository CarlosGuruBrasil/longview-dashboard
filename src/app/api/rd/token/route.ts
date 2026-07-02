/**
 * GET /api/rd/token
 * Retorna o access_token atual do KV ou faz refresh se expirado
 * Uso interno — chamado pelas outras rotas /api/rd/*
 *
 * POST /api/rd/token/refresh
 * Força refresh manual do access_token via refresh_token
 */
import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { kv } from '@/lib/kv';
import axios from 'axios';

const RD_TOKEN_URL = 'https://api.rd.services/auth/token';

type RDTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
};

export async function getValidRDToken(): Promise<string | null> {
  // 1. Tentar access_token do KV (salvo pelo callback OAuth2)
  const kvToken = await kv.get<string>('rd:access_token');
  if (kvToken) return kvToken;

  // 2. Tentar refresh via refresh_token
  const refreshToken = await kv.get<string>('rd:refresh_token');
  if (!refreshToken) return null;

  const clientId     = process.env.RD_CLIENT_ID;
  const clientSecret = process.env.RD_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await axios.post<RDTokenResponse>(RD_TOKEN_URL, {
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }, { timeout: 15000 });

    const { access_token, refresh_token: newRefresh, expires_in } = res.data;

    await Promise.all([
      kv.set('rd:access_token',  access_token,  { ex: expires_in || 86400 }),
      kv.set('rd:refresh_token', newRefresh,     { ex: 60 * 86400 }),
    ]);

    console.log('[rd/token] Token renovado via refresh_token');
    return access_token;
  } catch (err: unknown) {
    const details = axios.isAxiosError(err) ? err.response?.data || err.message : err;
    console.error('[rd/token] Erro no refresh:', details);
    return null;
  }
}

export async function GET() {
  const admin = await verifyAdminAuth();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const [accessToken, meta] = await Promise.all([
    kv.get<string>('rd:access_token'),
    kv.get<string>('rd:token_meta'),
  ]);

  const clientId = process.env.RD_CLIENT_ID;

  // Gerar URL de autorização para novo fluxo OAuth2
  const redirectUri = process.env.RD_REDIRECT_URI || 'https://app.guru.dev.br/api/rd/callback';
  const authUrl = clientId
    ? `https://api.rd.services/auth/dialog?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`
    : null;

  return NextResponse.json({
    token_presente:  !!accessToken,
    token_expirando: !accessToken,
    meta:            meta ? JSON.parse(meta) : null,
    auth_url:        authUrl,
    env_vars: {
      RD_CLIENT_ID_ok:     !!clientId,
      RD_CLIENT_SECRET_ok: !!process.env.RD_CLIENT_SECRET,
      RD_TOKEN_PUBLIC_ok:  !!process.env.RD_TOKEN_PUBLIC,
    },
    proximos_passos: !clientId
      ? ['Configure RD_CLIENT_ID e RD_CLIENT_SECRET no Coolify']
      : !accessToken
      ? ['Acesse auth_url para autorizar e gerar o access_token']
      : ['Token válido — tudo funcionando'],
  });
}
