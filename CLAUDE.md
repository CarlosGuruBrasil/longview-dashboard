# Longview Dashboard - Status & History

Este arquivo serve como o ponto único de verdade para que o Claude, Antigravity ou outros agentes saibam a situação atual do projeto, comandos de build e histórico de modificações ativas.

**IMPORTANTE: Sempre que você fizer modificações neste projeto, atualize este arquivo registrando suas alterações no final da seção "Histórico de Modificações".**

---

## Comandos Úteis do Projeto
- **Compilação TypeScript local:** `npx tsc --noEmit`
- **Build de Produção local:** `npm run build`
- **Servidor de Desenvolvimento local:** `npm run dev`

---

## Variáveis de Ambiente Configuradas (Hetzner / Coolify)
As seguintes variáveis estão ativas e configuradas no painel da aplicação no Coolify (`https://app.guru.dev.br`):
- `DATABASE_URL`: Conexão com o banco Postgres de produção da Hetzner.
- `CV_CRM_EMAIL` & `CV_CRM_TOKEN`: Integração com o CRM da Longview.
- `META_TOKEN` & `META_ACT_ID`: Acesso à API de Anúncios e Audiências do Meta.
- `RD_TOKEN_PUBLIC` & `RD_TOKEN_PRIVATE`: Integração com a API do RD Station.
- `RD_REDIRECT_URI`: Definida como `https://app.guru.dev.br/api/rd/callback`.

---

## Onde Paramos & Estado Atual
- As conexões com as APIs de integração (Meta, CV CRM e RD) estão 100% restabelecidas e funcionais na produção.
- O bug de parsing de datas brasileiras no gráfico de crescimento de leads foi corrigido.
- O bug de parsing de estoque (unidades zeradas) na tela de Empreendimentos foi corrigido.
- O mecanismo de sincronização forçada (`/api/data?sync=true`) foi implantado para atualizar retroativamente os leads salvos no banco.
- A integração de corretores do CV CRM e a validação de leads órfãos do Meta Ads foram implantadas.
- O filtro de empreendimentos administrativos, os ajustes de datas/valores de vendas reais, o badge de múltiplas vendas por cliente e o layout das legendas dos gráficos (exibindo quantidade e porcentagem) foram finalizados e validados com sucesso.

---

## Histórico de Modificações (Junho de 2026)

### 1. Restauração do Adapter KV & Type Safety
- **O que foi feito:** Criado um adapter KV customizado backed pelo Postgres (`src/lib/kv.ts`) para substituir a biblioteca `@vercel/kv`, adicionando suporte robusto aos métodos `incr`, `expire` e `ttl` para o rate-limiter (`src/lib/rateLimit.ts`).

### 2. Guards de Autenticação
- **O que foi feito:** Adicionado verificação de autenticação (`verifyAuth`) nas seguintes rotas:
  - `src/app/api/tasks/[id]/route.ts`
  - `src/app/api/projects/route.ts`
  - `src/app/api/responsibles/route.ts`

### 3. Remoção de URLs Hardcoded da Vercel
- **O que foi feito:** Ajustado as rotas GET/POST dos webhooks e OAuth do RD Station para usar URLs dinâmicas e apontar para `app.guru.dev.br` em vez do antigo host da Vercel.

### 4. Correção do Gráfico de Crescimento de Leads
- **O que foi feito:**
  - Criado o helper `parseCrmDate` em `src/lib/dateUtils.ts` para converter datas com formato brasileiro (`DD/MM/YYYY`) vindas do CRM.
  - Atualizado o cron `sync-leads/route.ts` e o webhook `cvcrm/route.ts` para salvar datas válidas no Postgres usando o helper.
  - Atualizada a função `groupLeadsByYearMonth` em `src/app/marketing-vision/utils/leads.ts` para usar split/hífen resiliente e evitar bugs de fuso horário.

### 5. Mecanismo de Sincronização Retroativa
- **O que foi feito:** Adicionado o parâmetro `?sync=true` na rota `src/app/api/data/route.ts` para permitir que usuários logados recarreguem e corrijam todas as datas da base de leads de forma forçada.

### 6. Correção do Estoque de Empreendimentos
- **O que foi feito:** Corrigida a função `parseUnitCounts` em `src/app/marketing-vision/components/views/EmpreendimentosView.tsx` para navegar na estrutura real aninhada de `etapas -> blocos -> unidades` retornada pelo detalhe do empreendimento do CV CRM, lendo o status de venda através do campo `situacao_para_venda`.

### 7. Correção do Erro de Tipo no KV (Rate-Limiter)
- **O que foi feito:** Corrigido o método `incr` no arquivo `src/lib/kv.ts` para serializar os inteiros em strings JSON (`JSON.stringify`) antes de inseri-los na coluna `JSONB` do Postgres, eliminando os erros de tipo na console de produção e no rate limit.

### 8. Integração de Responsáveis do CV CRM e Cache Persistente
- **O que foi feito:** 
  - Atualizada a rota `src/app/api/responsibles/route.ts` para consumir a API de corretores do CV CRM (V1: `/api/v1/cadastros/corretores`) usando cabeçalhos permanentes (`email`/`token`).
  - Implementado cache persistente de 15 minutos no Postgres (`cv_responsibles_cache`) na tabela `project_state` para evitar chamadas de API frequentes.
  - Implementada mesclagem inteligente e desduplicação (por e-mail e nome normalizados) entre os responsáveis retornados pelo CV CRM e os responsáveis locais cadastrados no banco.

### 9. Validação e Cruzamento de Leads Meta Ads vs CV CRM (Leads Órfãos)
- **O que foi feito:**
  - Atualizada a rota `src/app/api/data/route.ts` para buscar formulários de leads ativos e contatos do Meta Ads através da Graph API.
  - Criado mecanismo resiliente de cruzamento (comparando e-mail normalizado e telefone sem caracteres especiais/com tolerância a DDI) com a tabela local `leads` (Postgres) para identificar e-mails e telefones captados em anúncios mas que ainda não constam no CRM (leads órfãos).
  - Atualizado o frontend (`DataContext.tsx` e `LeadsView.tsx`) adicionando uma nova aba de "Validação Meta" com cartões de KPI (Ex. leads não integrados) e uma tabela com as informações dos leads não integrados no CRM (nome, e-mail, telefone, formulário de origem, e data de captação).

### 12. Correção dos Gráficos — Separação Bar/Line
- **O que foi feito:** Refatorado `src/app/marketing-vision/components/charts/SalesGrowthChart.tsx` para eliminar o `ComposedChart` (mistura de `Bar + Line`). O gráfico agora tem dois modos de métrica com tipos puros: `count` → `BarChart` (quantidade de vendas por mês/ano agrupado por ano), `vgv` → `LineChart` (evolução do VGV). Adiciona toggle de métrica (Quantidade / VGV) ao lado do toggle de período (Mês / Ano).

### 13. Documento de Dados CV CRM
- **O que foi feito:** Criado `docs/cv-crm-data-dictionary.md` com dicionário completo de variáveis (Lead, CVDW Venda, Empreendimento, Corretor), funil de vendas com SLAs por etapa, lógica de prioridade de datas/mídias, diagrama de fluxo completo, métricas-chave (VGV, ticket médio, ROI, velocidade de vendas), pontos de intervenção recomendados e backlog de melhorias.

### 14. Commit e deploy: Tempo p/ Compra + Dual-axis Meta + Vendas por Reserva (commit 82653e5)
- **O que foi feito:**
  - Commitado e enviado ao GitHub tudo que estava pendente (antes em "não commitado").
  - Banco verificado: 3.762 leads e 28 vendas intactos no Postgres de produção.
  - Coolify faz auto-deploy via push no `main`.

### 11. Coluna "Tempo p/ Compra" na Tabela de Vendas (commitado em 82653e5)
- **O que foi feito:**
  - Adicionada função `calcDaysToSale` em `src/app/marketing-vision/components/views/VendasView.tsx` que calcula a diferença em dias entre `data_reserva` e `data_venda` de cada reserva CVDW.
  - Criado componente `DaysToSaleBadge` com três faixas visuais: ⚡ Rápido (≤30 dias, verde), ⏱ Médio (≤90 dias, amarelo), 🕐 Longo (>90 dias, roxo).
  - Adicionada nova coluna "Tempo p/ Compra" na tabela de vendas exibindo o badge para cada linha.
  - Tabela agora é ordenada pela `data_venda` mais recente primeiro antes do slice de 300 registros.
  - Substituída a função interna `hasVisitaStage` (removida junto ao refactor CVDW anterior).

### 10. Ajustes de Empreendimentos, Datas/Valores de Vendas e Layout de Gráficos
- **O que foi feito:**
  - **Filtro de Empreendimentos Administrativos:** Adicionado filtro no backend (`src/app/api/data/route.ts`) e no frontend (`EmpreendimentosView.tsx`) para ocultar cadastros administrativos e centros de custo (identificados por possuírem tipo ou situação comercial nulos). Economiza chamadas adicionais de API.
  - **Datas e Valores Reais de Vendas:** Modificadas as funções `getLeadDate` e `getLeadValueNumber` em `src/app/marketing-vision/utils/leads.ts` para priorizar os campos `data_venda` e `valor_venda` (em vez de `data_cadastro` e `valor_negocio`) quando o lead for classificado como venda (`isSale(lead)`).
  - **Identificação de Múltiplas Unidades:** Adicionado badge visual (`X un.`) ao lado do nome do cliente na tabela de vendas (`VendasView.tsx`) caso o lead tenha mais de 1 reserva associada (`l.qtde_reservas_associadas > 1`).
  - **Exibição nos Gráficos e Correção de Legenda:** Modificada a legenda dos gráficos de rosca (`PieDonutChart.tsx`) para exibir a quantidade absoluta e porcentagem de cada fatia usando a propriedade `formatter`. Adicionado também agrupamento em "Outros" para mídias e status minoritários em `DashboardView.tsx`, impedindo que a legenda vertical quebre o layout da página.

