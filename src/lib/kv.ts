/**
 * Postgres-backed KV store — substituto drop-in para @vercel/kv.
 * Interface compatível: get, set (com TTL), del, keys (com wildcard *).
 * Usa a tabela kv_store no Postgres.
 */
import { sql, ensureSchema } from './pg';
import logger from '@/lib/logger'

let tableReady = false;

async function optionalKvSchemaStep(label: string, step: () => Promise<unknown>): Promise<void> {
  try {
    await step();
  } catch (error) {
    const pgError = error as { code?: string; message?: string };
    if (pgError.code === '42501') {
      logger.warn(`[kv] optional schema step skipped ($): $`);
      return;
    }
    throw error;
  }
}

async function ensureTable() {
  if (tableReady) return;
  await ensureSchema(); // garante que o schema base existe
  await sql`
    CREATE TABLE IF NOT EXISTS kv_store (
      key        TEXT PRIMARY KEY,
      value      JSONB NOT NULL,
      expires_at TIMESTAMPTZ
    )
  `;
  await optionalKvSchemaStep('kv_store_expires index', () => sql`CREATE INDEX IF NOT EXISTS kv_store_expires ON kv_store (expires_at) WHERE expires_at IS NOT NULL`);
  tableReady = true;
}

export const kv = {
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      await ensureTable();
      const rows = await sql<{ value: T; expires_at: string | null }[]>`
        SELECT value, expires_at FROM kv_store WHERE key = ${key} LIMIT 1
      `;
      if (!rows[0]) return null;
      if (rows[0].expires_at && new Date(rows[0].expires_at) < new Date()) {
        // Expirado — limpa e retorna null
        await sql`DELETE FROM kv_store WHERE key = ${key}`.catch(() => logger.warn('[kv] erro ao deletar chave expirada'));
        return null;
      }
      const value = rows[0].value;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      }
      return value as T;
    } catch (e) {
      logger.error({ e }, '[kv] get error:');
      return null;
    }
  },

  async set(
    key: string,
    value: unknown,
    options?: { ex?: number; px?: number }
  ): Promise<void> {
    try {
      await ensureTable();
      let expiresAt: string | null = null;
      if (options?.ex) {
        expiresAt = new Date(Date.now() + options.ex * 1000).toISOString();
      } else if (options?.px) {
        expiresAt = new Date(Date.now() + options.px).toISOString();
      }
      const jsonValue = JSON.stringify(value);
      if (expiresAt) {
        await sql`
          INSERT INTO kv_store (key, value, expires_at) VALUES (${key}, ${jsonValue}::jsonb, ${expiresAt})
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at
        `;
      } else {
        await sql`
          INSERT INTO kv_store (key, value, expires_at) VALUES (${key}, ${jsonValue}::jsonb, NULL)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = NULL
        `;
      }
    } catch (e) {
      logger.error({ e }, '[kv] set error:');
    }
  },

  async del(key: string): Promise<void> {
    try {
      await ensureTable();
      await sql`DELETE FROM kv_store WHERE key = ${key}`;
    } catch (e) {
      logger.error({ e }, '[kv] del error:');
    }
  },

  /** Suporta wildcard * → converte para LIKE com % */
  async keys(pattern: string): Promise<string[]> {
    try {
      await ensureTable();
      const likePattern = pattern.replace(/\*/g, '%');
      const now = new Date().toISOString();
      const rows = await sql<{ key: string }[]>`
        SELECT key FROM kv_store
        WHERE key LIKE ${likePattern}
          AND (expires_at IS NULL OR expires_at > ${now})
        ORDER BY key
      `;
      return rows.map(r => r.key);
    } catch (e) {
      logger.error({ e }, '[kv] keys error:');
      return [];
    }
  },

  /** Limpa entradas expiradas (chamar periodicamente num cron) */
  async purgeExpired(): Promise<number> {
    try {
      await ensureTable();
      const result = await sql`DELETE FROM kv_store WHERE expires_at < NOW()`;
      return (result as unknown as { count: number }).count ?? 0;
    } catch {
      logger.warn('[kv] purgeExpired falhou');
      return 0;
    }
  },

  async incr(key: string): Promise<number> {
    try {
      await ensureTable();
      const now = new Date();
      const rows = await sql<{ value: unknown; expires_at: string | null }[]>`
        SELECT value, expires_at FROM kv_store WHERE key = ${key} FOR UPDATE
      `;
      if (rows[0]) {
        const { value, expires_at } = rows[0];
        if (expires_at && new Date(expires_at) < now) {
          // Expirado - reinicia para 1
          await sql`
            UPDATE kv_store
            SET value = ${JSON.stringify(1)}::jsonb, expires_at = NULL
            WHERE key = ${key}
          `;
          return 1;
        } else {
          // Incrementa
          const currentVal = typeof value === 'number' ? value : parseInt(String(value), 10) || 0;
          const newVal = currentVal + 1;
          await sql`
            UPDATE kv_store
            SET value = ${JSON.stringify(newVal)}::jsonb
            WHERE key = ${key}
          `;
          return newVal;
        }
      } else {
        // Não existe
        await sql`
          INSERT INTO kv_store (key, value, expires_at)
          VALUES (${key}, ${JSON.stringify(1)}::jsonb, NULL)
          ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(1)}::jsonb, expires_at = NULL
        `;
        return 1;
      }
    } catch (e) {
      logger.error({ e }, '[kv] incr error:');
      throw e;
    }
  },

  async expire(key: string, seconds: number): Promise<number> {
    try {
      await ensureTable();
      const expiresAt = new Date(Date.now() + seconds * 1000).toISOString();
      const result = await sql`
        UPDATE kv_store
        SET expires_at = ${expiresAt}
        WHERE key = ${key} AND (expires_at IS NULL OR expires_at > NOW())
      `;
      return (result as unknown as { count: number }).count > 0 ? 1 : 0;
    } catch (e) {
      logger.error({ e }, '[kv] expire error:');
      return 0;
    }
  },

  async ttl(key: string): Promise<number> {
    try {
      await ensureTable();
      const rows = await sql<{ expires_at: string | null }[]>`
        SELECT expires_at FROM kv_store WHERE key = ${key} LIMIT 1
      `;
      if (!rows[0]) return -2;
      const { expires_at } = rows[0];
      if (!expires_at) return -1;
      const diffMs = new Date(expires_at).getTime() - Date.now();
      if (diffMs < 0) {
        // Já expirou
        await sql`DELETE FROM kv_store WHERE key = ${key}`.catch(() => logger.warn('[kv] erro ao deletar chave expirada em ttl'));
        return -2;
      }
      return Math.ceil(diffMs / 1000);
    } catch (e) {
      logger.error({ e }, '[kv] ttl error:');
      return -2;
    }
  },
};
