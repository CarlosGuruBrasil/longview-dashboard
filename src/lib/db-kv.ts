import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { createDefaultPermissions, normalizePermissions, type UserPermissions } from './permissions';

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

/** Campos de perfil RH — armazenados em data JSONB via writeUsers */
export interface UserProfileData {
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
  id: string; project: string; sector: string; subject: string; description: string;
  responsible: string; secondaryResponsibles: string[]; statusContratacao: string;
  statusAndamento: 'Não iniciado' | 'Em andamento' | 'Aguardando' | 'Em análise' | 'Finalizado';
  urgencia: 'Baixa' | 'Média' | 'Alta' | 'Crítica' | 'Emergencial';
  inicio: string; previsaoEntrega: string; entregaEfetiva: string;
  situacao: string; observacoesRotinas: string; progress: number;
  subtasks: Subtask[]; comments: Comment[]; documents: Document[];
  logs: ChangeLog[]; dependencies: string[]; tags: string[];
}

export interface Project { id: string; name: string; description: string; status: string; progress: number; banner: string; }
export interface Responsible { id: string; name: string; phone: string; email: string; company: string; photo?: string; }
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

// ─── 1. USUÁRIOS ─────────────────────────────────────────────────────────────

export async function readUsers(): Promise<DbUser[]> {
  const normalizeUser = (user: DbUser): DbUser => ({
    ...user,
    permissions: normalizePermissions(user.permissions),
  });

  if (isPg()) {
    try {
      const db = await getPg();
      const rows = await db<{ data: DbUser }[]>`SELECT data FROM app_users ORDER BY created_at`;
      // `data` column stores the full DbUser JSON
      return rows.map(r => normalizeUser(typeof r.data === 'object' ? r.data : JSON.parse(r.data as unknown as string)));
    } catch (e) { console.error('[db-kv] readUsers PG error:', e); }
  }
  return readJson<DbUser[]>(LOCAL_USERS_FILE, []).map(normalizeUser);
}

export async function writeUsers(users: DbUser[]): Promise<void> {
  const normalizedUsers = users.map(user => ({
    ...user,
    permissions: normalizePermissions(user.permissions),
  }));

  if (isPg()) {
    try {
      const db = await getPg();
      // upsert all — delete orphans via NOT IN
      if (normalizedUsers.length === 0) {
        await db`DELETE FROM app_users`;
        return;
      }
      for (const u of normalizedUsers) {
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
      }
      const ids = normalizedUsers.map(u => u.id);
      await db`DELETE FROM app_users WHERE id <> ALL(${ids}::text[])`;
      return;
    } catch (e) { console.error('[db-kv] writeUsers PG error:', e); }
  }
  writeJson(LOCAL_USERS_FILE, normalizedUsers);
}

// ─── 2. PROJECT VISION (tasks + projetos) ────────────────────────────────────

export async function readProjectData(): Promise<ProjectDatabaseState> {
  if (isPg()) {
    try {
      const db = await getPg();
      const rows = await db<{ data: ProjectDatabaseState }[]>`
        SELECT data FROM project_state WHERE key = 'state'
      `;
      const pgState = normalizeProjectState(rows[0]?.data);
      if (hasProjectVisionData(pgState)) return pgState;

      const seededState = readLocalProjectData();
      if (hasProjectVisionData(seededState)) {
        await db`
          INSERT INTO project_state (key, data) VALUES ('state', ${JSON.stringify(seededState)})
          ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data
        `;
        return seededState;
      }
    } catch (e) { console.error('[db-kv] readProjectData PG error:', e); }
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
    } catch (e) { console.error('[db-kv] writeProjectData PG error:', e); }
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
      let state: ProjectDatabaseState = normalizeProjectState(rows[0]?.data);
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
  const users = await readUsers();
  if (users.length === 0) {
    console.log('[db-kv] Semeando usuários padrão...');
    const [developerHash, diretoriaHash] = await Promise.all([
      bcrypt.hash('Guru$2026', 10),
      bcrypt.hash('Longview$2026', 10),
    ]);

    const allPerms = createDefaultPermissions({
      viewMarketingDashboard: true, viewMarketingLeads: true, viewMarketingOportunidades: true,
      viewMarketingEstoque: true, viewMarketingAds: true, viewMarketingVendas: true,
      viewProjectVision: true, manageProjects: true, manageCommentsDocs: true,
      deleteTasks: true, viewRHVision: true, viewQualityVision: true, isAdmin: true,
    });

    await writeUsers([
      { id: 'usr-dev',   name: 'Carlos Santos (Desenvolvedor)', email: 'carlos@longview.com.br',   passwordHash: developerHash, role: 'Desenvolvedor', permissions: allPerms, createdAt: new Date().toISOString() },
      { id: 'usr-admin', name: 'Diretoria Executiva',           email: 'diretoria@longview.com.br', passwordHash: diretoriaHash, role: 'Diretoria',    permissions: allPerms, createdAt: new Date().toISOString() },
    ]);
  }

  // import tasks from legacy CSV if nothing in project state
  const proj = await readProjectData();
  if (!hasProjectVisionData(proj)) {
    const local = readLocalProjectData();
    if (hasProjectVisionData(local)) {
      await writeProjectData(local);
    }
  }
}

// ─── 4. LINKS ────────────────────────────────────────────────────────────────

export async function readLinks(): Promise<ShortLink[]> {
  if (isPg()) {
    try {
      const db = await getPg();
      const rows = await db<ShortLink[]>`
        SELECT slug, url, title, active, created_at AS "createdAt", created_by AS "createdBy"
        FROM short_links ORDER BY created_at DESC
      `;
      return rows;
    } catch (e) { console.error('[db-kv] readLinks PG error:', e); }
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
    } catch (e) { console.error('[db-kv] writeLinks PG error:', e); }
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
    } catch (e) { console.error('[db-kv] incrClick PG error:', e); }
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
    } catch (e) { console.error('[db-kv] getClicks PG error:', e); }
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
    } catch (e) { console.error('[db-kv] delClick PG error:', e); }
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
      if (rows.length > 0) return rows[0].data as T;
      return fallback;
    } catch (e) { console.error(`[db-kv] readKv(${key}) error:`, e); }
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
    } catch (e) { console.error(`[db-kv] writeKv(${key}) error:`, e); }
  }
  const store = readJson<Record<string, unknown>>(LOCAL_KV_FILE, {});
  store[key]  = value;
  writeJson(LOCAL_KV_FILE, store);
}
