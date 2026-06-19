/**
 * Postgres-backed KV store — substituto drop-in para @vercel/kv.
 * Interface compatível: get, set (com TTL), del, keys (com wildcard *).
 * Usa a tabela kv_store no Postgres.
 */
import { sql, ensureSchema } from './pg';

let tableReady = false;

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
  await sql`CREATE INDEX IF NOT EXISTS kv_store_expires ON kv_store (expires_at) WHERE expires_at IS NOT NULL`;
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
        await sql`DELETE FROM kv_store WHERE key = ${key}`.catch(() => { });
        return null;
      }
      return rows[0].value as T;
    } catch (e) {
      console.error('[kv] get error:', e);
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
          INSERT INTO kv_store (key, value, expires_at) VALUES (${key}, ${jsonValue}, ${expiresAt})
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at
        `;
      } else {
        await sql`
          INSERT INTO kv_store (key, value, expires_at) VALUES (${key}, ${jsonValue}, NULL)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = NULL
        `;
      }
    } catch (e) {
      console.error('[kv] set error:', e);
    }
  },

  async del(key: string): Promise<void> {
    try {
      await ensureTable();
      await sql`DELETE FROM kv_store WHERE key = ${key}`;
    } catch (e) {
      console.error('[kv] del error:', e);
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
      console.error('[kv] keys error:', e);
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
            SET value = 1, expires_at = NULL
            WHERE key = ${key}
          `;
          return 1;
        } else {
          // Incrementa
          const currentVal = typeof value === 'number' ? value : parseInt(String(value), 10) || 0;
          const newVal = currentVal + 1;
          await sql`
            UPDATE kv_store
            SET value = ${newVal}
            WHERE key = ${key}
          `;
          return newVal;
        }
      } else {
        // Não existe
        await sql`
          INSERT INTO kv_store (key, value, expires_at)
          VALUES (${key}, 1, NULL)
          ON CONFLICT (key) DO UPDATE SET value = 1, expires_at = NULL
        `;
        return 1;
      }
    } catch (e) {
      console.error('[kv] incr error:', e);
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
      console.error('[kv] expire error:', e);
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
        await sql`DELETE FROM kv_store WHERE key = ${key}`.catch(() => {});
        return -2;
      }
      return Math.ceil(diffMs / 1000);
    } catch (e) {
      console.error('[kv] ttl error:', e);
      return -2;
    }
  },
};
