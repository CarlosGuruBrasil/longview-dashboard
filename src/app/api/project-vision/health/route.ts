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
        AND tablename IN ('tasks','task_documents','project_state','project_banners','projects','responsibles')
    `;
    const found = tables.map(r => r.tablename);
    for (const t of ['tasks', 'task_documents', 'project_state', 'projects', 'responsibles']) {
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
    const [row] = await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM projects`;
    checks.push({ name: 'projects:count', ok: Number(row.count) > 0, detail: `${row.count} empreendimentos` });
  } catch (e: unknown) {
    checks.push({ name: 'projects:count', ok: false, detail: e instanceof Error ? e.message : String(e) });
  }

  try {
    const [row] = await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM tasks WHERE project_id IS NULL AND project <> ''`;
    checks.push({ name: 'tasks:orphan_project_id', ok: Number(row.count) === 0, detail: `${row.count} tarefas sem project_id` });
  } catch (e: unknown) {
    checks.push({ name: 'tasks:orphan_project_id', ok: false, detail: e instanceof Error ? e.message : String(e) });
  }

  try {
    const indexes = await sql<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'tasks'
        AND indexname IN ('tasks_project_idx','tasks_status_idx','tasks_responsible_idx','tasks_project_id_idx')
    `;
    checks.push({ name: 'tasks:indexes', ok: indexes.length === 4, detail: `${indexes.length}/4 indices` });
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
