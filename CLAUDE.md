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
