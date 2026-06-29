# Checkpoint — LongView Dashboard v2 — 2026-06-26

## Estado atual

- Navegação dos módulos Vision padronizada.
- Renomeação oficial aplicada: `people-vision`/`People Vision` e `quality-vision`/`Quality Vision` são os únicos nomes/paths dos módulos.
- A permissão `viewPeopleVision` substitui a chave antiga de People Vision; há normalização compatível para dados legados sem expor a chave antiga no payload atual.
- Telas dos módulos Project Vision, People Vision e Quality Vision foram varridas e padronizadas para usar cabeçalho compartilhado, wrappers amplos e cards `#121214/#1E1E22`.
- Headers internos duplicados foram removidos das páginas de Project/People/Quality onde o `AppHeader` já define o contexto da tela.
- Resíduos de caixas com `bg-white/*`, `border-white/*` e hovers antigos foram substituídos pelo padrão escuro consistente, mantendo cores específicas apenas para status/alertas/acento de módulo.
- Sidebar agora tem, no rodapé: Painel de Aplicativos, troca rápida por permissão e Administração.
- People Vision está padronizado como nome oficial.
- Cabeçalho compartilhado criado com usuário clicável, data/hora e clima.
- Tela de seleção redesenhada em liquid glass.
- Paleta definida:
  - Project Vision: azul
  - Marketing Vision: laranja
  - People Vision: verde
  - Quality Vision: violeta
- `npm run build` passou.

## Atenção

Resolvido nesta retomada: após a configuração do usuário Postgres dedicado `longview_user`, o login local passou a retornar 500 porque `ensureSchema()` tentava criar índices em tabelas antigas (`leads`, `kv_store`, etc.) das quais esse usuário não é owner.

O código foi ajustado para tratar esses passos de DDL como opcionais quando o Postgres retorna `42501` (`must be owner of table ...`). Isso preserva os dados e permite que o app siga usando as permissões de leitura/escrita já concedidas ao usuário dedicado.

Também foi alinhada a criação nova de `user_documents` com a coluna `content_b64`, usada pelo módulo de documentos People Vision.

Resolvido nesta sessão: o localhost agora usa o Postgres real pelo host público do servidor Coolify/Hetzner, apontando para a base `longview_db`.

Antes, os usuários cadastrados pareciam ter sumido porque o `DATABASE_URL` local apontava para um host interno do Docker/Coolify que não resolve fora do servidor:

```text
getaddrinfo ENOTFOUND n142xyl1wpz9zajvxjqq2uq5
```

Quando o Postgres não conectava, o app caía no fallback local `data/users-kv-local.json`, que contém apenas os usuários seed.

Foi adicionada uma proteção em `src/lib/db-kv.ts`: se `DATABASE_URL` estiver definido e uma escrita no Postgres falhar, a operação agora lança erro em vez de salvar silenciosamente no JSON local. Leituras ainda podem usar fallback para manter telas legíveis, mas escritas ficam bloqueadas para evitar divergência de dados.

## Validação

- conexão direta com `.env.local`: `longview_db`, `app_users = 5`, `project_state = 9`;
- `npx tsc --noEmit` passou;
- `npm run build` passou após a padronização visual e após a correção do `ensureSchema`;
- `npm run build` passou após a renomeação de rotas para `/people-vision` e `/quality-vision`;
- servidor local reiniciado em `http://localhost:3000`;
- login local + `GET /api/admin/users` retornou 5 usuários reais;
- `/api/user/me`, `/api/admin/users/usr-dev/documents`, `/select-app`, `/admin/users`, `/people-vision/colaboradores/usr-dev` e `/marketing-vision` responderam 200 autenticados.
- `/people-vision`, `/people-vision/colaboradores`, `/quality-vision`, `/quality-vision/inspecoes` e `/marketing-vision` responderam 200 no localhost.
- HTML inicial de `/marketing-vision` caiu para aproximadamente 55 KB após remover SSR dos leads; antes havia chegado a aproximadamente 8,6 MB.
- `/api/data` segue entregando aproximadamente 8,3 MB de JSON para 3.789 leads e deve ser a próxima otimização.
- A validação Meta Ads × CV CRM agora roda sob demanda na aba "Validação Meta", não no carregamento normal.

## Próximo passo

Refinar `/marketing-vision` com endpoint resumido/paginado por view. O SSR pesado foi resolvido, mas `/api/data` ainda envia todos os leads completos para o cliente.

## Pedido sugerido para nova conversa

```text
Continuar o LongView Dashboard v2 a partir de docs/session-checkpoint-2026-06-26.md.
O problema atual é que no localhost o Postgres não resolve o host do DATABASE_URL, então o admin cai no fallback local e mostra só 2 usuários. Quero resolver o acesso local ao banco real sem perder dados.
```
