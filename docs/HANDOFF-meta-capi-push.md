# Handoff — Push da correção do CAPI (Conversion Leads)

> Gerado por uma sessão do Claude (Cowork) em 2026-07-09. Esta sessão não tem
> credenciais de push para o GitHub configuradas no ambiente — por isso este
> handoff, para outra IA/agente (ex: Claude Code, Cursor, etc.) rodando
> localmente na máquina com git já autenticado terminar a tarefa.

## Contexto

A integração CV CRM → Meta Conversions API estava enviando eventos com um
payload que não batia com a spec oficial de "Conversion Leads" (CRM
integration) da Meta — faltavam campos obrigatórios (`lead_id`,
`custom_data.event_source`, `custom_data.lead_event_source`) e o
`action_source` usado (`'crm'`) não é um valor válido da API.

Isso foi corrigido e **já está commitado localmente**, mas não foi enviado ao
GitHub.

## Estado atual

```
commit 4bcef49
fix(meta-capi): payload conforme spec oficial de Conversion Leads
```

Rode isto para confirmar que o commit existe e é o HEAD:

```bash
cd "/Volumes/GURU HD/Desktop/longview-dashboard"
git log --oneline -3
git status --short
```

## O que fazer

1. **Push:**
   ```bash
   git push origin main
   ```
   (usa as credenciais de git já configuradas nesta máquina — SSH key, `gh
   auth login`, ou Git Credential Manager. Nenhuma credencial está neste
   arquivo nem deve ser colada aqui.)

2. **Confirmar o deploy no Coolify** — verificar se há webhook automático de
   deploy no push para `main`, ou disparar manualmente pelo painel do
   Coolify.

3. **Verificar no Meta Events Manager** (Business Manager → Conjuntos de
   dados → "Pixel de LONG VIEW (CONTA DE ANÚNCIOS)", ID `476191835092768`):
   - Aba **Ações → Eventos de CRM** — o aviso "Termine de conectar seu CRM"
     deve sumir depois que a Meta detectar eventos válidos (leva até ~1 dia
     após o deploy, segundo a doc oficial).
   - No ad set de rascunho ("HBM | Leads Imagens | Floripa Ampla — Cópia"),
     o campo **Conjunto de dados** deve passar a oferecer o dataset
     `476191835092768` como opção (hoje só mostra o dataset morto "Longview
     Empreendimentos").

4. **Teste opcional isolado** (não precisa de deploy, só do push + rodar
   local): usa `test_event_code` do `.env.local`, não polui dados reais.
   ```bash
   node scripts/test-capi.mjs
   ```
   Esperado: HTTP 200 e `"events_received": 1` na resposta.

## Arquivos alterados neste commit

- `src/app/api/meta/capi/route.ts` — payload corrigido (action_source,
  custom_data, lead_id)
- `src/app/api/webhooks/cvcrm/route.ts` — busca o `leadgen_id` salvo em
  `leads.raw._meta_lead_id` e injeta como `lead_id`
- `src/app/api/cron/process-leads/route.ts` — repassa `lead.id` (já é o
  leadgen_id) como `lead_id` no evento inicial
- `scripts/test-capi.mjs` (novo) — script de teste manual

## Importante — nunca publicar automaticamente

Nenhum ad set/campanha deve ser publicado sem revisão humana explícita do
Carlos. Esta tarefa é só código + infra (push/deploy), não mexe em
campanhas do Ads Manager.
