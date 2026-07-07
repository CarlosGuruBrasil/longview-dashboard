import { sql } from '@/lib/pg'

async function main() {
  const statuses = await sql`
    SELECT status, COUNT(*)::int as total
    FROM leads
    GROUP BY status
    ORDER BY total DESC
    LIMIT 30
  `
  console.log('\n=== STATUS NA TABELA LEADS ===')
  for (const r of statuses) console.log(`  "${r.status}" → ${r.total}`)

  const etapas = await sql`SELECT nome, ordem FROM funil_etapas ORDER BY ordem LIMIT 20`
  console.log('\n=== FUNIL ETAPAS ===')
  for (const r of etapas) console.log(`  [${r.ordem}] ${r.nome}`)

  const vendas = await sql`
    SELECT raw->>'situacao' AS situacao, COUNT(*)::int as total
    FROM cv_vendas
    GROUP BY raw->>'situacao'
    ORDER BY total DESC LIMIT 10
  `
  console.log('\n=== CV_VENDAS situacao ===')
  for (const r of vendas) console.log(`  "${r.situacao}" → ${r.total}`)

  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
