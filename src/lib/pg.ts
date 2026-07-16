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
      logger.warn({ label, message: pgError.message }, '[pg] optional schema step skipped');
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
      CREATE TABLE IF NOT EXISTS site_public_settings (
        key          TEXT PRIMARY KEY,
        value        JSONB NOT NULL DEFAULT '{}'::jsonb,
        description  TEXT NOT NULL DEFAULT '',
        updated_by   TEXT NOT NULL DEFAULT 'Sistema',
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS site_public_empreendimentos (
        id                   TEXT PRIMARY KEY,
        slug                 TEXT NOT NULL UNIQUE,
        nome                 TEXT NOT NULL,
        status_publicacao    TEXT NOT NULL DEFAULT 'draft' CHECK (status_publicacao IN ('draft', 'published', 'archived')),
        destaque             BOOLEAN NOT NULL DEFAULT false,
        exibir_na_home       BOOLEAN NOT NULL DEFAULT true,
        crm_empreendimento_id BIGINT,
        cidade               TEXT NOT NULL DEFAULT '',
        bairro               TEXT NOT NULL DEFAULT '',
        headline             TEXT NOT NULL DEFAULT '',
        resumo               TEXT NOT NULL DEFAULT '',
        descricao            TEXT NOT NULL DEFAULT '',
        hero_image_url       TEXT NOT NULL DEFAULT '',
        cta_label            TEXT NOT NULL DEFAULT 'Quero saber mais',
        cta_target           TEXT NOT NULL DEFAULT '',
        tags                 JSONB NOT NULL DEFAULT '[]'::jsonb,
        highlights           JSONB NOT NULL DEFAULT '[]'::jsonb,
        metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
        published_at         TIMESTAMPTZ,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await optionalSchemaStep('site_public empreendimentos slug index', () => sql`CREATE UNIQUE INDEX IF NOT EXISTS site_public_empreendimentos_slug_uidx ON site_public_empreendimentos (LOWER(slug))`);
    await optionalSchemaStep('site_public empreendimentos status index', () => sql`CREATE INDEX IF NOT EXISTS site_public_empreendimentos_status_idx ON site_public_empreendimentos (status_publicacao, destaque, updated_at DESC)`);
    await optionalSchemaStep('site_public empreendimentos crm index', () => sql`CREATE INDEX IF NOT EXISTS site_public_empreendimentos_crm_idx ON site_public_empreendimentos (crm_empreendimento_id)`);

    await sql`
      CREATE TABLE IF NOT EXISTS site_public_media_assets (
        id                 TEXT PRIMARY KEY,
        empreendimento_id  TEXT NOT NULL REFERENCES site_public_empreendimentos(id) ON DELETE CASCADE,
        kind               TEXT NOT NULL DEFAULT 'image' CHECK (kind IN ('image', 'video', 'brochure', 'floorplan', 'document', 'logo')),
        origin             TEXT NOT NULL DEFAULT 'upload' CHECK (origin IN ('upload', 'cvcrm', 'external', 'legacy')),
        title              TEXT NOT NULL DEFAULT '',
        alt_text           TEXT NOT NULL DEFAULT '',
        storage_key        TEXT NOT NULL DEFAULT '',
        public_url         TEXT NOT NULL DEFAULT '',
        thumbnail_url      TEXT NOT NULL DEFAULT '',
        mime_type          TEXT NOT NULL DEFAULT '',
        size_bytes         BIGINT,
        width              INTEGER,
        height             INTEGER,
        is_primary         BOOLEAN NOT NULL DEFAULT false,
        sort_order         INTEGER NOT NULL DEFAULT 0,
        metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await optionalSchemaStep('site_public media empreendimento index', () => sql`CREATE INDEX IF NOT EXISTS site_public_media_assets_emp_idx ON site_public_media_assets (empreendimento_id, sort_order, created_at DESC)`);
    await optionalSchemaStep('site_public media primary index', () => sql`CREATE INDEX IF NOT EXISTS site_public_media_assets_primary_idx ON site_public_media_assets (is_primary, empreendimento_id)`);

    await sql`
      CREATE TABLE IF NOT EXISTS site_public_lead_submissions (
        id                   TEXT PRIMARY KEY,
        empreendimento_id    TEXT REFERENCES site_public_empreendimentos(id) ON DELETE SET NULL,
        lead_nome            TEXT NOT NULL DEFAULT '',
        lead_email           TEXT NOT NULL DEFAULT '',
        lead_phone           TEXT NOT NULL DEFAULT '',
        source               TEXT NOT NULL DEFAULT 'site',
        status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'qualified', 'discarded', 'error')),
        cvcrm_lead_id        BIGINT,
        assigned_to          TEXT NOT NULL DEFAULT '',
        message              TEXT NOT NULL DEFAULT '',
        utm                  JSONB NOT NULL DEFAULT '{}'::jsonb,
        payload              JSONB NOT NULL DEFAULT '{}'::jsonb,
        error_message        TEXT NOT NULL DEFAULT '',
        sent_to_cvcrm_at     TIMESTAMPTZ,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await optionalSchemaStep('site_public leads status index', () => sql`CREATE INDEX IF NOT EXISTS site_public_lead_submissions_status_idx ON site_public_lead_submissions (status, created_at DESC)`);
    await optionalSchemaStep('site_public leads empreendimento index', () => sql`CREATE INDEX IF NOT EXISTS site_public_lead_submissions_emp_idx ON site_public_lead_submissions (empreendimento_id, created_at DESC)`);
    await optionalSchemaStep('site_public leads cvcrm index', () => sql`CREATE INDEX IF NOT EXISTS site_public_lead_submissions_cvcrm_idx ON site_public_lead_submissions (cvcrm_lead_id)`);

    await sql`
      CREATE TABLE IF NOT EXISTS site_public_sync_runs (
        id           BIGSERIAL PRIMARY KEY,
        integration  TEXT NOT NULL CHECK (integration IN ('cvcrm', 'site-api', 'media-import', 'legacy-sync')),
        status       TEXT NOT NULL CHECK (status IN ('success', 'warning', 'error', 'running')),
        scope        TEXT NOT NULL DEFAULT '',
        summary      TEXT NOT NULL DEFAULT '',
        details      JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await optionalSchemaStep('site_public sync integration index', () => sql`CREATE INDEX IF NOT EXISTS site_public_sync_runs_integration_idx ON site_public_sync_runs (integration, created_at DESC)`);

    await sql`
      CREATE TABLE IF NOT EXISTS integration_events (
        id            BIGSERIAL PRIMARY KEY,
        system_source TEXT NOT NULL,
        system_target TEXT NOT NULL DEFAULT '',
        entity_type   TEXT NOT NULL DEFAULT 'lead',
        entity_id     TEXT NOT NULL DEFAULT '',
        external_id   TEXT NOT NULL DEFAULT '',
        status        TEXT NOT NULL CHECK (status IN ('received', 'processed', 'sent', 'warning', 'error', 'skipped')),
        summary       TEXT NOT NULL DEFAULT '',
        detail        TEXT NOT NULL DEFAULT '',
        payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await optionalSchemaStep('integration_events source target index', () => sql`CREATE INDEX IF NOT EXISTS integration_events_source_target_idx ON integration_events (system_source, system_target, created_at DESC)`);
    await optionalSchemaStep('integration_events status index', () => sql`CREATE INDEX IF NOT EXISTS integration_events_status_idx ON integration_events (status, created_at DESC)`);
    await optionalSchemaStep('integration_events entity index', () => sql`CREATE INDEX IF NOT EXISTS integration_events_entity_idx ON integration_events (entity_type, entity_id, created_at DESC)`);

    await sql`
      CREATE TABLE IF NOT EXISTS site_public_resales (
        id                  TEXT PRIMARY KEY,
        cv_unidade_id       BIGINT NOT NULL,
        cv_empreendimento_id BIGINT NOT NULL,
        slug                TEXT NOT NULL UNIQUE,
        status_publicacao   TEXT NOT NULL DEFAULT 'draft' CHECK (status_publicacao IN ('draft', 'published', 'archived', 'sold')),
        destaque            BOOLEAN NOT NULL DEFAULT false,
        titulo_publico      TEXT NOT NULL DEFAULT '',
        descricao_publica   TEXT NOT NULL DEFAULT '',
        preco_revenda       NUMERIC,
        valor_condominio    NUMERIC,
        valor_iptu          NUMERIC,
        aceita_financiamento BOOLEAN NOT NULL DEFAULT false,
        permuta             BOOLEAN NOT NULL DEFAULT false,
        corretor_nome       TEXT NOT NULL DEFAULT '',
        corretor_telefone   TEXT NOT NULL DEFAULT '',
        corretor_email      TEXT NOT NULL DEFAULT '',
        origem_revenda      TEXT NOT NULL DEFAULT 'proprietario' CHECK (origem_revenda IN ('proprietario', 'imobiliaria', 'interna')),
        hero_image_url      TEXT NOT NULL DEFAULT '',
        metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await optionalSchemaStep('site_public resales slug index', () => sql`CREATE UNIQUE INDEX IF NOT EXISTS site_public_resales_slug_uidx ON site_public_resales (LOWER(slug))`);
    await optionalSchemaStep('site_public resales status index', () => sql`CREATE INDEX IF NOT EXISTS site_public_resales_status_idx ON site_public_resales (status_publicacao, destaque, updated_at DESC)`);
    await optionalSchemaStep('site_public resales unidade index', () => sql`CREATE INDEX IF NOT EXISTS site_public_resales_unit_idx ON site_public_resales (cv_unidade_id)`);
    await optionalSchemaStep('site_public resales owner_name column', () => sql`ALTER TABLE site_public_resales ADD COLUMN IF NOT EXISTS owner_name TEXT NOT NULL DEFAULT ''`);
    await optionalSchemaStep('site_public resales owner_phone column', () => sql`ALTER TABLE site_public_resales ADD COLUMN IF NOT EXISTS owner_phone TEXT NOT NULL DEFAULT ''`);
    await optionalSchemaStep('site_public resales owner_email column', () => sql`ALTER TABLE site_public_resales ADD COLUMN IF NOT EXISTS owner_email TEXT NOT NULL DEFAULT ''`);
    await optionalSchemaStep('site_public resales owner_document column', () => sql`ALTER TABLE site_public_resales ADD COLUMN IF NOT EXISTS owner_document TEXT NOT NULL DEFAULT ''`);

    await sql`
      CREATE TABLE IF NOT EXISTS site_public_unit_visibility (
        cv_unidade_id        BIGINT PRIMARY KEY,
        cv_empreendimento_id BIGINT NOT NULL,
        visible_on_site      BOOLEAN NOT NULL DEFAULT true,
        updated_by           TEXT NOT NULL DEFAULT 'Sistema',
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await optionalSchemaStep('site_public unit visibility empreendimento index', () => sql`CREATE INDEX IF NOT EXISTS site_public_unit_visibility_emp_idx ON site_public_unit_visibility (cv_empreendimento_id, visible_on_site, updated_at DESC)`);

    await sql`
      CREATE TABLE IF NOT EXISTS site_public_internal_tables (
        id                   TEXT PRIMARY KEY,
        site_empreendimento_id TEXT REFERENCES site_public_empreendimentos(id) ON DELETE CASCADE,
        cv_empreendimento_id  BIGINT,
        title                TEXT NOT NULL,
        version_label        TEXT NOT NULL DEFAULT '',
        mime_type            TEXT,
        size_bytes           BIGINT,
        storage_key          TEXT NOT NULL DEFAULT '',
        public_url           TEXT NOT NULL DEFAULT '',
        data                 BYTEA,
        metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by           TEXT NOT NULL DEFAULT '',
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await optionalSchemaStep('site_public internal tables project index', () => sql`CREATE INDEX IF NOT EXISTS site_public_internal_tables_project_idx ON site_public_internal_tables (site_empreendimento_id, updated_at DESC)`);

    await sql`
      CREATE TABLE IF NOT EXISTS site_public_gated_assets (
        id                   TEXT PRIMARY KEY,
        site_empreendimento_id TEXT REFERENCES site_public_empreendimentos(id) ON DELETE CASCADE,
        title                TEXT NOT NULL,
        slug                 TEXT NOT NULL UNIQUE,
        asset_type           TEXT NOT NULL CHECK (asset_type IN ('ebook', 'brochure', 'document')),
        storage_key          TEXT NOT NULL DEFAULT '',
        public_url           TEXT NOT NULL DEFAULT '',
        thumbnail_url        TEXT NOT NULL DEFAULT '',
        mime_type            TEXT NOT NULL DEFAULT '',
        size_bytes           BIGINT,
        active               BOOLEAN NOT NULL DEFAULT true,
        lead_tag             TEXT NOT NULL DEFAULT 'ebook',
        metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await optionalSchemaStep('site_public gated assets project index', () => sql`CREATE INDEX IF NOT EXISTS site_public_gated_assets_project_idx ON site_public_gated_assets (site_empreendimento_id, active, updated_at DESC)`);

    await sql`
      CREATE TABLE IF NOT EXISTS site_public_analytics_events (
        id                   BIGSERIAL PRIMARY KEY,
        session_id           TEXT NOT NULL,
        anonymous_id         TEXT NOT NULL DEFAULT '',
        event_name           TEXT NOT NULL,
        page_url             TEXT NOT NULL DEFAULT '',
        page_path            TEXT NOT NULL DEFAULT '',
        referrer             TEXT NOT NULL DEFAULT '',
        site_empreendimento_id TEXT REFERENCES site_public_empreendimentos(id) ON DELETE SET NULL,
        site_resale_id       TEXT REFERENCES site_public_resales(id) ON DELETE SET NULL,
        cv_empreendimento_id BIGINT,
        cv_unidade_id        BIGINT,
        button_name          TEXT NOT NULL DEFAULT '',
        source               TEXT NOT NULL DEFAULT '',
        utm                  JSONB NOT NULL DEFAULT '{}'::jsonb,
        properties           JSONB NOT NULL DEFAULT '{}'::jsonb,
        consent_scope        JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await optionalSchemaStep('site_public analytics page index', () => sql`CREATE INDEX IF NOT EXISTS site_public_analytics_events_page_idx ON site_public_analytics_events (page_path, created_at DESC)`);
    await optionalSchemaStep('site_public analytics event index', () => sql`CREATE INDEX IF NOT EXISTS site_public_analytics_events_name_idx ON site_public_analytics_events (event_name, created_at DESC)`);

    await sql`
      CREATE TABLE IF NOT EXISTS site_public_cookie_consents (
        id                   BIGSERIAL PRIMARY KEY,
        session_id           TEXT NOT NULL,
        anonymous_id         TEXT NOT NULL DEFAULT '',
        consent_version      TEXT NOT NULL,
        necessary            BOOLEAN NOT NULL DEFAULT true,
        analytics            BOOLEAN NOT NULL DEFAULT false,
        marketing            BOOLEAN NOT NULL DEFAULT false,
        source               TEXT NOT NULL DEFAULT 'banner',
        locale               TEXT NOT NULL DEFAULT 'pt-BR',
        user_agent_hash      TEXT NOT NULL DEFAULT '',
        ip_hash              TEXT NOT NULL DEFAULT '',
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await optionalSchemaStep('site_public cookie consents session index', () => sql`CREATE INDEX IF NOT EXISTS site_public_cookie_consents_session_idx ON site_public_cookie_consents (session_id, created_at DESC)`);

    await sql`
      CREATE TABLE IF NOT EXISTS site_public_page_snapshots (
        id                   BIGSERIAL PRIMARY KEY,
        page_type            TEXT NOT NULL,
        page_key             TEXT NOT NULL,
        page_path            TEXT NOT NULL,
        views                INTEGER NOT NULL DEFAULT 0,
        unique_sessions      INTEGER NOT NULL DEFAULT 0,
        lead_submissions     INTEGER NOT NULL DEFAULT 0,
        cta_clicks           INTEGER NOT NULL DEFAULT 0,
        whatsapp_clicks      INTEGER NOT NULL DEFAULT 0,
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await optionalSchemaStep('site_public page snapshots path index', () => sql`CREATE INDEX IF NOT EXISTS site_public_page_snapshots_path_idx ON site_public_page_snapshots (page_path, updated_at DESC)`);

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

    // Empreendimentos — tabela dedicada, substitui project_state.data.projects
    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status      TEXT NOT NULL DEFAULT 'Não iniciado',
        progress    INTEGER NOT NULL DEFAULT 0,
        banner      TEXT NOT NULL DEFAULT '',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await optionalSchemaStep('projects name index', () => sql`CREATE UNIQUE INDEX IF NOT EXISTS projects_name_lower_uidx ON projects (LOWER(name))`);

    // Responsáveis — tabela dedicada, substitui project_state.data.responsibles
    await sql`
      CREATE TABLE IF NOT EXISTS responsibles (
        id             TEXT PRIMARY KEY,
        name           TEXT NOT NULL,
        phone          TEXT NOT NULL DEFAULT '',
        email          TEXT NOT NULL DEFAULT '',
        company        TEXT NOT NULL DEFAULT '',
        photo          TEXT,
        photo_position JSONB,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await optionalSchemaStep('responsibles name index', () => sql`CREATE INDEX IF NOT EXISTS responsibles_name_lower_idx ON responsibles (LOWER(name))`);

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
    // project_id — FK real; `project` (texto) fica como cache desnormalizado até uma migração futura remover
    await optionalSchemaStep('tasks project_id column', () => sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id)`);
    await optionalSchemaStep('tasks project_id index',  () => sql`CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks (project_id)`);

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
