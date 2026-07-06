import { kv } from '@/lib/kv';
import logger from '@/lib/logger'

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number; // timestamp em segundos
}

/**
 * Rate limiter usando Vercel KV (Redis).
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
  // Se KV não estiver configurado, libera sem bloquear (ambiente local)
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return { success: true, remaining: limit, reset: Date.now() + windowSecs * 1000 };
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
    // Se Redis falhar, libera a request (fail open) — não bloqueia usuários por erro de infra
    logger.warn({ err }, '[rateLimit] Erro ao consultar KV, liberando request:');
    return { success: true, remaining: limit, reset: Date.now() + windowSecs * 1000 };
  }
}

/**
 * Retorna o IP real do cliente considerando proxies (Vercel/Cloudflare).
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}
