# Checkpoint — LongView Dashboard — 2026-07-02 (Parte 3)

> **Contexto**: Sessão focada em transformar o Marketing Vision em plataforma integrada de inteligência (Meta Ads × CRM × CVDW). O usuário está frustrado por não conseguir ver etapas do CRM, filtrar campanhas por data/leads, e encontrar dados dos clientes.

---

## Estado Atual

- `npx tsc --noEmit`: **0 errors**
- `npm run lint`: **0 errors, 1 warning** (`<img>` em IntelligenceView.tsx — URL externa dinâmica)
- Sidebar: **6 itens** — Dashboard, Leads, Vendas, Métricas, **Inteligência (novo)**, Marketing
- Mobile bottom nav: 5 itens (Inteligência está só no drawer "Mais")
- 5 views ativas no ViewRouter: dashboard, leads, vendas, metrics, marketing, intelligence

---

## O Que Foi Feito Nesta Sessão

### Fase 1 — UI Fixes
- **Unused imports**: MarketingVisionApp.tsx reduzido de 13 lazy imports para 5 (Dashboard, Leads, Vendas, Metrics, Marketing). Mortos removidos de DashboardView.tsx, insights.ts, sync-cv-estoque/route.ts.
- **Grid 8-col**: MarketingAdsView dividido em 2 linhas de 4 colunas.
- **Overflow**: KpiCard.tsx e SmartKpi ganharam `overflow-hidden` + `min-w-0`.
- **FilterBar**: Componente removido do AppShell e colocado dentro de LeadsView, VendasView, MetricsView.
- **Campaign sorting**: Ativas primeiro, depois por campo selecionado. Botão toggle "Só ativas"/"Todas".

### Fase 2 — Marketing Intelligence API
- **`POST /api/bi/intelligence`**: Lê Meta cache do `project_state`, leads CRM e vendas CVDW do Postgres em tempo real.
- Retorna: campaign attribution (spend × leads × sales × revenue × ROAS), development intelligence, channel performance, social media posts (FB + IG), audience demographics, investment recommendations.
- Usa heuristic matching (campaign name × lead origin). 8s timeout para Graph API.

### Fase 3 — IntelligenceView
- **Novo arquivo**: `src/app/marketing-vision/components/views/IntelligenceView.tsx`
- 4 abas: Campanhas × ROAS, Redes Sociais, Público, Empreendimentos
- Summary KPIs (investimento, leads, vendas, ROAS geral)
- Recomendações de investimento (escalar/pausar/canais/oportunidades)
- Tabela de campanhas ordenável por ROAS/gasto/leads
- Performance por canal (origem)
- Posts de redes sociais com engajamento
- Demográfico por gênero/idade
- Performance por empreendimento (VGV, ticket, conversão, ciclo)

### FunnelVisualization (CRM Pipeline)
- **Novo arquivo**: `src/app/marketing-vision/components/ui/FunnelVisualization.tsx`
- Substituiu `StageSummary` no LeadsView
- Mostra as 6 etapas do CV CRM: Novos Leads, Em Atendimento, Visita Agendada, Visita Realizada, Com Proposta, Venda Realizada
- Cada etapa: contagem, % do total, taxa de conversão da etapa anterior
- Barras horizontais proporcionais com cores por estágio
- Usa `getLeadStage()`, `isComProposta()`, `isSale()` para classificação
- Filtra leads perdidos (`isLoss`) do funil

---

## Arquivos Modificados/Criados

### Criados:
| Arquivo | Propósito |
|---|---|
| `src/app/api/bi/intelligence/route.ts` | API que cruza Meta × CRM × CVDW em tempo real |
| `src/app/marketing-vision/components/views/IntelligenceView.tsx` | View de inteligência com 4 abas |
| `src/app/marketing-vision/components/ui/FilterBar.tsx` | Filtros reutilizáveis (origem, situação, projeto) |
| `src/app/marketing-vision/components/ui/FunnelVisualization.tsx` | Funil CRM com 6 etapas + conversão |

### Modificados:
| Arquivo | Mudança |
|---|---|
| `MarketingVisionApp.tsx` | Lazy import removidos (13→5); intelligence adicionado ao viewMap |
| `AppShell.tsx` | VIEW_TITLES + DRAWER_NAV com intelligence; import Lightbulb |
| `Sidebar.tsx` | 6 itens (Dashboard, Leads, Vendas, Métricas, Inteligência, Marketing) |
| `types/index.ts` | ActiveView ganhou `'intelligence'` |
| `LeadsView.tsx` | StageSummary → FunnelVisualization |
| `MarketingAdsView.tsx` | Status filter toggle + search + sort |
| `MetricsView.tsx` | FilterBar adicionado (já tem KpiGaugeHistoryCard com toggle taxa/bruto, granularidade, média móvel) |
| `VendasView.tsx` | FilterBar adicionado |
| `DashboardView.tsx` | type any removidos |
| `KpiCard.tsx` | overflow-hidden + min-w-0 |
| Vários charts | tipos any removidos (GrowthLineChart, SalesGrowthChart, PieDonutChart, etc.) |

---

## Problemas Conhecidos (Input do Usuário)

1. **"Como eu filtro as campanhas ativas, por data? por quantidade de leads?"**
   - MarketingAdsView tem filtro de status (Todas/Só ativas) e busca por nome, mas **não tem filtro por data** nem **coluna de leads do CRM**
   - Pendente: adicionar date range filter + coluna "Leads no CRM" na tabela de campanhas

2. **"Cad os clientes do cv crm???"**
   - LeadsView > aba "Leads CRM" mostra a tabela paginada de leads
   - Possível causa: dados não carregam rápido o suficiente, ou faltou contexto visual
   - Pendente: verificar se a paginação está funcionando e se o total de leads aparece

3. **"Cade as etapas do cv crm??"**
   - ✅ **Resolvido**: FunnelVisualization substituiu StageSummary, mostrando as 6 etapas limpas

4. **"Você piorou o projeto!"**
   - Causa raiz: mover filtros do AppShell para dentro das views pode ter confundido (FilterBar + DateFilter separados)
   - Pendente: verificar se FilterBar + DateFilter estão visíveis e funcionais

---

## Pendências para Próxima Sessão

### Prioridade Alta
1. **MarketingAdsView**: Adicionar filtro de data (date range) + coluna "Leads CRM" (contagem de leads do CRM para cada campanha)
2. **Verificar DataContext**: Confirmar que `filteredLeads` reflete corretamente o date range + leadFilters
3. **Verificar carregamento de leads**: A paginação SQL está funcionando? O total de leads aparece corretamente?

### Prioridade Média
4. **Credentials expostas**: PDF `PROJETO GUI LONGVIEW.pdf` contém credenciais hardcoded (adminapi_longview@e-construmarket.com.br / *GSuG8U8 + Basic Auth). Remover do git.
5. **Coolify deploy**: GitHub pushes feitos, mas servidor ainda retorna 404 para `/api/cron/sync-bi` e `/api/bi/intelligence`
6. **StageSummary.tsx**: Não está mais em uso. Pode ser removido ou mantido como backup.
7. **IntelligenceView `<img>`**: Substituir por `next/image` com `unoptimized` (URL externa dinâmica)

### Prioridade Baixa
8. Remover import `StageSummary` de onde não é mais usado (já foi trocado por FunnelVisualization)

---

## Sugestão de Prompt para Nova IA

```text
Continue o LongView Dashboard a partir de docs/session-checkpoint-2026-07-02-parte3.md.
Estado: tsc 0 errors, lint 0 errors (1 warning).
Sidebar tem 6 itens; IntelligenceView e FunnelVisualization foram criados.

O USUÁRIO RECLAMOU de 3 coisas que PRECISAM SER RESOLVIDAS PRIMEIRO:
1. MarketingAdsView não tem filtro por data nem coluna "Leads CRM"
2. Clientes do CRM não aparecem de forma clara (verificar paginação/carregamento)
3. (Já resolvido) Etapas do CRM agora aparecem no FunnelVisualization

Comece resolvendo os itens 1 e 2, depois verifique se FilterBar + DateFilter estão visíveis.
NÃO crie componentes novos sem antes ler os existentes.
```

---

## Comandos de Verificação

```bash
npx tsc --noEmit
npm run lint
```

Use `git log --oneline -20` para ver o histórico completo dos commits desta sessão.
