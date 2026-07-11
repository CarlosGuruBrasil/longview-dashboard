import postgres from 'postgres';
import logger from '@/lib/logger'

declare global {
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
  { get: (_t, prop) => Reflect.get(getClient(), prop) }
);

let schemaReady = false;
let schemaReadyPromise: Promise<void> | null = null;

async function optionalSchemaStep(label: string, step: () => Promise<unknown>): Promise<void> {
  try {
    await step();
  } catch (error) {
    const pgError = error as { code?: string; message?: string };
    if (pgError.code === '42501') {
      logger.warn(`[pg] optional schema step skipped ($): $`);
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
        override_modelo  TEXT,
        obra             TEXT,
        override_obra    TEXT,
        local            TEXT,
        override_local   TEXT,
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
      CREATE TABLE IF NOT EXISTS construpoint_inspecoes_overrides (
        inspection_id BIGINT PRIMARY KEY,
        override_modelo TEXT,
        override_obra TEXT,
        override_local TEXT
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

    // De-para modelo → disciplina (0-TERRENO … 9-IMPERMEABILIZAÇÕES) — classificação manual,
    // não vem da API do Construpoint. Seed inicial por pattern-matching (ver docs/QUALITY-VISION-BI.md).
    await sql`
      CREATE TABLE IF NOT EXISTS construpoint_disciplinas (
        modelo     TEXT PRIMARY KEY,
        disciplina TEXT
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS quality_scopes (
        id         TEXT PRIMARY KEY,
        nome       TEXT NOT NULL,
        tipo       TEXT NOT NULL CHECK (tipo IN ('corporate', 'development')),
        ativo      BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      INSERT INTO quality_scopes (id, nome, tipo) VALUES
        ('longview', 'LongView', 'corporate'),
        ('nautic', 'Nautic', 'development'),
        ('hub-beira-mar', 'Hub Beira-Mar', 'development')
      ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, tipo = EXCLUDED.tipo
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS quality_inspection_scopes (
        inspection_id BIGINT NOT NULL REFERENCES construpoint_inspecoes(id) ON DELETE CASCADE,
        scope_id       TEXT NOT NULL REFERENCES quality_scopes(id),
        source         TEXT NOT NULL CHECK (source IN ('automatic', 'manual')),
        classified_by  TEXT,
        classified_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (inspection_id, scope_id)
      )
    `;

    await optionalSchemaStep('construpoint inspection code index', () => sql`CREATE INDEX IF NOT EXISTS construpoint_inspecoes_code_idx ON construpoint_inspecoes (code)`);
    await optionalSchemaStep('construpoint inspection filters index', () => sql`CREATE INDEX IF NOT EXISTS construpoint_inspecoes_filters_idx ON construpoint_inspecoes (obra, status, modelo)`);
    await optionalSchemaStep('construpoint inspection date index', () => sql`CREATE INDEX IF NOT EXISTS construpoint_inspecoes_date_idx ON construpoint_inspecoes (data_agendamento DESC)`);
    await optionalSchemaStep('construpoint verification code index', () => sql`CREATE INDEX IF NOT EXISTS construpoint_verificacoes_codigo_idx ON construpoint_verificacoes (codigo)`);
    await optionalSchemaStep('construpoint verification filters index', () => sql`CREATE INDEX IF NOT EXISTS construpoint_verificacoes_filters_idx ON construpoint_verificacoes (obra, resultado, modelo)`);
    await optionalSchemaStep('construpoint verification date index', () => sql`CREATE INDEX IF NOT EXISTS construpoint_verificacoes_data_idx ON construpoint_verificacoes (data DESC)`);
    await optionalSchemaStep('quality scope reverse index', () => sql`CREATE INDEX IF NOT EXISTS quality_inspection_scopes_scope_idx ON quality_inspection_scopes (scope_id, inspection_id)`);

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
      CREATE TABLE IF NOT EXISTS cv_empreendimento_images (
        id_empreendimento BIGINT PRIMARY KEY,
        content_type      TEXT NOT NULL DEFAULT 'image/jpeg',
        data              BYTEA NOT NULL,
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS cv_materiais (
        id                TEXT PRIMARY KEY,
        id_empreendimento BIGINT NOT NULL,
        nome              TEXT NOT NULL,
        tipo              TEXT NOT NULL DEFAULT 'outro',
        content_type      TEXT,
        size_bytes        BIGINT,
        data              BYTEA NOT NULL,
        uploaded_by       TEXT NOT NULL DEFAULT 'Sistema',
        created_at        TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await optionalSchemaStep('cv_materiais emp index', () => sql`CREATE INDEX IF NOT EXISTS cv_materiais_emp ON cv_materiais (id_empreendimento)`);

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
        andar             INTEGER,
        coluna            INTEGER,
        tipologia         TEXT,
        raw               JSONB NOT NULL DEFAULT '{}',
        synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await optionalSchemaStep('cv_unidades andar col', () => sql`ALTER TABLE cv_unidades ADD COLUMN IF NOT EXISTS andar INTEGER`);
    await optionalSchemaStep('cv_unidades coluna col', () => sql`ALTER TABLE cv_unidades ADD COLUMN IF NOT EXISTS coluna INTEGER`);
    await optionalSchemaStep('cv_unidades tipologia col', () => sql`ALTER TABLE cv_unidades ADD COLUMN IF NOT EXISTS tipologia TEXT`);

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

    // ═══════════════════════════════════════════════════════════════
    // BI Star Schema — Dimensões e Fatos para Analytics
    // ═══════════════════════════════════════════════════════════════

    await sql`
      CREATE TABLE IF NOT EXISTS dim_tempo (
        id_data        INTEGER PRIMARY KEY,
        data           DATE NOT NULL,
        dia            INTEGER NOT NULL,
        mes            INTEGER NOT NULL,
        ano            INTEGER NOT NULL,
        nome_mes       TEXT NOT NULL,
        trimestre      INTEGER NOT NULL,
        dia_semana     INTEGER NOT NULL,
        nome_dia_semana TEXT NOT NULL,
        fim_de_semana  BOOLEAN NOT NULL DEFAULT false
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS dim_empreendimentos (
        id_empreendimento INTEGER PRIMARY KEY,
        nome              TEXT,
        situacao          TEXT,
        tipo              TEXT,
        cidade            TEXT,
        estado            TEXT,
        regiao            TEXT,
        segmento          TEXT,
        situacao_obra     TEXT,
        ativo             BOOLEAN DEFAULT true
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS dim_corretores (
        id_corretor  SERIAL PRIMARY KEY,
        nome         TEXT,
        email        TEXT,
        imobiliaria  TEXT,
        ativo        BOOLEAN DEFAULT true
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS dim_clientes (
        id_cliente   SERIAL PRIMARY KEY,
        nome         TEXT,
        email        TEXT,
        telefone     TEXT,
        cidade       TEXT,
        renda        NUMERIC,
        sexo         TEXT,
        idade        INTEGER,
        estado_civil TEXT
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS dim_campanhas_meta (
        id_campanha  TEXT PRIMARY KEY,
        nome         TEXT,
        objective    TEXT,
        status       TEXT,
        buying_type  TEXT,
        created_time TIMESTAMPTZ
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS fato_leads (
        id                  BIGSERIAL PRIMARY KEY,
        id_lead             TEXT,
        id_empreendimento   INTEGER,
        id_corretor         INTEGER,
        id_cliente          INTEGER,
        data_cadastro       DATE,
        data_atualizacao    DATE,
        data_venda          DATE,
        origem              TEXT,
        midia               TEXT,
        campanha            TEXT,
        status              TEXT,
        etapa               TEXT,
        temperatura         TEXT,
        score               INTEGER,
        valor_venda         NUMERIC,
        tempo_conversao_dias INTEGER,
        utm_campaign        TEXT,
        utm_source          TEXT,
        utm_content         TEXT,
        id_data_cadastro    INTEGER REFERENCES dim_tempo(id_data),
        id_data_venda       INTEGER REFERENCES dim_tempo(id_data),
        raw                 JSONB DEFAULT '{}',
        synced_at           TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await optionalSchemaStep('fato_leads_id_lead index', () => sql`CREATE INDEX IF NOT EXISTS fato_leads_id_lead ON fato_leads (id_lead)`);
    await optionalSchemaStep('fato_leads_data_cadastro index', () => sql`CREATE INDEX IF NOT EXISTS fato_leads_data_cadastro ON fato_leads (data_cadastro DESC)`);

    await sql`
      CREATE TABLE IF NOT EXISTS fato_vendas (
        id_venda          BIGINT PRIMARY KEY,
        id_lead           TEXT,
        id_empreendimento INTEGER,
        id_unidade        BIGINT,
        id_corretor       INTEGER,
        id_cliente        INTEGER,
        data_venda        DATE,
        valor             NUMERIC,
        status            TEXT,
        midia             TEXT,
        campanha          TEXT,
        origem            TEXT,
        id_data           INTEGER REFERENCES dim_tempo(id_data)
      )
    `;
    await optionalSchemaStep('fato_vendas_data_venda index', () => sql`CREATE INDEX IF NOT EXISTS fato_vendas_data_venda ON fato_vendas (data_venda DESC)`);

    await sql`
      CREATE TABLE IF NOT EXISTS fato_midia_paga (
        id           BIGSERIAL PRIMARY KEY,
        id_campanha  TEXT REFERENCES dim_campanhas_meta(id_campanha),
        data         DATE NOT NULL,
        spend        NUMERIC DEFAULT 0,
        impressions  BIGINT DEFAULT 0,
        clicks       BIGINT DEFAULT 0,
        reach        BIGINT DEFAULT 0,
        frequency    NUMERIC DEFAULT 0,
        cpc          NUMERIC DEFAULT 0,
        cpm          NUMERIC DEFAULT 0,
        ctr          NUMERIC DEFAULT 0,
        leads_meta   BIGINT DEFAULT 0,
        id_data      INTEGER REFERENCES dim_tempo(id_data)
      )
    `;
    await optionalSchemaStep('fato_midia_paga_campanha_data index', () => sql`CREATE INDEX IF NOT EXISTS fato_midia_paga_campanha_data ON fato_midia_paga (id_campanha, data)`);

    await sql`
      CREATE TABLE IF NOT EXISTS fato_interacoes (
        id          BIGSERIAL PRIMARY KEY,
        id_lead     TEXT,
        lead_nome   TEXT,
        de          TEXT,
        para        TEXT,
        autor       TEXT,
        changed_at  TIMESTAMPTZ,
        id_data     INTEGER REFERENCES dim_tempo(id_data)
      )
    `;
    await optionalSchemaStep('fato_interacoes_id_lead index', () => sql`CREATE INDEX IF NOT EXISTS fato_interacoes_id_lead ON fato_interacoes (id_lead)`);

    await sql`
      CREATE TABLE IF NOT EXISTS fato_atribuicao_marketing (
        id              BIGSERIAL PRIMARY KEY,
        id_campanha     TEXT,
        nome_campanha   TEXT,
        data            DATE NOT NULL,
        spend           NUMERIC DEFAULT 0,
        impressions     BIGINT DEFAULT 0,
        clicks          BIGINT DEFAULT 0,
        leads_gerados   BIGINT DEFAULT 0,
        leads_com_venda BIGINT DEFAULT 0,
        valor_vendas    NUMERIC DEFAULT 0,
        cpl             NUMERIC DEFAULT 0,
        cac             NUMERIC DEFAULT 0,
        roas            NUMERIC DEFAULT 0,
        id_data         INTEGER REFERENCES dim_tempo(id_data)
      )
    `;
    await optionalSchemaStep('fato_atribuicao_marketing_campanha index', () => sql`CREATE INDEX IF NOT EXISTS fato_atribuicao_marketing_campanha ON fato_atribuicao_marketing (id_campanha, data)`);

    schemaReady = true;
  })();

  try {
    await schemaReadyPromise;
  } catch (error) {
    schemaReadyPromise = null;
    throw error;
  }
}
