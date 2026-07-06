// Migração one-shot: corrige o raw duplamente codificado (jsonb string → objeto)
// e preenche as colunas status/empreendimento/origem a partir do raw.
//
// Contexto: os writers antigos passavam JSON.stringify(obj) num parâmetro que o
// postgres.js já serializa para jsonb — resultado: todo raw virou string JSON.
// Consequência: 3.827/3.852 leads com status NULL, todas as queries SQL raw->>
// retornando NULL. Writers corrigidos em jul/2026; esta migração conserta o legado.
//
// Rodar:  npx tsx scripts/migrate-fix-leads-raw.ts
// Idempotente — só toca linhas ainda erradas.

import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
const env: Record<string, string> = {};
try {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const m = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
} catch { /* usa process.env */ }

const DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL não encontrada'); process.exit(1); }

const sql = postgres(DATABASE_URL, { max: 2, idle_timeout: 10 });

async function main() {
  // 1. Re-encoda raw string → objeto (leads, cv_empreendimentos, cv_unidades, project_state)
  for (const t of ['leads', 'cv_empreendimentos', 'cv_unidades', 'cv_vendas']) {
    const r = await sql.unsafe(`
      UPDATE ${t} SET raw = (raw #>> '{}')::jsonb
      WHERE jsonb_typeof(raw) = 'string'`);
    console.log(`${t}.raw re-encodado:`, r.count);
  }
  const ps = await sql`
    UPDATE project_state SET data = (data #>> '{}')::jsonb
    WHERE jsonb_typeof(data) = 'string'`;
  console.log('project_state.data re-encodado:', ps.count);

  // 2. Backfill das colunas dos leads a partir do raw
  const st = await sql`
    UPDATE leads SET status = raw->'situacao'->>'nome'
    WHERE (status IS NULL OR status = '') AND raw->'situacao'->>'nome' IS NOT NULL`;
  console.log('leads.status backfilled:', st.count);

  const emp = await sql`
    UPDATE leads SET empreendimento = COALESCE(raw->'empreendimento'->0->>'nome', NULLIF(raw->>'empreendimento',''))
    WHERE (empreendimento IS NULL OR empreendimento = '')
      AND (raw->'empreendimento'->0->>'nome' IS NOT NULL OR NULLIF(raw->>'empreendimento','') IS NOT NULL)`;
  console.log('leads.empreendimento backfilled:', emp.count);

  const org = await sql`
    UPDATE leads SET origem = raw->>'origem'
    WHERE (origem IS NULL OR origem = '') AND raw->>'origem' IS NOT NULL`;
  console.log('leads.origem backfilled:', org.count);

  // 3. Verificação
  const check = await sql`SELECT status, COUNT(*)::int AS n FROM leads GROUP BY 1 ORDER BY 2 DESC LIMIT 10`;
  console.log('\nSTATUS pós-migração:');
  check.forEach(r => console.log(' ', r.status, '=', r.n));

  await sql.end();
}
main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
