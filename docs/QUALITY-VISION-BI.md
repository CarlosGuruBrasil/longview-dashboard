# Quality Vision BI — Plano e Progresso

> Registro de continuidade: se esta sessão parar, outra IA continua daqui.
> Contexto completo: memória `construpoint-quality-vision.md` + este arquivo.

## Objetivo (pedido do Carlos, 2026-07-03)

Replicar o painel Power BI "Painel Construpoint - Nautic_rev00" (PDF em ~/Downloads) dentro do app,
com dados do nosso Postgres (`construpoint_inspecoes` / `construpoint_verificacoes`):

1. Painel com filtros manipuláveis (Tipo do Modelo/disciplina 0-9, Modelo, Código, Local n1-n4, obra, status, período)
2. KPIs: FVS Mapeadas (= todas as linhas), FVS Realizadas (= status 'Aceito'), % realizada (gauge)
3. Página "Modelo": barras por modelo com contagem por status (Mapeadas/Aceita/Agendada/Em Andamento/Pendente Aprovação) + tabela detalhe (Modelo, Código, Local n1-n4)
4. Página "Local": barras Mapeada×Realizada por Local n1
5. Alertas do painel Inteligência clicáveis → direcionam pra tela filtrada no problema
6. Gerar PDF com layout igual ao do Power BI (rota de impressão + window.print)
7. Sync incremental a cada 15min (webhook Construpoint não existe na doc deles — Carlos vai perguntar ao suporte e-Construmarket; nosso receptor /api/webhooks/construpoint já está pronto)

## Fatos descobertos (não redescobrir)

- `construpoint_inspecoes` É a mesma base do PBIX ("FVS Mapeamento"): validado — Instalação de Janelas 238, Guarda-corpo 208, idênticos ao PDF
- Mapeadas = count(*); Realizadas = count Aceito; gauge % = Aceito/total
- Local n1-n4 = raw->>'Nivel1'..'Nivel4' (~24% sem Nivel1 — é assim na origem, PBIX também tem "(Em branco)")
- "Tipo do Modelo" (0-TERRENO … 9-IMPERMEABILIZAÇÕES) NÃO vem da API — é de-para mantido à mão → tabela `construpoint_disciplinas`
- Statuses reais: Aceito, Agendado, Em Andamento, Pendente Aprovação, Recusado, Pendente Reinspeção
- Obras: Nautic (5463), Hub Beira-Mar (1365), LongView (125)

## Checklist de execução

- [x] 1. pg.ts: colunas nivel1..nivel4 + tabela construpoint_disciplinas (seed por pattern-matching de nome)
- [x] 2. Backfill nivel1..4 do raw via SQL (feito direto no banco, 2026-07-03)
- [x] 3. sync-construpoint: gravar niveis + modo ?mode=incremental (janela mês corrente)
- [x] 4. API GET /api/construpoint/panel — KPIs + porModelo + porLocal + tabela paginada + opções de filtro, tudo filtrável
- [x] 5. Página /quality-vision/painel (abas Modelo|Local, layout do PDF, filtros, tabela, botão Gerar PDF via print CSS)
- [x] 6. Alertas de /quality-vision/inteligencia clicáveis (link com filtros pra /quality-vision/painel e /quality-vision/inspecoes)
- [x] 7. Coolify: scheduled task sync incremental 15min — CRIADO via API (uuid ver abaixo)
- [x] 8. tsc + build + commit + push (deploy automático via webhook)

## Decisões

- Disciplinas seed: pattern matching nos nomes dos modelos existentes (ex: %Alvenaria%→2, %Impermeabiliz%→9). Editável depois via SQL/admin.
- PDF: rota de impressão com @media print (sem Puppeteer — só se precisarem de PDF server-side pra e-mail)
- Sync 15min: reaproveita o mesmo route com ?mode=incremental (BeginDate = dia 1 do mês corrente; upsert cobre atualizações de status)
