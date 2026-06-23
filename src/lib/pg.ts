import postgres from 'postgres';

declare global {
  // eslint-disable-next-line no-var
  var _pg: postgres.Sql | undefined;
}

function getClient(): postgres.Sql {
  if (global._pg) return global._pg;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não configurada');
  // ponytail: reuse pool across hot-reload in dev
  global._pg = postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });
  return global._pg;
}

// Lazy proxy — safe to import at module level; only throws when actually called
export const sql: postgres.Sql = new Proxy(
  ((...args: Parameters<postgres.Sql>) => (getClient() as unknown as (...a: typeof args) => unknown)(...args)) as unknown as postgres.Sql,
  { get: (_t, prop) => (getClient() as any)[prop] }
);

let schemaReady = false;

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;

  await sql`
    CREATE TABLE IF NOT EXISTS app_users (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name          TEXT NOT NULL DEFAULT '',
      role          TEXT NOT NULL DEFAULT 'Usuário',
      permissions   JSONB NOT NULL DEFAULT '{}',
      data          JSONB NOT NULL DEFAULT '{}',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS project_state (
      key   TEXT PRIMARY KEY,
      data  JSONB NOT NULL DEFAULT '{}'
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS short_links (
      slug        TEXT PRIMARY KEY,
      url         TEXT NOT NULL,
      title       TEXT NOT NULL DEFAULT '',
      active      BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by  TEXT NOT NULL DEFAULT ''
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS link_clicks (
      slug   TEXT PRIMARY KEY,
      count  BIGINT NOT NULL DEFAULT 0
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id               TEXT PRIMARY KEY,
      nome             TEXT,
      email            TEXT,
      telefone         TEXT,
      origem           TEXT,
      status           TEXT,
      empreendimento   TEXT,
      score            INTEGER,
      temperatura      TEXT,
      data_cadastro    TIMESTAMPTZ,
      data_atualizacao TIMESTAMPTZ,
      raw              JSONB NOT NULL DEFAULT '{}',
      synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS leads_data_cadastro ON leads (data_cadastro DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS leads_status ON leads (status)`;
  await sql`CREATE INDEX IF NOT EXISTS leads_empreendimento ON leads (empreendimento)`;

  // FCM push notification tokens — um registro por usuário/dispositivo
  await sql`
    CREATE TABLE IF NOT EXISTS fcm_tokens (
      id         BIGSERIAL PRIMARY KEY,
      user_id    TEXT NOT NULL,
      user_email TEXT NOT NULL,
      user_role  TEXT NOT NULL DEFAULT '',
      token      TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS fcm_tokens_user_id ON fcm_tokens (user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS fcm_tokens_user_role ON fcm_tokens (user_role)`;

  schemaReady = true;
}
