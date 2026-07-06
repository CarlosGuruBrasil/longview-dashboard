/**
 * GET /api/rd/callback
 * Receptor do código OAuth2 do RD Station
 * O RD redireciona aqui com ?code=XXXX após autorização
 * Troca o code por access_token + refresh_token e salva no KV
 */
import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import axios from 'axios';
import logger from '@/lib/logger'

const RD_TOKEN_URL = 'https://api.rd.services/auth/token';

type RDTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get('code');
  const error = searchParams.get('error');

  // Erro do RD Station
  if (error) {
    return NextResponse.redirect(
      new URL(`/marketing-vision?rd_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.json({ error: 'code ausente na query string' }, { status: 400 });
  }

  const clientId     = process.env.RD_CLIENT_ID;
  const clientSecret = process.env.RD_CLIENT_SECRET;
  const redirectUri  = process.env.RD_REDIRECT_URI || 'https://app.guru.dev.br/api/rd/callback';

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'RD_CLIENT_ID ou RD_CLIENT_SECRET não configurados no Coolify' },
      { status: 500 }
    );
  }

  try {
    // Trocar code por tokens
    const res = await axios.post<RDTokenResponse>(RD_TOKEN_URL, {
      client_id:     clientId,
      client_secret: clientSecret,
      code,
      redirect_uri:  redirectUri,
    }, { timeout: 15000 });

    const { access_token, refresh_token, expires_in } = res.data;

    // Salvar tokens no KV para uso pelo sistema
    const expiresAt = Date.now() + (expires_in || 86400) * 1000;
    await Promise.all([
      kv.set('rd:access_token',  access_token,  { ex: expires_in || 86400 }),
      kv.set('rd:refresh_token', refresh_token, { ex: 60 * 86400 }), // 60 dias
      kv.set('rd:token_meta', JSON.stringify({
        saved_at:   new Date().toISOString(),
        expires_at: new Date(expiresAt).toISOString(),
        expires_in,
      }), { ex: expires_in || 86400 }),
    ]);

    logger.info('[rd/callback] Tokens OAuth2 salvos com sucesso no KV');

    // Redirecionar de volta ao dashboard com sucesso
    return NextResponse.redirect(
      new URL('/marketing-vision?rd_auth=success', request.url)
    );
  } catch (err: unknown) {
    const detailRaw = axios.isAxiosError(err) ? err.response?.data || err.message : err instanceof Error ? err.message : String(err);
    logger.error({ detailRaw }, '[rd/callback] Erro ao trocar code:');
    const detail = encodeURIComponent(
      JSON.stringify(detailRaw)
    );
    return NextResponse.redirect(
      new URL(`/marketing-vision?rd_error=${detail}`, request.url)
    );
  }
}
