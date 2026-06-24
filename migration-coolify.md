# Migração para Coolify — Removendo Vercel

## O que vamos fazer:

1. ✅ Remover @vercel/blob → usar upload base64 (funciona sem storage)
2. ✅ Desabilitar Firebase → notificações comentadas (MVP)
3. ✅ Usar Postgres para tudo (já tem)
4. ✅ Configurar env vars para Coolify
5. ✅ Deploy via Coolify + Docker

## Alterações:

### 1. package.json
- Remover: @vercel/blob
- Remover: firebase, firebase-admin
- Manter: postgres (já temos!)

### 2. src/app/api/upload/route.ts
- Remover import Vercel Blob
- Manter fallback base64 apenas

### 3. Arquivos Firebase
- Comentar imports de firebase-admin/messaging
- Manter resto funcionando

### 4. Env vars (Coolify)
DATABASE_URL=postgres://user:pass@banco:5432/db
JWT_SECRET=xxx
ADMIN_USER=carlos@longview.com.br
ADMIN_PASS=Guru$2026
(remover: BLOB_READ_WRITE_TOKEN, FIREBASE_*, etc)

## Timeline:
- 5 min: remover deps
- 5 min: atualizar código
- 2 min: commit + push
- 2 min: deploy Coolify

Total: ~15 min
