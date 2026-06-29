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
let schemaReadyPromise: Promise<void> | null = null;

async function optionalSchemaStep(label: string, step: () => Promise<unknown>): Promise<void> {
  try {
    await step();
  } catch (error) {
    const pgError = error as { code?: string; message?: string };
    if (pgError.code === '42501') {
      console.warn(`[pg] optional schema step skipped (${label}): ${pgError.message}`);
      return;
    }
    throw error;
  }
}

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  if (schemaReadyPromise) return schemaReadyPromise;

  schemaReadyPromise = (async () => {
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

    await optionalSchemaStep('leads_data_cadastro index', () => sql`CREATE INDEX IF NOT EXISTS leads_data_cadastro ON leads (data_cadastro DESC)`);
    await optionalSchemaStep('leads_status index', () => sql`CREATE INDEX IF NOT EXISTS leads_status ON leads (status)`);
    await optionalSchemaStep('leads_empreendimento index', () => sql`CREATE INDEX IF NOT EXISTS leads_empreendimento ON leads (empreendimento)`);

    // Histórico de movimentação de etapa do lead — uma linha por mudança
    await sql`
      CREATE TABLE IF NOT EXISTS lead_stage_history (
        id          BIGSERIAL PRIMARY KEY,
        lead_id     TEXT NOT NULL,
        lead_nome   TEXT,
        de          TEXT,
        para        TEXT NOT NULL,
        autor       TEXT,
        changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        raw         JSONB NOT NULL DEFAULT '{}'
      )
    `;
    await optionalSchemaStep('lead_stage_history_lead index', () => sql`CREATE INDEX IF NOT EXISTS lead_stage_history_lead ON lead_stage_history (lead_id, changed_at DESC)`);

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
    await optionalSchemaStep('fcm_tokens_user_id index', () => sql`CREATE INDEX IF NOT EXISTS fcm_tokens_user_id ON fcm_tokens (user_id)`);
    await optionalSchemaStep('fcm_tokens_user_role index', () => sql`CREATE INDEX IF NOT EXISTS fcm_tokens_user_role ON fcm_tokens (user_role)`);

    // --- Novas tabelas Arquitetura Webhook ---

    await sql`
      CREATE TABLE IF NOT EXISTS construpoint_inspecoes (
        id               BIGINT PRIMARY KEY,
        code             TEXT,
        modelo           TEXT,
        obra             TEXT,
        local            TEXT,
        inspetor         TEXT,
        status           TEXT,
        data_criacao     TIMESTAMPTZ,
        data_agendamento TIMESTAMPTZ,
        data_atualizacao TIMESTAMPTZ,
        nota             NUMERIC,
        raw              JSONB NOT NULL DEFAULT '{}',
        synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS construpoint_verificacoes (
        id_serial        BIGSERIAL PRIMARY KEY,
        codigo           TEXT,
        modelo           TEXT,
        verificacao      TEXT,
        resultado        TEXT,
        obra             TEXT,
        local            TEXT,
        inspetor         TEXT,
        problema         TEXT,
        solucao          TEXT,
        data             TIMESTAMPTZ,
        nota_inspecao    NUMERIC,
        nota_item        NUMERIC,
        raw              JSONB NOT NULL DEFAULT '{}',
        synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS cv_empreendimentos (
        id               BIGINT PRIMARY KEY,
        nome             TEXT,
        situacao         TEXT,
        tipo             TEXT,
        raw              JSONB NOT NULL DEFAULT '{}',
        synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS cv_unidades (
        id                BIGINT PRIMARY KEY,
        id_empreendimento BIGINT REFERENCES cv_empreendimentos(id) ON DELETE CASCADE,
        bloco             TEXT,
        numero            TEXT,
        status            TEXT,
        status_venda      INTEGER,
        valor             NUMERIC,
        metragem          NUMERIC,
        raw               JSONB NOT NULL DEFAULT '{}',
        synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS cv_vendas (
        id                BIGINT PRIMARY KEY,
        id_empreendimento BIGINT,
        id_unidade        BIGINT,
        valor             NUMERIC,
        data_venda        TIMESTAMPTZ,
        status            TEXT,
        raw               JSONB NOT NULL DEFAULT '{}',
        synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_documents (
        id           TEXT PRIMARY KEY,
        user_id      TEXT NOT NULL,
        name         TEXT NOT NULL,
        category     TEXT NOT NULL DEFAULT 'outro',
        url          TEXT NOT NULL,
        content_type TEXT,
        size_bytes   BIGINT,
        expires_at   DATE,
        uploaded_by  TEXT NOT NULL,
        uploaded_at  TIMESTAMPTZ DEFAULT NOW(),
        content_b64  TEXT
      )
    `;
    await optionalSchemaStep('user_documents.content_b64 column', () => sql`ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS content_b64 TEXT`);
    await optionalSchemaStep('user_docs_user_id index', () => sql`CREATE INDEX IF NOT EXISTS user_docs_user_id ON user_documents (user_id)`);

    await sql`
      CREATE TABLE IF NOT EXISTS project_banners (
        project_id   TEXT PRIMARY KEY,
        content_type TEXT NOT NULL DEFAULT 'image/jpeg',
        data         BYTEA NOT NULL,
        updated_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS webhook_errors (
        id         BIGSERIAL PRIMARY KEY,
        source     TEXT NOT NULL,
        payload    JSONB NOT NULL DEFAULT '{}',
        error      TEXT,
        resolved   BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Tabela dedicada de tarefas — substitui o JSONB monolítico
    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id          TEXT PRIMARY KEY,
        project     TEXT NOT NULL DEFAULT '',
        data        JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await optionalSchemaStep('tasks project index',     () => sql`CREATE INDEX IF NOT EXISTS tasks_project_idx     ON tasks (project)`);
    await optionalSchemaStep('tasks status index',      () => sql`CREATE INDEX IF NOT EXISTS tasks_status_idx      ON tasks ((data->>'statusAndamento'))`);
    await optionalSchemaStep('tasks responsible index', () => sql`CREATE INDEX IF NOT EXISTS tasks_responsible_idx ON tasks ((data->>'responsible'))`);

    // Anexos de tarefas em binário (BYTEA) — sem base64
    await sql`
      CREATE TABLE IF NOT EXISTS task_documents (
        id           TEXT PRIMARY KEY,
        task_id      TEXT NOT NULL,
        name         TEXT NOT NULL,
        category     TEXT NOT NULL DEFAULT 'outro',
        content_type TEXT,
        size_bytes   BIGINT,
        data         BYTEA NOT NULL,
        uploaded_by  TEXT NOT NULL DEFAULT 'Sistema',
        uploaded_at  TIMESTAMPTZ DEFAULT NOW(),
        version      INT DEFAULT 1
      )
    `;
    await optionalSchemaStep('task_docs task_id index', () => sql`CREATE INDEX IF NOT EXISTS task_docs_task_idx ON task_documents (task_id)`);

    schemaReady = true;
  })();

  try {
    await schemaReadyPromise;
  } catch (error) {
    schemaReadyPromise = null;
    throw error;
  }
}
