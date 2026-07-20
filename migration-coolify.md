# Migração para Coolify

## Status

Migração concluída. O dashboard roda no Coolify com `DATABASE_URL` e serviços locais da stack atual.

## Estado operacional esperado

- Persistência principal em Postgres
- Deploy via Coolify
- Upload sem dependência de storage da Vercel
- Sem necessidade de `VERCEL_*`, `KV_REST_API_*` ou `BLOB_READ_WRITE_TOKEN`

## Variáveis mínimas esperadas

- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_USER`
- `ADMIN_PASS`
