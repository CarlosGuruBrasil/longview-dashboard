# Site Vision — Arquitetura

## Overview

Site Vision é o **cockpit do portal público** da LongView. Funciona em 3 camadas:

```
┌─────────────────────────────────────────────────────────────────┐
│ Admin Dashboard (/site-vision)                                  │
│ ↓ useOverview, useProjects, useInventory, useAnalytics         │
├─────────────────────────────────────────────────────────────────┤
│ API Endpoints (lean & specific)                                 │
│ ├─ /api/site-vision/overview    → stats + lead status          │
│ ├─ /api/site-vision/projects    → CRM + site portfolio         │
│ ├─ /api/site-vision/inventory   → units + resales              │
│ └─ /api/site-vision/analytics   → events + top pages + CTAs    │
├─────────────────────────────────────────────────────────────────┤
│ Public Site (/site)                                             │
│ ↓ src/lib/site-public.ts                                        │
├─────────────────────────────────────────────────────────────────┤
│ Postgres                                                         │
│ site_public_* tables (read-write from admin, read-only public)  │
└─────────────────────────────────────────────────────────────────┘
```

## Fluxo de Dados

### 1. **Admin publica um empreendimento**
```
Admin → POST /api/site-vision/empreendimentos/[id]
  ↓
  Updates: site_public_empreendimentos, site_public_media_assets, etc
  ↓
  Next time dashboard loads: /api/site-vision/projects fetches fresh
  ↓
  Public site refreshes automatically (SSR)
```

### 2. **Usuario visitando site público**
```
Browser → GET /site
  ↓
  Page.tsx server-renders → calls listPublishedProjects() from site-public.ts
  ↓
  site-public.ts queries Postgres directly for published projects
  ↓
  HTML enviado ao browser
```

### 3. **Admin consultando dashboard**
```
Browser → GET /site-vision → redirects if not authenticated
  ↓
  SiteVisionDashboard monta: useOverview + useProjects + useInventory + useAnalytics
  ↓
  4 hooks em paralelo chamam /api/site-vision/overview|projects|inventory|analytics
  ↓
  Cada endpoint faz suas queries + transforma dados
  ↓
  Dashboard renderiza com dados frescos
```

## Arquivos-chave

### Frontend (Admin)
- `src/app/site-vision/` — Layout + pages
- `src/app/site-vision/components/SiteVisionDashboard.tsx` — Main dashboard
- `src/app/site-vision/components/useSiteVisionData.ts` — 4 hooks (overview, projects, inventory, analytics)
- `src/app/site-vision/components/Sidebar.tsx` — Navigation

### Frontend (Public)
- `src/app/site/` — Public pages (home, team, projects, etc)
- `src/lib/site-public.ts` — Query functions para site (não muda, importa tipos de site-queries.ts)

### Backend (API)
- `src/app/api/site-vision/overview/route.ts` — CRM stats + lead counts
- `src/app/api/site-vision/projects/route.ts` — CRM + site portfolio
- `src/app/api/site-vision/inventory/route.ts` — Units + resales
- `src/app/api/site-vision/analytics/route.ts` — Events + top pages + CTAs

### Shared
- `src/lib/site-queries.ts` — Types + helpers (reutilizável)

## Decisões de Design

### Por que 4 endpoints separados?
- **Antes**: 1 gigante (/api/site-vision/route.ts com 950 linhas)
- **Depois**: 4 endpoints pequenos (~80-100 linhas cada)
- **Benefício**: Cacheable, testável, menos bandwidth se dashboard só precisa de overview

### Por que hooks simples (não React Query)?
- Site-vision é interno, não crítico
- fetch + useState é suficiente
- Evita dependência extra
- Se precisar cache/refetch avançado depois, upgrade é fácil

### Por que site-public.ts não muda?
- É complexo (metadata, formatação, lógica de visibilidade)
- Tá funcionando
- Admin queries vão por /api/*, site público fica em site-public.ts
- Separação clara de responsabilidades

## Como adicionar nova feature

### Cenário: "Mostrar número de submissions de leads no dashboard"

**Passo 1**: Add query em `/api/site-vision/analytics/route.ts`
```typescript
const siteLeadCountRows = await sql`
  SELECT COUNT(*) FROM site_public_lead_submissions
`
```

**Passo 2**: Include na resposta
```typescript
return NextResponse.json({
  // ... outros dados
  submissions: asNumber(siteLeadCountRows[0].count),
})
```

**Passo 3**: Update tipo em `useSiteVisionData.ts`
```typescript
export interface AnalyticsData {
  submissions: number;
  // ...
}
```

**Passo 4**: Render no dashboard
```typescript
<MetricCard label="Leads submetidos" value={analytics.data.submissions} ... />
```

**Zero** overhead de abstração — query → tipo → componente.

## Convenções

### Naming
- **Tables**: snake_case (`site_public_empreendimentos`)
- **Endpoints**: kebab-case (`/api/site-vision/overview`)
- **Hooks**: camelCase (`useOverview`)
- **Components**: PascalCase (`SiteVisionDashboard`)

### Error Handling
- API endpoints: logger.error + NextResponse.json({ error: '...' })
- Hooks: catch → setError + return { data: null, loading: false, error }
- Dashboard: render error panel com "Tentar novamente"

### Performance
- All API endpoints cached at route level (can add revalidate later)
- Parallel queries with Promise.all
- Public site uses SSR (cached at build or CDN)

## Testing the Refactor

**To test locally:**
```bash
npm run dev
# Visit http://localhost:3000/site — should load projects + team
# Visit http://localhost:3000/site-vision — redirects to login (correct)
```

**To test API endpoints (after login):**
```bash
# Would need auth token, but endpoints are simple:
curl http://localhost:3000/api/site-vision/overview
curl http://localhost:3000/api/site-vision/projects
curl http://localhost:3000/api/site-vision/inventory
curl http://localhost:3000/api/site-vision/analytics
```

## Next Steps (if needed)

- [ ] Move CRUD endpoints to `/api/site-vision/empreendimentos/*` (separate from overview/analytics reads)
- [ ] Add caching layer (Redis) if admin dashboard refreshes become expensive
- [ ] Move old `/api/site-vision/route.ts` (950 lines) to `/api/site-vision/legacy` and deprecate
- [ ] Add rate limiting to public endpoints if needed
