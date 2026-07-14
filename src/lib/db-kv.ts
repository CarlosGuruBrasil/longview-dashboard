import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { createDefaultPermissions, normalizePermissions, type UserPermissions } from './permissions';
import logger from '@/lib/logger'

export type { UserPermissions } from './permissions';

// ─── Interfaces (mantidas idênticas para não quebrar importadores) ────────────

export interface UserAddress {
  street?: string;
  number?: string;
  complement?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface UserEmergencyContact {
  name?: string;
  phone?: string;
  relationship?: string;
}

/** Campos de perfil People Vision — armazenados em data JSONB via writeUsers */
export interface UserProfileData {
  category?: 'colaborador' | 'fornecedor';
  mustChangePassword?: boolean;
  phone?: string;
  whatsapp?: string;
  position?: string;         // cargo
  department?: string;       // departamento
  company?: string;          // empresa
  activatedAt?: string;      // data de entrada na empresa (ISO date)
  birthDate?: string;        // data de nascimento
  address?: UserAddress;
  linkedIn?: string;
  emergencyContact?: UserEmergencyContact;
  avatarUrl?: string;
  theme?: 'dark' | 'light' | 'system';
  language?: 'pt-BR' | 'en';
  notes?: string;            // observações internas (visível só para admin)
  status?: 'ativo' | 'inativo' | 'ferias' | 'afastado';
  // Documentos pessoais
  cpf?: string;
  rg?: string;
  rgOrgao?: string;          // órgão emissor do RG
  rgEstado?: string;         // estado emissor do RG
  // Registro profissional (condicional por cargo)
  professionalId?: string;        // CRECI / CREA / CRM / OAB / CRC
  professionalIdType?: string;    // 'CRECI' | 'CREA' | 'CRM' | 'OAB' | 'CRC' | 'outro'
  professionalIdState?: string;   // estado do registro (SC, SP, ...)
  professionalIdExpiry?: string;  // data de vencimento ISO
}

/** Documento/contrato de colaborador — armazenado na tabela user_documents (conteúdo no Postgres) */
export interface UserDocument {
  id: string;
  userId: string;
  name: string;
  category: 'contrato_clt' | 'contrato_pj' | 'identificacao' | 'habilitacao' | 'outro';
  url: string;               // vazio '' — mantido por compatibilidade; arquivo fica em content_b64
  contentType?: string;
  sizeBytes?: number;
  expiresAt?: string;        // ISO date — validade do documento
  uploadedBy: string;        // userId
  uploadedAt: string;        // ISO datetime
  contentB64?: string;       // base64 do arquivo — lido/gravado em user_documents.content_b64
}

export interface DbUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'Desenvolvedor' | 'Diretoria' | 'Operador' | 'Gestor' | 'Parceiro' | 'Corretor' | 'Visualizador';
  permissions: UserPermissions;
  createdAt: string;
  profile?: UserProfileData;
}

/** Registro pendente de auto-cadastro via link de convite */
export interface PendingRegistration {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  profile: Partial<UserProfileData>;
  approverId: string;   // userId do aprovador escolhido
  approverName: string;
  approverEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
}

export interface Subtask { id: string; title: string; completed: boolean; }
export interface Comment { id: string; userId: string; userName: string; role: string; content: string; createdAt: string; }
export interface Document { id: string; name: string; category: string; uploadDate: string; uploader: string; size?: string; version: number; url: string; }
export interface ChangeLog { id: string; field: string; oldValue: string; newValue: string; userName: string; date: string; }

export interface Task {
  id: string; project: string; projectId?: string; sector: string; subject: string; description: string;
  responsible: string; secondaryResponsibles: string[]; statusContratacao: string;
  statusAndamento: 'Não iniciado' | 'Em andamento' | 'Aguardando' | 'Em análise' | 'Finalizado';
  urgencia: 'Baixa' | 'Média' | 'Alta' | 'Crítica' | 'Emergencial';
  inicio: string; previsaoEntrega: string; entregaEfetiva: string;
  situacao: string; observacoesRotinas: string; progress: number;
  subtasks: Subtask[]; comments: Comment[]; documents: Document[];
  logs: ChangeLog[]; dependencies: string[]; tags: string[];
}

export interface PhotoPosition { x: number; y: number; zoom: number; }
export interface Project { id: string; name: string; description: string; status: string; progress: number; banner: string; }
export interface Responsible { id: string; name: string; phone: string; email: string; company: string; photo?: string; photoPosition?: PhotoPosition; }
export interface ProjectDatabaseState { tasks: Task[]; projects: Project[]; responsibles: Responsible[]; }

export interface ShortLink { slug: string; url: string; title: string; active: boolean; createdAt: string; createdBy: string; }

// ─── Backend detection ────────────────────────────────────────────────────────

const isPg = (): boolean => !!process.env.DATABASE_URL;

// ─── Local file fallback (dev sem Postgres) ───────────────────────────────────

const DATA_DIR          = path.join(process.cwd(), 'data');
const LOCAL_USERS_FILE  = path.join(DATA_DIR, 'users-kv-local.json');
const LOCAL_PROJ_FILE   = path.join(DATA_DIR, 'projects-kv-local.json');
const LOCAL_LINKS_FILE  = path.join(DATA_DIR, 'links-kv-local.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  ensureDataDir();
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return fallback; }
}

function writeJson(file: string, data: unknown): void {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

function normalizeProjectState(state: Partial<ProjectDatabaseState> | null | undefined): ProjectDatabaseState {
  return {
    tasks: Array.isArray(state?.tasks) ? state.tasks : [],
    projects: Array.isArray(state?.projects) ? state.projects : [],
    responsibles: Array.isArray(state?.responsibles) ? state.responsibles : [],
  };
}

export function hasProjectVisionData(state: ProjectDatabaseState): boolean {
  return state.tasks.length > 0;
}

export function readLocalProjectData(): ProjectDatabaseState {
  const local = normalizeProjectState(readJson<Partial<ProjectDatabaseState> | null>(LOCAL_PROJ_FILE, null));
  if (hasProjectVisionData(local)) return local;

  // migrate from legacy db.json / CSV-backed initializer
  const legacy = path.join(DATA_DIR, 'db.json');
  if (fs.existsSync(legacy)) {
    try {
      const d = JSON.parse(fs.readFileSync(legacy, 'utf-8'));
      return normalizeProjectState({ tasks: d.tasks, projects: d.projects, responsibles: d.responsibles });
    } catch { /* ignore */ }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readDatabase } = require('./db');
    const leg = readDatabase();
    return normalizeProjectState({ tasks: leg.tasks, projects: leg.projects, responsibles: leg.responsibles });
  } catch { /* no CSV, no problem */ }

  return { tasks: [], projects: [], responsibles: [] };
}

// ─── Postgres lazy import (only when DATABASE_URL is set) ────────────────────

async function getPg() {
  const { sql, ensureSchema } = await import('./pg');
  await ensureSchema();
  return sql;
}

function throwPgWriteError(operation: string, error: unknown): never {
  logger.error({ error }, '[db-kv] $ PG error:');
  const message = error instanceof Error ? error.message : String(error);
  throw new Error(`${operation} falhou no Postgres; escrita local bloqueada para evitar divergência de dados. ${message}`);
}

// ─── 1. USUÁRIOS ─────────────────────────────────────────────────────────────

export async function readUsers(): Promise<DbUser[]> {
  const normalize = (u: DbUser): DbUser => ({ ...u, permissions: normalizePermissions(u.permissions) });

  if (isPg()) {
    // Em modo Postgres: banco é a fonte única de verdade — sem fallback local.
    // Se o banco estiver indisponível, lança erro em vez de retornar lista incompleta.
    const db = await getPg();
    const rows = await db<{ data: DbUser }[]>`SELECT data FROM app_users ORDER BY created_at`;
    return rows.map(r => normalize(typeof r.data === 'object' ? r.data : JSON.parse(r.data as unknown as string)));
  }
  return readJson<DbUser[]>(LOCAL_USERS_FILE, []).map(normalize);
}

/** Grava ou atualiza um único usuário no banco — nunca apaga outros registros. */
export async function upsertUser(user: DbUser): Promise<void> {
  const u = { ...user, permissions: normalizePermissions(user.permissions) };
  if (isPg()) {
    const db = await getPg();
    await db`
      INSERT INTO app_users (id, email, password_hash, name, role, permissions, data, created_at)
      VALUES (${u.id}, ${u.email}, ${u.passwordHash}, ${u.name}, ${u.role},
              ${JSON.stringify(u.permissions)}, ${JSON.stringify(u)}, ${u.createdAt})
      ON CONFLICT (id) DO UPDATE SET
        email         = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        name          = EXCLUDED.name,
        role          = EXCLUDED.role,
        permissions   = EXCLUDED.permissions,
        data          = EXCLUDED.data
    `;
    return;
  }
  const users = readJson<DbUser[]>(LOCAL_USERS_FILE, []);
  const idx   = users.findIndex(x => x.id === u.id);
  if (idx >= 0) users[idx] = u; else users.push(u);
  writeJson(LOCAL_USERS_FILE, users);
}

/** Remove um único usuário pelo ID — operação explícita e segura. */
export async function deleteUser(userId: string): Promise<void> {
  if (isPg()) {
    const db = await getPg();
    await db`DELETE FROM app_users WHERE id = ${userId}`;
    return;
  }
  const users = readJson<DbUser[]>(LOCAL_USERS_FILE, []);
  writeJson(LOCAL_USERS_FILE, users.filter(u => u.id !== userId));
}

/**
 * @deprecated Use upsertUser() para salvar um usuário ou deleteUser() para remover.
 * writeUsers() ainda existe para compatibilidade com código legado mas agora
 * faz apenas upserts individuais — NUNCA apaga registros do banco.
 */
export async function writeUsers(users: DbUser[]): Promise<void> {
  for (const u of users) await upsertUser(u);
}

// ─── 2. PROJECT VISION (tasks + projetos) ────────────────────────────────────

export async function readProjectData(): Promise<ProjectDatabaseState> {
  if (isPg()) {
    try {
      const db = await getPg();
      const rows = await db<{ data: ProjectDatabaseState }[]>`
        SELECT data FROM project_state WHERE key = 'state'
      `;
      const raw = rows[0]?.data;
      const pgState = normalizeProjectState(typeof raw === 'string' ? JSON.parse(raw) : raw);
      if (hasProjectVisionData(pgState)) return pgState;

      const seededState = readLocalProjectData();
      if (hasProjectVisionData(seededState)) {
        await db`
          INSERT INTO project_state (key, data) VALUES ('state', ${JSON.stringify(seededState)})
          ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data
        `;
        return seededState;
      }
    } catch (e) { logger.error({ err: e }, '[db-kv] readProjectData PG error'); }
  }

  return readLocalProjectData();
}

export async function writeProjectData(state: ProjectDatabaseState): Promise<void> {
  if (isPg()) {
    try {
      const db = await getPg();
      await db`
        INSERT INTO project_state (key, data) VALUES ('state', ${JSON.stringify(state)})
        ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data
      `;
      return;
    } catch (e) { throwPgWriteError('writeProjectData', e); }
  }
  writeJson(LOCAL_PROJ_FILE, state);
}

// Atomic read-modify-write with row-level lock — prevents lost updates under concurrent users
export async function mutateProjectData(
  fn: (state: ProjectDatabaseState) => void | Promise<void>
): Promise<ProjectDatabaseState> {
  if (isPg()) {
    const { sql: pgSql, ensureSchema } = await import('./pg');
    await ensureSchema();
    return pgSql.begin(async (tx) => {
      // FOR UPDATE locks the row; concurrent callers wait instead of racing
      const rows = await tx<{ data: ProjectDatabaseState }[]>`
        SELECT data FROM project_state WHERE key = 'state' FOR UPDATE
      `;
      const rawState = rows[0]?.data;
      let state: ProjectDatabaseState = normalizeProjectState(typeof rawState === 'string' ? JSON.parse(rawState) : rawState);
      if (!hasProjectVisionData(state)) {
        state = readLocalProjectData();
      }
      await fn(state);
      await tx`
        INSERT INTO project_state (key, data) VALUES ('state', ${JSON.stringify(state)})
        ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data
      `;
      return state;
    });
  }
  // local dev: single process, no race — plain read-write is fine
  const state = await readProjectData();
  await fn(state);
  await writeProjectData(state);
  return state;
}

// ─── 3. SEED ─────────────────────────────────────────────────────────────────

export async function seedDatabaseIfEmpty(): Promise<void> {
  if (isPg()) {
    try {
      const db = await getPg();
      // Conta direto no banco — nunca depende de readUsers() que pode retornar [] por erro
      const [{ count }] = await db<{ count: string }[]>`SELECT COUNT(*) AS count FROM app_users`;
      if (Number(count) > 0) {
        // Banco tem usuários — não fazer nada, evita sobrescrever dados reais
        // Verifica apenas project state
        const proj = await readProjectData();
        if (!hasProjectVisionData(proj)) {
          const local = readLocalProjectData();
          if (hasProjectVisionData(local)) await writeProjectData(local);
        }
        return;
      }
      // Banco confirmado vazio — semear usuários padrão
    } catch {
      // Banco indisponível (ex: container ainda subindo) — abortar sem semear
      // Isso evita o bug onde conexão falha → readUsers() retorna [] → seed apaga todos
      logger.warn('[db-kv] seedDatabaseIfEmpty: banco indisponível, seed abortado para preservar dados');
      return;
    }
  } else {
    const users = readJson<DbUser[]>(LOCAL_USERS_FILE, []);
    if (users.length > 0) return;
  }

  logger.info('[db-kv] Banco vazio confirmado — semeando usuários padrão...');
  const [developerHash, diretoriaHash] = await Promise.all([
    bcrypt.hash('Guru$2026', 10),
    bcrypt.hash('Longview$2026', 10),
  ]);

  const allPerms = createDefaultPermissions({
    viewMarketingDashboard: true, viewMarketingLeads: true, viewMarketingOportunidades: true,
    viewMarketingEstoque: true, viewMarketingAds: true, viewMarketingVendas: true,
    viewProjectVision: true, manageProjects: true, manageCommentsDocs: true,
    deleteTasks: true, viewPeopleVision: true, viewQualityVision: true, isAdmin: true,
  });

  await writeUsers([
    { id: 'usr-dev',   name: 'Carlos Santos (Desenvolvedor)', email: 'carlos@longview.com.br',   passwordHash: developerHash, role: 'Desenvolvedor', permissions: allPerms, createdAt: new Date().toISOString() },
    { id: 'usr-admin', name: 'Diretoria Executiva',           email: 'diretoria@longview.com.br', passwordHash: diretoriaHash, role: 'Diretoria',    permissions: allPerms, createdAt: new Date().toISOString() },
  ]);

  // Importa tasks do CSV legado se project state estiver vazio
  const proj = await readProjectData();
  if (!hasProjectVisionData(proj)) {
    const local = readLocalProjectData();
    if (hasProjectVisionData(local)) await writeProjectData(local);
  }
}

// ─── 4. DOCUMENTOS DE COLABORADORES ──────────────────────────────────────────

const LOCAL_DOCS_FILE = path.join(DATA_DIR, 'user-docs-local.json');

export async function readUserDocuments(userId: string): Promise<UserDocument[]> {
  if (isPg()) {
    try {
      const db = await getPg();
      const rows = await db<UserDocument[]>`
        SELECT id, user_id AS "userId", name, category, url,
               content_type AS "contentType", size_bytes AS "sizeBytes",
               expires_at::text AS "expiresAt",
               uploaded_by AS "uploadedBy", uploaded_at::text AS "uploadedAt",
               content_b64 AS "contentB64"
        FROM user_documents WHERE user_id = ${userId} ORDER BY uploaded_at DESC
      `;
      return rows;
    } catch (e) { logger.error({ err: e }, '[db-kv] readUserDocuments PG error'); }
  }
  const store = readJson<Record<string, UserDocument[]>>(LOCAL_DOCS_FILE, {});
  return store[userId] ?? [];
}

export async function addUserDocument(doc: UserDocument): Promise<void> {
  if (isPg()) {
    try {
      const db = await getPg();
      await db`
        INSERT INTO user_documents (id, user_id, name, category, url, content_type, size_bytes, expires_at, uploaded_by, uploaded_at, content_b64)
        VALUES (${doc.id}, ${doc.userId}, ${doc.name}, ${doc.category}, ${doc.url ?? ''},
                ${doc.contentType ?? null}, ${doc.sizeBytes ?? null},
                ${doc.expiresAt ?? null}, ${doc.uploadedBy}, ${doc.uploadedAt},
                ${doc.contentB64 ?? null})
      `;
      return;
    } catch (e) { throwPgWriteError('addUserDocument', e); }
  }
  const store = readJson<Record<string, UserDocument[]>>(LOCAL_DOCS_FILE, {});
  store[doc.userId] = [...(store[doc.userId] ?? []), doc];
  writeJson(LOCAL_DOCS_FILE, store);
}

export async function deleteUserDocument(userId: string, docId: string): Promise<void> {
  if (isPg()) {
    try {
      const db = await getPg();
      await db`DELETE FROM user_documents WHERE id = ${docId} AND user_id = ${userId}`;
      return;
    } catch (e) { throwPgWriteError('deleteUserDocument', e); }
  }
  const store = readJson<Record<string, UserDocument[]>>(LOCAL_DOCS_FILE, {});
  store[userId] = (store[userId] ?? []).filter(d => d.id !== docId);
  writeJson(LOCAL_DOCS_FILE, store);
}

export async function hasUserDocuments(userId: string): Promise<boolean> {
  const docs = await readUserDocuments(userId);
  return docs.length > 0;
}

// ─── 5. LINKS (antes seção 4) ────────────────────────────────────────────────

export async function readLinks(): Promise<ShortLink[]> {
  if (isPg()) {
    try {
      const db = await getPg();
      const rows = await db<ShortLink[]>`
        SELECT slug, url, title, active, created_at AS "createdAt", created_by AS "createdBy"
        FROM short_links ORDER BY created_at DESC
      `;
      return rows;
    } catch (e) { logger.error({ err: e }, '[db-kv] readLinks PG error'); }
  }
  const d = readJson<{ links: ShortLink[] }>(LOCAL_LINKS_FILE, { links: [] });
  return d.links;
}

export async function writeLinks(links: ShortLink[]): Promise<void> {
  if (isPg()) {
    try {
      const db = await getPg();
      if (links.length === 0) {
        await db`DELETE FROM short_links`;
        return;
      }
      for (const l of links) {
        await db`
          INSERT INTO short_links (slug, url, title, active, created_at, created_by)
          VALUES (${l.slug}, ${l.url}, ${l.title}, ${l.active}, ${l.createdAt}, ${l.createdBy})
          ON CONFLICT (slug) DO UPDATE SET
            url        = EXCLUDED.url,
            title      = EXCLUDED.title,
            active     = EXCLUDED.active,
            created_by = EXCLUDED.created_by
        `;
      }
      const slugs = links.map(l => l.slug);
      await db`DELETE FROM short_links WHERE slug <> ALL(${slugs}::text[])`;
      return;
    } catch (e) { throwPgWriteError('writeLinks', e); }
  }
  const d = readJson<{ links: ShortLink[]; clicks: Record<string, number> }>(LOCAL_LINKS_FILE, { links: [], clicks: {} });
  writeJson(LOCAL_LINKS_FILE, { ...d, links });
}

// ─── 5. CLIQUES ──────────────────────────────────────────────────────────────

export async function incrClick(slug: string): Promise<void> {
  if (isPg()) {
    try {
      const db = await getPg();
      await db`
        INSERT INTO link_clicks (slug, count) VALUES (${slug}, 1)
        ON CONFLICT (slug) DO UPDATE SET count = link_clicks.count + 1
      `;
      return;
    } catch (e) { throwPgWriteError('incrClick', e); }
  }
  const d = readJson<{ links: ShortLink[]; clicks: Record<string, number> }>(LOCAL_LINKS_FILE, { links: [], clicks: {} });
  d.clicks[slug] = (d.clicks[slug] || 0) + 1;
  writeJson(LOCAL_LINKS_FILE, d);
}

export async function getClicks(slugs: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (slugs.length === 0) return out;

  if (isPg()) {
    try {
      const db = await getPg();
      const rows = await db<{ slug: string; count: number }[]>`
        SELECT slug, count FROM link_clicks WHERE slug = ANY(${slugs}::text[])
      `;
      rows.forEach(r => { out[r.slug] = Number(r.count); });
      slugs.forEach(s => { if (!(s in out)) out[s] = 0; });
      return out;
    } catch (e) { logger.error({ err: e }, '[db-kv] getClicks PG error'); }
  }
  const { clicks } = readJson<{ clicks: Record<string, number> }>(LOCAL_LINKS_FILE, { clicks: {} });
  slugs.forEach(s => { out[s] = clicks[s] || 0; });
  return out;
}

export async function delClick(slug: string): Promise<void> {
  if (isPg()) {
    try {
      const db = await getPg();
      await db`DELETE FROM link_clicks WHERE slug = ${slug}`;
      return;
    } catch (e) { throwPgWriteError('delClick', e); }
  }
  const d = readJson<{ links: ShortLink[]; clicks: Record<string, number> }>(LOCAL_LINKS_FILE, { links: [], clicks: {} });
  delete d.clicks[slug];
  writeJson(LOCAL_LINKS_FILE, d);
}

// ─── 6. GENERIC KEY-VALUE (project_state table) ───────────────────────────────

const LOCAL_KV_FILE = path.join(DATA_DIR, 'kv-local.json');

export async function readKv<T>(key: string, fallback: T): Promise<T> {
  if (isPg()) {
    try {
      const db   = await getPg();
      const rows = await db<{ data: T }[]>`SELECT data FROM project_state WHERE key = ${key}`;
      if (rows.length > 0) {
        const raw = rows[0].data;
        return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T;
      }
      return fallback;
    } catch (e) { logger.error({ err: e, key }, '[db-kv] readKv error'); }
  }
  const store = readJson<Record<string, unknown>>(LOCAL_KV_FILE, {});
  return (key in store ? store[key] : fallback) as T;
}

export async function writeKv<T>(key: string, value: T): Promise<void> {
  if (isPg()) {
    try {
      const db = await getPg();
      await db`
        INSERT INTO project_state (key, data) VALUES (${key}, ${JSON.stringify(value)})
        ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data
      `;
      return;
    } catch (e) { throwPgWriteError(`writeKv(${key})`, e); }
  }
  const store = readJson<Record<string, unknown>>(LOCAL_KV_FILE, {});
  store[key]  = value;
  writeJson(LOCAL_KV_FILE, store);
}

// ─── 7. TASKS — tabela dedicada ──────────────────────────────────────────────
// Migração transparente: na primeira leitura, se a tabela tasks estiver vazia,
// copia automaticamente do JSONB legado (project_state). JSONB original preservado.

export interface TaskDocumentMeta {
  id: string; taskId: string; name: string; category: string;
  contentType?: string; sizeBytes?: number;
  uploadedBy: string; uploadedAt: string; version: number;
}

/** Lê tasks do JSONB legado (project_state). Retorna [] se não houver. */
async function readTasksFromJsonb(db: Awaited<ReturnType<typeof getPg>>): Promise<Task[]> {
  try {
    const rows = await db<{ data: unknown }[]>`
      SELECT data FROM project_state WHERE key = 'state' LIMIT 1
    `;
    const raw = rows[0]?.data;
    // postgres.js retorna JSONB como objeto JS; pode vir como string se coluna for text
    const state = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const tasks = (state as { tasks?: Task[] })?.tasks;
    return Array.isArray(tasks) ? tasks : [];
  } catch { return []; }
}

/** Migra tarefas do JSONB legado para a tabela tasks (idempotente). */
async function migrateTasksIfNeeded(db: Awaited<ReturnType<typeof getPg>>): Promise<Task[]> {
  const [{ count }] = await db<{ count: string }[]>`SELECT COUNT(*) AS count FROM tasks`;
  if (Number(count) > 0) return []; // já migrado, nada a fazer

  const tasks = await readTasksFromJsonb(db);
  if (tasks.length === 0) return [];

  logger.info(`[db-kv] Iniciando migração de $ tarefas JSONB → tabela tasks`);
  let migrated = 0;
  for (const t of tasks) {
    try {
      // Cast explícito para contornar restrição de tipo do postgres.js
      await db`
        INSERT INTO tasks (id, project, data, created_at, updated_at)
        VALUES (${t.id}, ${t.project ?? ''}, ${JSON.stringify(t)}::jsonb, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `;
      migrated++;
    } catch (e) {
      logger.warn({ e }, '[db-kv] migrate task $ falhou:');
    }
  }
  logger.info(`[db-kv] Migração concluída: $/$ tarefas`);
  return tasks; // retorna as tarefas mesmo que a migração falhe parcialmente
}

/** Lê tarefas com filtros opcionais. Fallback para JSONB se tabela vazia. */
export async function readTasks(filters: {
  project?: string; projectId?: string; sector?: string; status?: string;
  urgencia?: string; responsible?: string; statusContratacao?: string; q?: string;
} = {}): Promise<Task[]> {
  if (isPg()) {
    const db = await getPg();

    let tasks: Task[] = [];
    try {
      // Tenta migrar se necessário (retorna tasks legadas se migração recém-rodou)
      const migrated = await migrateTasksIfNeeded(db);

      const rows = await db<{ data: unknown; project_id: string | null }[]>`SELECT data, project_id FROM tasks ORDER BY updated_at DESC`;
      tasks = rows.map(r => {
        const raw = r.data;
        const t = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Task;
        // project_id (coluna) é a fonte de verdade — pode não estar no JSONB pra tarefas antigas
        return { ...t, projectId: r.project_id ?? t.projectId };
      });

      // Fallback: migração acabou de rodar mas INSERT pode ter falhado → usa dados originais
      if (tasks.length === 0 && migrated.length > 0) {
        logger.warn('[db-kv] Tabela tasks vazia após migração — usando fallback JSONB');
        tasks = migrated;
      }
    } catch (e) {
      logger.error({ e }, '[db-kv] readTasks erro:');
      // Último recurso: ler direto do JSONB
      tasks = await readTasksFromJsonb(db);
    }

    // Fallback final: tasks ainda vazio → ler do JSONB
    if (tasks.length === 0) {
      tasks = await readTasksFromJsonb(db);
    }

    if (filters.projectId)         tasks = tasks.filter(t => t.projectId === filters.projectId);
    if (filters.project)           tasks = tasks.filter(t => t.project?.toLowerCase() === filters.project!.toLowerCase());
    if (filters.sector)            tasks = tasks.filter(t => t.sector?.toLowerCase() === filters.sector!.toLowerCase());
    if (filters.status)            tasks = tasks.filter(t => t.statusAndamento?.toLowerCase() === filters.status!.toLowerCase());
    if (filters.urgencia)          tasks = tasks.filter(t => t.urgencia?.toLowerCase() === filters.urgencia!.toLowerCase());
    if (filters.responsible)       tasks = tasks.filter(t => t.responsible?.toLowerCase() === filters.responsible!.toLowerCase() || t.secondaryResponsibles?.some(r => r.toLowerCase() === filters.responsible!.toLowerCase()));
    if (filters.statusContratacao) tasks = tasks.filter(t => t.statusContratacao?.toLowerCase() === filters.statusContratacao!.toLowerCase());
    if (filters.q) {
      const q = filters.q.toLowerCase();
      tasks = tasks.filter(t => [t.subject, t.id, t.description, t.responsible, t.sector, t.project, t.situacao, t.observacoesRotinas].some(f => f?.toLowerCase().includes(q)));
    }
    return tasks;
  }
  return (readLocalProjectData()).tasks;
}

/** Lê uma tarefa por ID. */
export async function readTaskById(id: string): Promise<Task | null> {
  if (isPg()) {
    const db = await getPg();
    await migrateTasksIfNeeded(db);
    const rows = await db<{ data: unknown; project_id: string | null }[]>`SELECT data, project_id FROM tasks WHERE id = ${id} LIMIT 1`;
    if (!rows[0]) return null;
    const raw = rows[0].data;
    const t = (typeof raw === 'object' ? raw : JSON.parse(raw as unknown as string)) as Task;
    return { ...t, projectId: rows[0].project_id ?? t.projectId };
  }
  const state = readLocalProjectData();
  return state.tasks.find(t => t.id === id) ?? null;
}

/** Gera próximo ID de tarefa (LVM-XXXX). Race-safe com MAX no banco. */
export async function nextTaskId(): Promise<string> {
  if (isPg()) {
    const db = await getPg();
    await migrateTasksIfNeeded(db);
    const rows = await db<{ max_id: string | null }[]>`
      SELECT MAX(CAST(REGEXP_REPLACE(id, '[^0-9]', '', 'g') AS INTEGER)) AS max_id FROM tasks
    `;
    const max = Number(rows[0]?.max_id ?? 0);
    return `LVM-${String(max + 1).padStart(4, '0')}`;
  }
  const state = readLocalProjectData();
  const max = state.tasks.length > 0 ? Math.max(...state.tasks.map(t => parseInt(t.id.replace('LVM-', '')) || 0)) : 0;
  return `LVM-${String(max + 1).padStart(4, '0')}`;
}

/** Insere ou atualiza tarefa. Resolve project_id/project (nome) a partir de um ou outro. */
export async function upsertTask(task: Task): Promise<void> {
  if (isPg()) {
    const db = await getPg();
    let projectId = task.projectId ?? null;
    let projectName = task.project ?? '';
    if (projectId) {
      const proj = await readProjectById(projectId);
      if (proj) projectName = proj.name;
    } else if (projectName) {
      const rows = await db<{ id: string }[]>`SELECT id FROM projects WHERE LOWER(name) = LOWER(${projectName}) LIMIT 1`;
      projectId = rows[0]?.id ?? null;
    }
    const taskToStore: Task = { ...task, project: projectName, projectId: projectId ?? undefined };
    await db`
      INSERT INTO tasks (id, project, project_id, data, created_at, updated_at)
      VALUES (${task.id}, ${projectName}, ${projectId}, ${JSON.stringify(taskToStore)}, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        project    = EXCLUDED.project,
        project_id = EXCLUDED.project_id,
        data       = EXCLUDED.data,
        updated_at = NOW()
    `;
    if (projectId) await _syncProjectProgress(db, projectId);
    return;
  }
  // Dev local
  await mutateProjectData(db => {
    const idx = db.tasks.findIndex(t => t.id === task.id);
    if (idx >= 0) db.tasks[idx] = task; else db.tasks.push(task);
  });
}

/** Remove tarefa. */
export async function deleteTask(id: string): Promise<boolean> {
  if (isPg()) {
    const db = await getPg();
    const rows = await db<{ project_id: string | null }[]>`DELETE FROM tasks WHERE id = ${id} RETURNING project_id`;
    if (rows[0]?.project_id) await _syncProjectProgress(db, rows[0].project_id);
    return rows.length > 0;
  }
  let found = false;
  await mutateProjectData(db => {
    const idx = db.tasks.findIndex(t => t.id === id);
    if (idx >= 0) { found = true; db.tasks.splice(idx, 1); }
  });
  return found;
}

/** Recalcula progresso do projeto a partir das tarefas vinculadas por project_id. */
async function _syncProjectProgress(db: Awaited<ReturnType<typeof getPg>>, projectId: string): Promise<void> {
  try {
    const rows = await db<{ data: unknown }[]>`SELECT data FROM tasks WHERE project_id = ${projectId}`;
    const tasks = rows.map(r => (typeof r.data === 'object' ? r.data : JSON.parse(r.data as unknown as string)) as Task);
    const finished = tasks.filter(t => t.statusAndamento === 'Finalizado').length;
    const progress = tasks.length > 0 ? Math.round((finished / tasks.length) * 100) : 0;
    const status   = progress === 100 ? 'Finalizado' : progress > 0 ? 'Em andamento' : 'Não iniciado';
    await db`UPDATE projects SET progress = ${progress}, status = ${status}, updated_at = NOW() WHERE id = ${projectId}`;
  } catch (e) { logger.warn({ err: e }, '[db-kv] _syncProjectProgress error'); }
}

// ─── 9. PROJECTS — tabela dedicada ───────────────────────────────────────────
// Migração transparente: na primeira leitura, se a tabela projects estiver vazia,
// copia automaticamente do JSONB legado (project_state). JSONB original preservado.

export function slugify(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

async function readProjectsFromJsonb(db: Awaited<ReturnType<typeof getPg>>): Promise<Project[]> {
  try {
    const rows = await db<{ data: unknown }[]>`SELECT data FROM project_state WHERE key = 'state' LIMIT 1`;
    const raw = rows[0]?.data;
    const state = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const projects = (state as { projects?: Project[] })?.projects;
    return Array.isArray(projects) ? projects : [];
  } catch { return []; }
}

async function migrateProjectsIfNeeded(db: Awaited<ReturnType<typeof getPg>>): Promise<Project[]> {
  const [{ count }] = await db<{ count: string }[]>`SELECT COUNT(*) AS count FROM projects`;
  if (Number(count) > 0) return [];

  const projects = await readProjectsFromJsonb(db);
  if (projects.length === 0) return [];

  for (const p of projects) {
    try {
      await db`
        INSERT INTO projects (id, name, description, status, progress, banner)
        VALUES (${p.id}, ${p.name}, ${p.description ?? ''}, ${p.status ?? 'Não iniciado'}, ${p.progress ?? 0}, ${p.banner ?? ''})
        ON CONFLICT (id) DO NOTHING
      `;
    } catch (e) { logger.warn({ e }, '[db-kv] migrate project $ falhou:'); }
  }
  return projects;
}

/** Lê todos os empreendimentos. Fallback para JSONB se tabela vazia. */
export async function readProjects(): Promise<Project[]> {
  if (isPg()) {
    const db = await getPg();
    await migrateProjectsIfNeeded(db);
    const rows = await db<Project[]>`SELECT id, name, description, status, progress, banner FROM projects ORDER BY name`;
    if (rows.length === 0) return readProjectsFromJsonb(db);
    return rows;
  }
  return (readLocalProjectData()).projects;
}

/** Lê um empreendimento por ID. */
export async function readProjectById(id: string): Promise<Project | null> {
  if (isPg()) {
    const db = await getPg();
    const rows = await db<Project[]>`SELECT id, name, description, status, progress, banner FROM projects WHERE id = ${id} LIMIT 1`;
    return rows[0] ?? null;
  }
  const state = readLocalProjectData();
  return state.projects.find(p => p.id === id) ?? null;
}

/** Insere ou atualiza empreendimento. */
export async function upsertProject(project: Project): Promise<void> {
  if (isPg()) {
    const db = await getPg();
    await db`
      INSERT INTO projects (id, name, description, status, progress, banner)
      VALUES (${project.id}, ${project.name}, ${project.description ?? ''}, ${project.status ?? 'Não iniciado'}, ${project.progress ?? 0}, ${project.banner ?? ''})
      ON CONFLICT (id) DO UPDATE SET
        name        = EXCLUDED.name,
        description = EXCLUDED.description,
        status      = EXCLUDED.status,
        progress    = EXCLUDED.progress,
        banner      = EXCLUDED.banner,
        updated_at  = NOW()
    `;
    return;
  }
  await mutateProjectData(db => {
    const idx = db.projects.findIndex(p => p.id === project.id);
    if (idx >= 0) db.projects[idx] = project; else db.projects.push(project);
  });
}

/** Atualiza só o banner de um empreendimento (usado pelo upload de imagem). */
export async function setProjectBanner(id: string, bannerUrl: string): Promise<void> {
  if (isPg()) {
    const db = await getPg();
    await db`UPDATE projects SET banner = ${bannerUrl}, updated_at = NOW() WHERE id = ${id}`;
    return;
  }
  await mutateProjectData(db => {
    const proj = db.projects.find(p => p.id === id);
    if (proj) proj.banner = bannerUrl;
  });
}

// ─── 10. RESPONSIBLES — tabela dedicada ──────────────────────────────────────
// Migração transparente: na primeira leitura, se a tabela responsibles estiver vazia,
// copia automaticamente do JSONB legado (project_state). JSONB original preservado.

async function readResponsiblesFromJsonb(db: Awaited<ReturnType<typeof getPg>>): Promise<Responsible[]> {
  try {
    const rows = await db<{ data: unknown }[]>`SELECT data FROM project_state WHERE key = 'state' LIMIT 1`;
    const raw = rows[0]?.data;
    const state = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const responsibles = (state as { responsibles?: Responsible[] })?.responsibles;
    return Array.isArray(responsibles) ? responsibles : [];
  } catch { return []; }
}

async function migrateResponsiblesIfNeeded(db: Awaited<ReturnType<typeof getPg>>): Promise<Responsible[]> {
  const [{ count }] = await db<{ count: string }[]>`SELECT COUNT(*) AS count FROM responsibles`;
  if (Number(count) > 0) return [];

  const responsibles = await readResponsiblesFromJsonb(db);
  if (responsibles.length === 0) return [];

  for (const r of responsibles) {
    try {
      await db`
        INSERT INTO responsibles (id, name, phone, email, company, photo, photo_position)
        VALUES (${r.id}, ${r.name}, ${r.phone ?? ''}, ${r.email ?? ''}, ${r.company ?? ''}, ${r.photo ?? null}, ${(r.photoPosition ?? null) as never})
        ON CONFLICT (id) DO NOTHING
      `;
    } catch (e) { logger.warn({ e }, '[db-kv] migrate responsible $ falhou:'); }
  }
  return responsibles;
}

/** Lê todos os responsáveis. Fallback para JSONB se tabela vazia. */
export async function readResponsibles(): Promise<Responsible[]> {
  if (isPg()) {
    const db = await getPg();
    await migrateResponsiblesIfNeeded(db);
    const rows = await db<{ id: string; name: string; phone: string; email: string; company: string; photo: string | null; photo_position: PhotoPosition | null }[]>`
      SELECT id, name, phone, email, company, photo, photo_position FROM responsibles ORDER BY name
    `;
    if (rows.length === 0) return readResponsiblesFromJsonb(db);
    return rows.map(r => ({ id: r.id, name: r.name, phone: r.phone, email: r.email, company: r.company, photo: r.photo ?? undefined, photoPosition: r.photo_position ?? undefined }));
  }
  return (readLocalProjectData()).responsibles;
}

/** Gera próximo ID de responsável (resp-N). Race-safe com MAX no banco. */
export async function nextResponsibleId(): Promise<string> {
  if (isPg()) {
    const db = await getPg();
    await migrateResponsiblesIfNeeded(db);
    const rows = await db<{ max_id: string | null }[]>`
      SELECT MAX(CAST(REGEXP_REPLACE(id, '[^0-9]', '', 'g') AS INTEGER)) AS max_id FROM responsibles
    `;
    const max = Number(rows[0]?.max_id ?? 0);
    return `resp-${max + 1}`;
  }
  const state = readLocalProjectData();
  const max = state.responsibles.length > 0 ? Math.max(...state.responsibles.map(r => parseInt(r.id.replace('resp-', '')) || 0)) : 0;
  return `resp-${max + 1}`;
}

/** Insere ou atualiza responsável. */
export async function upsertResponsible(responsible: Responsible): Promise<void> {
  if (isPg()) {
    const db = await getPg();
    await db`
      INSERT INTO responsibles (id, name, phone, email, company, photo, photo_position)
      VALUES (${responsible.id}, ${responsible.name}, ${responsible.phone ?? ''}, ${responsible.email ?? ''}, ${responsible.company ?? ''}, ${responsible.photo ?? null}, ${(responsible.photoPosition ?? null) as never})
      ON CONFLICT (id) DO UPDATE SET
        name           = EXCLUDED.name,
        phone          = EXCLUDED.phone,
        email          = EXCLUDED.email,
        company        = EXCLUDED.company,
        photo          = EXCLUDED.photo,
        photo_position = EXCLUDED.photo_position,
        updated_at     = NOW()
    `;
    return;
  }
  await mutateProjectData(db => {
    const idx = db.responsibles.findIndex(r => r.id === responsible.id);
    if (idx >= 0) db.responsibles[idx] = responsible; else db.responsibles.push(responsible);
  });
}

/** Remove responsável. */
export async function deleteResponsible(id: string): Promise<boolean> {
  if (isPg()) {
    const db = await getPg();
    const rows = await db`DELETE FROM responsibles WHERE id = ${id} RETURNING id`;
    return rows.length > 0;
  }
  let found = false;
  await mutateProjectData(db => {
    const idx = db.responsibles.findIndex(r => r.id === id);
    if (idx >= 0) { found = true; db.responsibles.splice(idx, 1); }
  });
  return found;
}

// ─── 11. IMPORT DE PLANILHA — reconciliação relacional ───────────────────────

/**
 * Substitui projects/responsibles/tasks pelo conteúdo de uma importação de planilha
 * (mesma semântica de "a planilha é a nova verdade" que existia com o blob), mas via
 * upsert-and-reconcile relacional em vez de sobrescrever project_state.data inteiro.
 * Preserva banner/photo/photo_position que a planilha não carrega (não entram no
 * ON CONFLICT DO UPDATE). Ordem importa: tasks são limpas antes de remover projetos
 * órfãos, senão a FK tasks.project_id bloqueia o DELETE.
 */
export async function reconcileProjectVisionImport(state: ProjectDatabaseState): Promise<void> {
  if (!isPg()) {
    await writeProjectData(state);
    return;
  }
  const db = await getPg();

  await db.begin(async (tx) => {
    await tx`DELETE FROM tasks`;

    for (const p of state.projects) {
      await tx`
        INSERT INTO projects (id, name, description, status, progress, banner)
        VALUES (${p.id}, ${p.name}, ${p.description ?? ''}, ${p.status ?? 'Não iniciado'}, ${p.progress ?? 0}, ${p.banner ?? ''})
        ON CONFLICT (id) DO UPDATE SET
          name        = EXCLUDED.name,
          description = EXCLUDED.description,
          status      = EXCLUDED.status,
          progress    = EXCLUDED.progress,
          updated_at  = NOW()
      `;
    }
    const newProjectIds = state.projects.map(p => p.id);
    await (newProjectIds.length > 0
      ? tx`DELETE FROM projects WHERE id <> ALL(${newProjectIds})`
      : tx`DELETE FROM projects`);

    for (const r of state.responsibles) {
      await tx`
        INSERT INTO responsibles (id, name, phone, email, company)
        VALUES (${r.id}, ${r.name}, ${r.phone ?? ''}, ${r.email ?? ''}, ${r.company ?? ''})
        ON CONFLICT (id) DO UPDATE SET
          name       = EXCLUDED.name,
          phone      = EXCLUDED.phone,
          email      = EXCLUDED.email,
          company    = EXCLUDED.company,
          updated_at = NOW()
      `;
    }
    const newRespIds = state.responsibles.map(r => r.id);
    await (newRespIds.length > 0
      ? tx`DELETE FROM responsibles WHERE id <> ALL(${newRespIds})`
      : tx`DELETE FROM responsibles`);

    for (const t of state.tasks) {
      let projectId: string | null = null;
      if (t.project) {
        const rows = await tx<{ id: string }[]>`SELECT id FROM projects WHERE LOWER(name) = LOWER(${t.project}) LIMIT 1`;
        projectId = rows[0]?.id ?? null;
      }
      const taskToStore: Task = { ...t, projectId: projectId ?? undefined };
      await tx`
        INSERT INTO tasks (id, project, project_id, data, created_at, updated_at)
        VALUES (${t.id}, ${t.project ?? ''}, ${projectId}, ${JSON.stringify(taskToStore)}, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          project    = EXCLUDED.project,
          project_id = EXCLUDED.project_id,
          data       = EXCLUDED.data,
          updated_at = NOW()
      `;
    }
  });
}

// ─── 12. TASK DOCUMENTS — binário no Postgres ────────────────────────────────

/** Lista metadados dos anexos de uma tarefa (sem o conteúdo binário). */
export async function listTaskDocuments(taskId: string): Promise<TaskDocumentMeta[]> {
  if (!isPg()) return [];
  const db = await getPg();
  const rows = await db<TaskDocumentMeta[]>`
    SELECT id, task_id AS "taskId", name, category,
           content_type AS "contentType", size_bytes AS "sizeBytes",
           uploaded_by AS "uploadedBy", uploaded_at::text AS "uploadedAt", version
    FROM task_documents WHERE task_id = ${taskId} ORDER BY uploaded_at DESC
  `;
  return rows;
}

/** Busca conteúdo binário de um anexo. */
export async function getTaskDocumentData(docId: string): Promise<{ data: Buffer; contentType: string; name: string } | null> {
  if (!isPg()) return null;
  const db = await getPg();
  const rows = await db<{ data: Buffer; content_type: string; name: string }[]>`
    SELECT data, content_type, name FROM task_documents WHERE id = ${docId}
  `;
  if (!rows[0]) return null;
  return { data: rows[0].data, contentType: rows[0].content_type ?? 'application/octet-stream', name: rows[0].name };
}

/** Adiciona um anexo a uma tarefa. */
export async function addTaskDocument(meta: Omit<TaskDocumentMeta, 'uploadedAt'> & { data: Buffer }): Promise<void> {
  if (!isPg()) throw new Error('Anexos requerem Postgres');
  const db = await getPg();
  await db`
    INSERT INTO task_documents (id, task_id, name, category, content_type, size_bytes, data, uploaded_by, version)
    VALUES (${meta.id}, ${meta.taskId}, ${meta.name}, ${meta.category}, ${meta.contentType ?? null},
            ${meta.sizeBytes ?? null}, ${meta.data}, ${meta.uploadedBy}, ${meta.version ?? 1})
  `;
}

/** Remove um anexo de tarefa. */
export async function deleteTaskDocument(docId: string, taskId: string): Promise<boolean> {
  if (!isPg()) return false;
  const db = await getPg();
  const result = await db`DELETE FROM task_documents WHERE id = ${docId} AND task_id = ${taskId}`;
  return result.count > 0;
}
