// Migração one-shot: move projects[]/responsibles[] do blob JSONB (project_state.data,
// key='state') pra tabelas relacionais dedicadas (projects, responsibles), e resolve
// tasks.project_id (FK real, ver src/lib/pg.ts) a partir do texto livre tasks.project,
// por match de nome case-insensitive.
//
// Contexto: projects/responsibles viviam só dentro do blob project_state — sem FK, sem
// unicidade, com lock de escrita no blob inteiro (foi a causa raiz do bug "banner do
// empreendimento não salva"). tasks já tinha sido migrado antes pra tabela própria; esta
// migração completa o trabalho e resolve tasks.project (texto livre) → project_id.
//
// Tarefas cujo `project` não bate com nenhum Project existente (ex: o default 'Geral')
// ganham um Project placeholder criado automaticamente, pra garantir 100% de FK coverage.
//
// NÃO apaga project_state.data.projects/.responsibles — o blob original fica intacto
// como rede de segurança pro rollback (ver plano de migração).
//
// Rodar contra staging primeiro:
//   ENV_FILE=.env.staging npx tsx scripts/migrate-project-vision-relational.ts
// Depois, validado, contra produção (usa .env.local por padrão):
//   npx tsx scripts/migrate-project-vision-relational.ts
//
// Idempotente — ON CONFLICT DO NOTHING / WHERE guards, seguro rodar mais de uma vez.

import fs from 'fs';
import path from 'path';
import { sql, ensureSchema } from '../src/lib/pg';

const envFile = process.env.ENV_FILE || '.env.local';
try {
  const envPath = path.join(process.cwd(), envFile);
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const m = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  });
} catch { /* usa process.env já setado */ }

if (!process.env.DATABASE_URL) { console.error(`DATABASE_URL não encontrada em ${envFile}`); process.exit(1); }
console.log(`[migrate] usando ${envFile} → banco: ${process.env.DATABASE_URL.split('@')[1]}`);

function slugify(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

interface BlobProject { id: string; name: string; description?: string; status?: string; progress?: number; banner?: string; }
interface BlobResponsible { id: string; name: string; phone?: string; email?: string; company?: string; photo?: string; }

async function main() {
  await ensureSchema();

  // 1. Ler blob project_state (defensivo — pode vir double-encoded como string)
  const rows = await sql<{ data: unknown }[]>`SELECT data FROM project_state WHERE key = 'state'`;
  const raw = rows[0]?.data;
  const state = (typeof raw === 'string' ? JSON.parse(raw) : raw) as { projects?: BlobProject[]; responsibles?: BlobResponsible[] } | undefined;
  const blobProjects = Array.isArray(state?.projects) ? state!.projects! : [];
  const blobResponsibles = Array.isArray(state?.responsibles) ? state!.responsibles! : [];
  console.log(`[migrate] blob: ${blobProjects.length} projects, ${blobResponsibles.length} responsibles`);

  // 2. Upsert projects do blob
  const [{ count: projectsBefore }] = await sql<{ count: string }[]>`SELECT COUNT(*)::int AS count FROM projects`;
  for (const p of blobProjects) {
    await sql`
      INSERT INTO projects (id, name, description, status, progress, banner)
      VALUES (${p.id}, ${p.name}, ${p.description ?? ''}, ${p.status ?? 'Não iniciado'}, ${p.progress ?? 0}, ${p.banner ?? ''})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  const [{ count: projectsAfter }] = await sql<{ count: string }[]>`SELECT COUNT(*)::int AS count FROM projects`;
  console.log(`[migrate] projects: ${projectsBefore} → ${projectsAfter}`);

  // 3. Upsert responsibles do blob (photo_position fica NULL — o blob nunca teve isso persistido)
  const [{ count: respBefore }] = await sql<{ count: string }[]>`SELECT COUNT(*)::int AS count FROM responsibles`;
  for (const r of blobResponsibles) {
    await sql`
      INSERT INTO responsibles (id, name, phone, email, company, photo)
      VALUES (${r.id}, ${r.name}, ${r.phone ?? ''}, ${r.email ?? ''}, ${r.company ?? ''}, ${r.photo ?? null})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  const [{ count: respAfter }] = await sql<{ count: string }[]>`SELECT COUNT(*)::int AS count FROM responsibles`;
  console.log(`[migrate] responsibles: ${respBefore} → ${respAfter}`);

  // 4. Tarefas órfãs — project (texto) sem match em nenhum Project → cria placeholder
  const orphans = await sql<{ project: string }[]>`
    SELECT DISTINCT project FROM tasks
    WHERE project <> '' AND LOWER(project) NOT IN (SELECT LOWER(name) FROM projects)
  `;
  if (orphans.length > 0) {
    console.log(`[migrate] ${orphans.length} nomes de projeto órfãos em tasks.project — criando placeholders:`, orphans.map(o => o.project));
    for (const { project: name } of orphans) {
      const id = slugify(name) || `orfao-${Date.now()}`;
      await sql`
        INSERT INTO projects (id, name, description, status, progress, banner)
        VALUES (${id}, ${name}, 'Criado automaticamente durante migração — projeto órfão referenciado por tarefas legadas.', 'Não iniciado', 0, '')
        ON CONFLICT (id) DO NOTHING
      `;
    }
  } else {
    console.log('[migrate] nenhuma tarefa órfã encontrada');
  }

  // 5. Backfill tasks.project_id por match de nome (idempotente via WHERE project_id IS NULL)
  const backfill = await sql`
    UPDATE tasks t SET project_id = p.id
    FROM projects p
    WHERE t.project_id IS NULL AND t.project <> '' AND LOWER(t.project) = LOWER(p.name)
  `;
  console.log(`[migrate] tasks.project_id preenchido em ${backfill.count} linhas`);

  const [{ count: stillNull }] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::int AS count FROM tasks WHERE project_id IS NULL AND project <> ''
  `;
  if (Number(stillNull) > 0) {
    const bad = await sql<{ id: string; project: string }[]>`SELECT id, project FROM tasks WHERE project_id IS NULL AND project <> '' LIMIT 20`;
    console.error(`[migrate] ABORTANDO: ${stillNull} tarefas ainda sem project_id após backfill:`, bad);
    await sql.end();
    process.exit(1);
  }
  console.log('[migrate] todas as tarefas com project (texto) não-vazio têm project_id — ok');

  // 6. Diagnóstico de project_banners órfãos antes de aplicar a FK
  const orphanBanners = await sql<{ project_id: string }[]>`
    SELECT project_id FROM project_banners WHERE project_id NOT IN (SELECT id FROM projects)
  `;
  if (orphanBanners.length > 0) {
    console.error('[migrate] project_banners com project_id órfão — FK NÃO aplicada, resolva manualmente:', orphanBanners);
  } else {
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_banners_project_id_fkey') THEN
          ALTER TABLE project_banners
            ADD CONSTRAINT project_banners_project_id_fkey
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `;
    console.log('[migrate] FK project_banners.project_id → projects.id aplicada (ou já existia)');
  }

  // 7. Resumo final
  const [{ count: finalProjects }] = await sql<{ count: string }[]>`SELECT COUNT(*)::int AS count FROM projects`;
  const [{ count: finalResp }] = await sql<{ count: string }[]>`SELECT COUNT(*)::int AS count FROM responsibles`;
  const [{ count: tasksWithFk }] = await sql<{ count: string }[]>`SELECT COUNT(*)::int AS count FROM tasks WHERE project_id IS NOT NULL`;
  const [{ count: tasksTotal }] = await sql<{ count: string }[]>`SELECT COUNT(*)::int AS count FROM tasks`;
  console.log('\n=== RESUMO ===');
  console.log(`projects: ${finalProjects}`);
  console.log(`responsibles: ${finalResp}`);
  console.log(`tasks com project_id: ${tasksWithFk}/${tasksTotal}`);
  console.log('project_state.data (blob) NÃO foi alterado — permanece intacto como rollback.');

  await sql.end();
}

main().catch(e => { console.error('ERRO:', e); process.exit(1); });
