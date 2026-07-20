import { kv } from '@/lib/kv';
import logger from '@/lib/logger'

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number; // timestamp em segundos
}

/**
 * Rate limiter usando Postgres KV.
 * Usa janela deslizante simples com contador de incremento.
 *
 * @param identifier - IP ou userId do requisitante
 * @param limit      - Número máximo de requests por janela (default: 60)
 * @param windowSecs - Janela em segundos (default: 60)
 */
export async function rateLimit(
  identifier: string,
  limit = 60,
  windowSecs = 60
): Promise<RateLimitResult> {
  // Em produção usamos o KV em Postgres; sem DATABASE_URL, libera no ambiente local.
  if (!process.env.DATABASE_URL) {
    return {
      success: true,
      remaining: limit,
      reset: Math.floor(Date.now() / 1000) + windowSecs,
    };
  }

  const key = `rl:${identifier}`;

  try {
    const current = await kv.incr(key);

    // Na primeira chamada, define o TTL da janela
    if (current === 1) {
      await kv.expire(key, windowSecs);
    }

    const ttl = await kv.ttl(key);
    const reset = Math.floor(Date.now() / 1000) + (ttl > 0 ? ttl : windowSecs);
    const remaining = Math.max(0, limit - current);

    return {
      success: current <= limit,
      remaining,
      reset,
    };
  } catch (err) {
    // Se o KV falhar, libera a request (fail open) para não derrubar o app por erro de infra.
    logger.warn({ err }, '[rateLimit] Erro ao consultar KV, liberando request:');
    return {
      success: true,
      remaining: limit,
      reset: Math.floor(Date.now() / 1000) + windowSecs,
    };
  }
}

/**
 * Retorna o IP real do cliente considerando proxies (Cloudflare).
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}
