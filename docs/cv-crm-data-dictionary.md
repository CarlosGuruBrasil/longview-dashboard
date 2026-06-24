# CV CRM — Dicionário de Dados & Lógica de Negócio

> Documento de referência para análise, diagnóstico e melhoria contínua do dashboard Longview.
> Base: API v1 do CV CRM (`longviewempreendimentos.cvcrm.com.br`)

---

## 1. Entidades e Relacionamentos

```
META ADS
  └─► LEAD (captação)
        ├─► CORRETOR / IMOBILIÁRIA (atendimento)
        ├─► EMPREENDIMENTO (interesse)
        │     └─► ETAPA ► BLOCO ► UNIDADE (produto específico)
        ├─► SITUAÇÃO (estágio do funil)
        ├─► SIMULAÇÃO (intenção de compra)
        ├─► RESERVA (compromisso)
        └─► VENDA (CVDW) — contrato efetivado
              └─► ASSOCIADOS (coproprietários)
```

---

## 2. Funil de Vendas — Estágios e Lógica de Intervenção

Os estágios seguem uma progressão lógica. O tempo em cada etapa é o principal indicador de saúde.

| # | Situação | Significado | Tempo Saudável | Alerta Vermelho |
|---|----------|-------------|----------------|-----------------|
| 1 | **Aguardando Atendimento** | Lead captado, ninguém tocou | < 2h | > 24h |
| 2 | **Em Atendimento SDR** | SDR qualificando (fone/WhatsApp) | 1–3 dias | > 7 dias |
| 3 | **Aguardando Atendimento Corretor** | SDR qualificou, aguarda corretor | < 4h | > 48h |
| 4 | **Sem Conexão** | Tentativas sem resposta | máx. 3 dias | > 5 dias sem reciclar |
| 5 | **Em Atendimento** | Corretor ativo com o lead | < 15 dias | > 30 dias |
| 6 | **Visita Agendada** | Data marcada para conhecer o produto | próx. 7 dias | data passada sem update |
| 7 | **Visita Realizada** | Cliente esteve no plantão | < 48h para follow-up | > 5 dias sem avanço |
| 8 | **Simulação** | Análise financeira / crédito | < 10 dias | > 21 dias |
| 9 | **Com Reserva** | Unidade bloqueada no nome | < 30 dias para contrato | > 45 dias |
| 10 | **Com Proposta** | Proposta comercial enviada | < 10 dias | > 20 dias |
| 11 | **Venda Realizada** | Contrato assinado ✓ | — | — |
| — | **Perdido/Descartado** | Saiu do funil negativamente | — | reativar em 90 dias |

### Taxa de Conversão por Etapa (referência de mercado imobiliário)
- Lead → Visita: **10–20%**
- Visita → Simulação: **30–50%**
- Simulação → Reserva: **40–60%**
- Reserva → Venda: **70–90%**
- **Lead → Venda (funil completo): 2–5%**

---

## 3. Variáveis do Lead (`/api/v1/comercial/leads`)

### 3.1 Identificação

| Campo | Tipo | Descrição | Uso no Dashboard |
|-------|------|-----------|-----------------|
| `idlead` | number | ID único do lead no CRM | Chave primária, link direto |
| `id` | number | Alias de `idlead` | Compatibilidade |
| `nome` | string | Nome completo do cliente | Exibição na tabela |
| `email` | string | E-mail principal | Cruzamento Meta Ads |
| `telefone` | string | Telefone fixo | Contato |
| `celular` | string | Celular (prioritário) | Contato WhatsApp |
| `genero` | string | `M` / `F` | Segmentação demográfica |
| `cidade` | string | Cidade de residência | Mapa de interesse |
| `estado_civil` | string | Estado civil | Perfil financeiro |

### 3.2 Datas — Hierarquia de Prioridade

> **Regra crítica**: Use sempre a data mais específica disponível.

| Campo | Quando usar | Prioridade |
|-------|------------|------------|
| `data_venda` | Para leads classificados como venda | **1ª** (se `isSale()` = true) |
| `data_cad` | Data de cadastro padrão | **2ª** |
| `data_cadastro` | Alias alternativo | **3ª** |
| `data_cadastramento` | Formato mais antigo da API | **4ª** |
| `ultima_data_conversao` | Última ação do lead | Auxiliar (velocidade) |

**Formato**: A API retorna datas em `DD/MM/YYYY` ou `YYYY-MM-DD HH:MM:SS`. Sempre normalizar via `parseCrmDate()` / `toISODate()` antes de salvar.

### 3.3 Funil e Status

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `situacao.nome` | string | Estágio atual no funil (ver tabela §2) |
| `situacao.cor` | string (hex) | Cor da situação configurada no CRM |
| `temperatura` | string | `quente`, `morno`, `frio` — avaliação subjetiva do corretor |
| `motivo_cancelamento.nome` | string | Razão da perda (preenche somente se perdeu) |
| `bolsao` | bool/int | Lead em lista de espera (bolsão) |

### 3.4 Origem e Mídia

| Campo | Tipo | Descrição | Lógica de Prioridade |
|-------|------|-----------|---------------------|
| `midia_visita` | string | Mídia declarada na visita | **1ª** — mais confiável |
| `midia_principal` | string | Mídia de captação | **2ª** |
| `origem` | string/obj | Canal de origem genérico | **3ª** (fallback) |
| `campanha` | string | Campanha de anúncio | Só disponível via CVDW |

**Importante**: `midia_visita` > `midia_principal` > `origem`. Sempre usar `getOrigin()` que respeita essa hierarquia.

### 3.5 Negócio e Valor

| Campo | Tipo | Descrição | Uso |
|-------|------|-----------|-----|
| `valor_negocio` | string/number | Valor estimado (preenchido manualmente) | Fallback quando não há venda |
| `valor_venda` | string/number | Valor real da venda confirmada | Prioritário quando `isSale()` |
| `qtde_reservas_associadas` | number | Quantas reservas o lead tem | Badge "múltiplas unidades" |
| `qtde_simulacoes_associadas` | number | Simulações de crédito feitas | Indicador de intenção |

### 3.6 Responsáveis

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `corretor.nome` | string | Corretor responsável pelo lead |
| `corretor.id` | string | ID do corretor no CRM |
| `gestor.nome` | string | Gestor / coordenador |
| `imobiliaria.nome` | string | Imobiliária parceira |

### 3.7 Enriquecimento

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tags` | array | Tags customizáveis (ex: "bolsão", "indicação") |
| `interacao` | array | Histórico de interações (`data_cad`, `tipo`) |
| `score` | number | Score de qualificação (calculado pelo dashboard) |

---

## 4. Variáveis de Venda CVDW (`/api/v1/cvdw/vendas`)

> Fonte de dados mais precisa para análise de vendas — uma linha por **reserva**, não por lead.

### 4.1 Identificação da Transação

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `idreserva` | number | ID único da reserva |
| `idlead` | string | ID do lead no CRM (FK → Lead) |
| `referencia` | string | Código de referência interno |
| `referencia_data` | string | Data de referência para o período |
| `ativo` | string | `S`/`N` — se a reserva está ativa |
| `aprovada` | string | `S`/`N` — se a venda foi aprovada |
| `data_reserva` | datetime | Quando a reserva foi criada |
| `data_venda` | datetime | Quando o contrato foi assinado |
| `data_historico` | datetime | Data do último evento registrado |

### 4.2 Produto (Unidade)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `empreendimento` | string | Nome do empreendimento |
| `idempreendimento` | number | ID do empreendimento (FK) |
| `codigointerno_empreendimento` | string | Código interno |
| `regiao` | string | Região geográfica |
| `etapa` | string | Fase / etapa do empreendimento |
| `planta` | string | Tipologia da planta (ex: 2 quartos, studio) |
| `bloco` | string | Bloco |
| `unidade` | string | Número da unidade |
| `idunidade` | number | ID da unidade (FK) |
| `area_privativa` | number | Área em m² |

### 4.3 Cliente

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `cliente` | string | Nome do comprador |
| `idcliente` | number | ID do cliente (pessoa) |
| `idpessoa_cv` | number | ID interno CV |
| `documento_cliente` | string | CPF/CNPJ |
| `email` | string | E-mail do comprador |
| `cidade` | string | Cidade |
| `cep_cliente` | string | CEP |
| `renda` | number | Renda declarada |
| `sexo` | string | Sexo |
| `idade` | number | Idade |
| `estado_civil` | string | Estado civil |

### 4.4 Comercial

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `corretor` | string | Nome do corretor |
| `idcorretor` | number | ID do corretor |
| `imobiliaria` | string | Nome da imobiliária |
| `idimobiliaria` | number | ID da imobiliária |
| `campanha` | string | Campanha de origem |
| `midia` | string | Mídia de captação |
| `idmidia` | number | ID da mídia |

### 4.5 Financeiro

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `valor_contrato` | number | Valor do contrato assinado (R$) |
| `contrato_interno` | string | Número do contrato |
| `idtabela` | string | ID da tabela de preços |
| `nometabela` | string | Nome da tabela de preços |
| `codigointernotabela` | string | Código interno da tabela |
| `tipovenda` | string | Tipo (ex: À Vista, Financiado, MCMV) |
| `idtipovenda` | number | ID do tipo de venda |

### 4.6 Associados (coproprietários)

```typescript
associados: Array<{
  ativo: 'S' | 'N'
  idpessoa_cv: number
  idtipo_associacao: number
  tipo_associacao: string  // ex: 'Cônjuge', 'Sócio', 'Fiador'
  percentagem_participacao: number  // ex: 50 (= 50%)
}>
```

---

## 5. Empreendimentos (`/api/v1/cadastros/empreendimentos`)

### 5.1 Cabeçalho

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `idempreendimento` | string | ID único |
| `nome` | string | Nome comercial |
| `tipo` | string | Tipo do produto (null = admin/custo) |
| `situacao_comercial` | string | Status de vendas (null = admin/custo) |

**Filtro administrativo**: Empreendimentos com `tipo == null` OU `situacao_comercial == null` são cadastros internos (centros de custo, administração) e devem ser **ocultados** do dashboard.

### 5.2 Estoque (detalhe por empreendimento)

Estrutura hierárquica retornada no detalhe:
```
empreendimento
  └─► etapas[]
        └─► blocos[]
              └─► unidades[]
                    ├─► situacao_para_venda  ("Disponível" / "Reservado" / "Vendido")
                    ├─► tipologia
                    ├─► area_privativa
                    └─► valor_tabela
```

**Leitura do estoque**: Contar por `situacao_para_venda`:
- `Disponível` → estoque disponível
- `Reservado` → em negociação (reservas ativas)
- `Vendido` → vendas efetivadas

---

## 6. Corretores (`/api/v1/cadastros/corretores`)

| Campo | Uso |
|-------|-----|
| `email` | Chave de desduplicação |
| `nome` | Exibição e ranking |
| `idcorretor` | FK para leads e vendas |

Cache: 15 minutos no Postgres (`cv_responsibles_cache`).

---

## 7. Lógica Analítica — Métricas-Chave

### 7.1 Velocidade de Vendas

```
Velocidade = Qtd Vendas / Período (meses)
Tempo Médio p/ Compra = média(data_venda - data_reserva)
```
- < 30 dias: pipeline saudável, produto atrativo
- 30–90 dias: normal para imobiliário
- > 90 dias: possível obstáculo (crédito, documentação, indecisão)

### 7.2 Funil de Conversão

```
Taxa Visita     = leads com "visita" / total de leads
Taxa Conversão  = vendas / leads com visita
Taxa Perda      = leads perdidos / total de leads
```

### 7.3 VGV (Valor Geral de Vendas)

```
VGV = Σ valor_contrato (CVDW) — fonte mais precisa
VGV Estimado = Σ valor_venda || valor_negocio (leads) — fallback
Ticket Médio = VGV / Qtd Vendas
```

### 7.4 ROI de Mídia

```
Custo por Lead = Investimento Meta / Leads captados
Custo por Venda = Investimento Meta / Vendas realizadas
ROI Mídia = VGV de vendas originadas na mídia / Investimento
```

### 7.5 Saúde do Pipeline

```
Pipeline Score = Leads em estágios avançados (visita+) / Total leads ativos
Leads Parados  = leads sem atualização > SLA da etapa (ver §2)
Leads Órfãos   = captados no Meta sem entrada no CRM
```

---

## 8. Diagrama de Fluxo Completo

```
CAPTAÇÃO
  Meta Ads ──────────────────────────────► Lead no CRM
  (campanha, formulário, midia)             │
                                            ▼
QUALIFICAÇÃO                         SDR (Em Atendimento SDR)
  Tempo alvo: ≤ 3 dias                     │
                                    qualificou?
                                   /        \
                                 Sim         Não
                                  │           └──► Sem Conexão / Perdido
                                  ▼
ATENDIMENTO                Corretor (Em Atendimento)
  Tempo alvo: ≤ 15 dias          │
                                  ▼
VISITA                      Visita Agendada → Visita Realizada
  Conversão alvo: 10–20%         │
                                  ▼
PROPOSTA                   Simulação → Com Proposta
  Tempo alvo: ≤ 21 dias          │
                                  ▼
FECHAMENTO               Com Reserva → Venda Realizada (CVDW)
  Conversão alvo: 70–90%         │
                                  ▼
PÓS-VENDA               Associados / Crédito / Documentação
```

---

## 9. Pontos de Intervenção Recomendados

| Situação | Gatilho | Ação Sugerida |
|----------|---------|---------------|
| Lead > 2h em "Aguardando Atendimento" | `data_cad` vs agora | Alerta para gerente |
| Lead > 7 dias em "Sem Conexão" | `ultima_data_conversao` | Redistribuir ou reciclar |
| Visita agendada com data passada | `data_historico` vs hoje | Push para corretor |
| Reserva > 45 dias sem contrato | `data_reserva` vs hoje | Escalar para gerência |
| Lead no Meta sem match no CRM | e-mail/fone cruzado | "Leads Órfãos" (aba Validação Meta) |
| Baixa temperatura + simulação = possível saída | `temperatura == 'frio'` + `qtde_simulacoes > 0` | Retomar contato urgente |

---

## 10. Endpoints da API em Uso

| Endpoint | Uso | Cache |
|----------|-----|-------|
| `GET /api/v1/comercial/leads` | Lista todos os leads com paginação | Postgres (4h) |
| `GET /api/v1/cvdw/vendas` | Vendas individuais por reserva | Postgres (4h) |
| `GET /api/v1/cadastros/empreendimentos` | Lista empreendimentos | Junto com dados |
| `GET /api/v1/cadastros/empreendimentos/:id` | Detalhe + estoque | Por chamada |
| `GET /api/v1/cadastros/corretores` | Lista corretores | Postgres (15min) |
| `POST /api/v1/webhook/cvcrm` | Recebe eventos do CRM em tempo real | — |

---

## 11. Melhorias Identificadas (Backlog)

| Prioridade | Melhoria | Impacto |
|------------|----------|---------|
| Alta | Alertas de leads parados além do SLA | Reduz perda por negligência |
| Alta | Dashboard de velocidade de vendas por empreendimento | Decisão de estoque |
| Média | Score automático por temperatura + estágio + tempo parado | Priorização de follow-up |
| Média | Comparativo mês-a-mês de taxa de conversão por etapa | Identifica gargalos |
| Média | Integração de pós-venda (documentação, crédito) via webhook | Visibilidade completa |
| Baixa | Mapa de leads por cidade/região | Estratégia de expansão |
| Baixa | Análise de perfil demográfico dos compradores vs leads | Otimização de anúncios |
