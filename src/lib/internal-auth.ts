import { NextResponse } from 'next/server';

export function getBearerToken(request: Request): string {
  return request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
}

export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return getBearerToken(request) === secret;
}

export function unauthorizedJson(message = 'Não autorizado') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function isSecretAuthorized(secret: string | undefined, incoming: string | null | undefined): boolean {
  if (!secret) return false;
  return (incoming ?? '').trim() === secret;
}
