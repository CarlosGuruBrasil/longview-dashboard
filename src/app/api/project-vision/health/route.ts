/**
 * GET /api/project-vision/health
 * Valida todas as dependências críticas do módulo Project Vision.
 * Usar após qualquer deploy para confirmar que nada quebrou.
 */
import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/pg';
import { PROJECT_VISION_CONTRACT_VERSION } from '@/lib/project-vision-contract';

interface Check { name: string; ok: boolean; detail?: string; }

export async function GET() {
  const checks: Check[] = [];
  const start = Date.now();

  try {
    await ensureSchema();
    const tables = await sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('tasks','task_documents','project_state','project_banners')
    `;
    const found = tables.map(r => r.tablename);
    for (const t of ['tasks', 'task_documents', 'project_state']) {
      checks.push({ name: `table:${t}`, ok: found.includes(t), detail: found.includes(t) ? 'existe' : 'NAO ENCONTRADA' });
    }
  } catch (e: unknown) {
    checks.push({ name: 'schema', ok: false, detail: e instanceof Error ? e.message : String(e) });
  }

  try {
    const [row] = await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM tasks`;
    checks.push({ name: 'tasks:count', ok: true, detail: `${row.count} tarefas` });
  } catch (e: unknown) {
    checks.push({ name: 'tasks:count', ok: false, detail: e instanceof Error ? e.message : String(e) });
  }

  try {
    const [row] = await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM task_documents`;
    checks.push({ name: 'task_documents:count', ok: true, detail: `${row.count} documentos` });
  } catch (e: unknown) {
    checks.push({ name: 'task_documents:count', ok: false, detail: e instanceof Error ? e.message : String(e) });
  }

  try {
    const rows = await sql<{ data: { projects?: unknown[] } }[]>`
      SELECT data FROM project_state WHERE key = 'state' LIMIT 1
    `;
    const projects = rows[0]?.data?.projects;
    const count = Array.isArray(projects) ? projects.length : 0;
    checks.push({ name: 'project_state:projects', ok: count > 0, detail: `${count} empreendimentos` });
  } catch (e: unknown) {
    checks.push({ name: 'project_state:projects', ok: false, detail: e instanceof Error ? e.message : String(e) });
  }

  try {
    const indexes = await sql<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'tasks'
        AND indexname IN ('tasks_project_idx','tasks_status_idx','tasks_responsible_idx')
    `;
    checks.push({ name: 'tasks:indexes', ok: indexes.length === 3, detail: `${indexes.length}/3 indices` });
  } catch (e: unknown) {
    checks.push({ name: 'tasks:indexes', ok: false, detail: e instanceof Error ? e.message : String(e) });
  }

  const allOk   = checks.every(c => c.ok);
  const elapsed = Date.now() - start;

  return NextResponse.json({
    ok: allOk,
    contract: PROJECT_VISION_CONTRACT_VERSION,
    elapsed: `${elapsed}ms`,
    checks,
  }, { status: allOk ? 200 : 503 });
}
