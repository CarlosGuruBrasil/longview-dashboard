# Handoff — LongView Dashboard (Jul 2026)

Entrega de qualidade sobre o código Antigravity (10+ commits diretos na `main` sem revisão, Jul 2026).

## Estado Atual

| Métrica | Status |
|---------|--------|
| `tsc --noEmit` | **0 erros** |
| `eslint` | **0 erros** (83 warnings pré-existentes, nenhum novo) |
| `npm test` | **122/122 passed** (5 suites) |
| CI/CD | GitHub Actions em todo push/PR à `main` |

## O que Foi Feito (6 Fases)

### Fase 1 — Logs Estruturados
- `npm install pino pino-pretty`
- Criado `src/lib/logger.ts` — compatível client/server, pretty-print dev / JSON prod
- ~200 `console.*` → `logger.*` em **85+ arquivos**

### Fase 2 — Testes Automatizados
- `vitest` + `jsdom` + `@testing-library/jest-dom`
- 5 suites (`src/__tests__/`):
  - `lib/auth.test.ts` (11 testes) — `verifyAuth`, `verifyAdminAuth`, `verifyPermission`
  - `lib/permissions.test.ts` (9 testes) — `createDefaultPermissions`, `normalizePermissions`
  - `utils/leads.test.ts` (56 testes) — classificação, extração, cores, datas
  - `utils/metrics.test.ts` (29 testes) — estágios de funil, taxas de conversão
  - `utils/formatters.test.ts` (17 testes) — currency, date, number

### Fase 3 — Eliminação de `any`
- **8 catch handlers**: `err: any` → `err: unknown` com `instanceof Error`
- **Tipagens fixadas**: `raw`, `icon`, `colorObj`, `interacoes`, `payload` — todas tipadas
- **Decisões conscientes**:
  - `DataTable<any>` mantido (quebraria dezenas de render callbacks)
  - `data/route.ts` `rows`/`leadObj` mantidos `any` (SQL dinâmico + JSON `raw`)
- Resultado: **0 erros tsc**, 24 ocorrências de `any` resolvidas

### Fase 4 — Catch Swallows
- **17 catches vazios** (`.catch(() => {})` / `catch {}`) → `logger.warn`
- **58 catches sem log** (só `setError(...)`) → `logger.error` antes do setState
- Arquivos alterados: `kv.ts`, `AppHeader`, `AppShell`, `DashboardView`, `IntelligenceView`, `SocialPanel`, `LeadDrawer`, `webhooks/cvcrm`, `webhook/route`, `data/route`, `admin/users`, `cadastro`, `quality-vision/*`, `LinksView`, `ProjectSheetImportPanel`, `colaboradores/[id]`

### Fase 5 — CSS Morto
- `globals.css`: **244 → 96 linhas** (-60%)
- Removidas **17 classes mortas**: `lv-kpi`, `lv-btn*`, `lv-badge`, `lv-section-title`, `scroll-momentum`, `app-shell`, `bottom-nav`, `drawer-*`, `glass*`, `glow-white-md`, `fade-in-up`
- Mantidas 6 classes em uso: `lv-card` (4 usos), `pt-safe`, `pb-safe`, `no-tap` (30 usos), `scrollbar-none` (7 usos), `glow-white-sm` (3 usos)

### Fase 6 — CI/CD
- `.github/workflows/ci.yml` — roda `typecheck` + `lint` + `test` em push/PR à `main`
- `package.json` — scripts `typecheck` e `ci` adicionados
- `npm run ci` verificado: tsc 0, lint 0, test 122/122

## Riscos Conhecidos (Não Resolvidos)

1. **~200 inline styles** no código — cosmético, sem quebra funcional
2. **6 views usam `DataTable<any>`** — genérico mantido porque remover quebraria todas as render callbacks
3. **`data/route.ts` `rows`/`leadObj` como `any`** — shape vem de SQL dinâmico e JSON `raw`
4. **83 warnings de lint** — todos pré-existentes (unused imports, `no-explicit-any` em DataTable views, `set-state-in-effect` em componentes legados)

## Commits

```
4c477d5 feat: conclui Fases 1-3 — logs pino, testes vitest (122), tipagem any
a7ee64e feat: fase 4 — logger em todos os catch handlers silenciosos
c35a9df feat: fase 5 — remove CSS morto do design system (globals.css)
ac91130 feat: fase 6 — CI/CD com GitHub Actions e script ci
```

## Stack do Projeto

- **Next.js 16.2.6** (App Router) + React 19
- **TypeScript** estrito
- **Tailwind CSS 4** + PostCSS
- **Pino** (logs estruturados)
- **Vitest** + Testing Library (testes)
- **PostgreSQL** via `postgres` (SQL tagged template)
- **JWT** (auth stateless, cookie httpOnly)
- **Meta Graph API** (Facebook/Instagram Ads)
- **CV CRM API** (integração de leads)
- **FCM** (push notifications)

## Variáveis de Ambiente (Onde Encontrar)

As chaves **NÃO** estão no repositório. Estão em **arquivos locais ignorados pelo git**:

### `~/.env.local` (máquina do Carlos — Coolify/Hetzner)
Contém as chaves reais de produção:
```
JWT_SECRET=<token_jwt>
DATABASE_URL=postgresql://...
CV_CRM_EMAIL=email@longview.com.br
CV_CRM_TOKEN=<token_cv_crm>
META_TOKEN=<token_meta_ads>
META_ACT_ID=<meta_ad_account_id>
RD_CLIENT_ID=<rd_client_id>
RD_CLIENT_SECRET=<rd_client_secret>
RD_TOKEN_PRIVATE=02e1f7bb376e16170e250b9c91a8ef4e
RD_TOKEN_PUBLIC=388aa76e6023b3190d9371263acaf36b
CRON_SECRET=<cron_secret>
META_WEBHOOK_VERIFY_TOKEN=<webhook_verify>
NEXTAUTH_URL=https://app.guru.dev.br
NEXT_PUBLIC_FIREBASE_*=<firebase_config>
FIREBASE_ADMIN_*=<firebase_admin_sdk>
```

### `.env.example` (commitado no repositório)
Templates com placeholders. Copie para `.env.local` e preencha.

### `.env.prod` (commitado no repositório)
Cópia de segurança das variáveis, mas com valores **vazios** para secrets.

### Coolify (servidor)
As variáveis estão configuradas no painel Coolify como variáveis de ambiente do serviço. Qualquer alteração precisa ser replicada lá.

### Testes
O `vitest.config.ts` já define `JWT_SECRET` como `'test-secret-for-vitest'` no bloco `env`, então os testes rodam sem `.env.local`.
