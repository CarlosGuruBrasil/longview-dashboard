# Mapa da IA — Net4Life WhatsApp CRM

## Stack
- **LLM:** Google Gemini (único provedor)
- **Modelo padrão:** `gemini-2.5-flash` (configurável por tenant)
- **Modelo de embedding:** `text-embedding-004` (Gemini)
- **Chave:** `GEMINI_API_KEY` env var ou `TenantSettings.geminiApiKey` (criptografada)
- **Controle de versão:** sem versionamento de prompts — o system prompt está no código

---

## Fluxo Completo: Mensagem → Resposta da IA

```
[WhatsApp]                  [Widget Chat]
    |                            |
    v                            v
Webhook Meta POST          /api/chat-widget/message
(src/app/api/webhooks/     (src/app/api/chat-widget/
 whatsapp/route.ts)          message/route.ts)
    |                            |
    +───────────┬────────────────+
                |
                v
      handleRCChatbot()
    (src/lib/rc-chatbot.ts:338)
                |
                ├── IA desativada? → silêncio
                ├── Fora do horário comercial? → resposta automática + fim
                ├── Find/Create InsuranceLead (máquina de estados)
                ├── Comando "reiniciar"? → reseta lead
                ├── Ticket já assinado / COMPLETED? → redirect
                │
                ├── lead.state === handler específico?
                │   (GET_NOME, GET_CPF, GET_EMAIL, GET_PLANO,
                │    CONFIRM_DATA, AWAITING_SIGNATURE... ~30+ estados)
                │   → executa handler, envia resposta, fim
                │
                └── NENHUM handler específico (fallback) →
                        |
                        v
                1. Busca dados da conta (Wix BDRC + Asaas + CRM)
                2. Busca Base de Conhecimento (RAG)
                3. Chama runConversationalAI() ← LLM
                4. Processa resposta:
                    • routeToHuman=true → escala para agente humano
                    • isOffTopic ≥ 3 → escala para humano
                    • generateContractSignal=true → gera contrato ZapSign
                    • contextType → log + roteamento
                    • extractedFields → atualiza InsuranceLead
                    • replyMessage → envia via WhatsApp
```

---

## Arquitetura da IA

### 1. `src/lib/ai.ts` — Orquestrador do LLM
**Entry point:** `runConversationalAI(userMessage, lead, chatHistory, cfg, accountData, offTopicCount, knowledgeContext)`

- Constrói o **system prompt** (~400 linhas, português, ~2500+ caracteres) com:
  - Identidade do agente (`${agentName}, ${agentRole} da ${company}`)
  - Regra de concisão (máx 3 linhas por mensagem)
  - Regra "nunca abandone a conversa"
  - Produtos e setores disponíveis (roteamento)
  - Regras obrigatórias sobre Seguro RC
  - Regras customizáveis do admin (`aiCustomRules`)
  - Dados já coletados do lead (para não perguntar de novo)
  - Tabela de preços dinâmica (do Wix)
  - Estados de coleta de dados (GET_CPF, GET_EMAIL, etc.)
  - Contexto de anti-loop
  - Dados da conta do cliente (se disponível)
  - Histórico da conversa
  - Base de conhecimento estática + RAG
  - Instrução de saída: JSON puro
- Chama Gemini via fetch HTTP (`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`)
- `generationConfig.responseMimeType: 'application/json'`
- **Retry automático:** 2 tentativas para erros 429/500/503, com backoff de 1.5s
- Registra `GeminiUsage` no banco (modelo, tokens, tenant)
- Contorna `gemini-2.5-flash-lite` → forced para `gemini-2.5-flash`

### 2. `src/lib/rc-chatbot.ts` — Máquina de Estados (~1956 linhas)
**Entry point:** `handleRCChatbot(tenantId, phone, ticketId, userMessage)`

**Controle de fluxo (ordem de execução):**
1. Carrega config do tenant (cache 60s)
2. Verifica `aiEnabled` e `isBusinessHours`
3. Cria/busca `InsuranceLead` (`status: IN_PROGRESS`)
4. Cancela lead se inativo > 24h
5. Comandos especiais: `reiniciar`, `encerrar`
6. Handlers por estado (executados ANTES da IA):
   - `AWAITING_SIGNATURE` → reenvia link, verifica assinatura
   - `GET_TIPO_CONTRATANTE` → PF vs PJ
   - `GET_NOME`, `GET_CPF` → coleta sequencial
   - ... ~30+ estados específicos
7. **Fallback:** se nenhum estado corresponde → delega para `runConversationalAI`

**Handlers de estado implementados (pré-IA):**
```
GET_TIPO_CONTRATANTE, GET_NOME, GET_CPF, GET_EMAIL,
GET_DATANASCTO, GET_OAB, GET_INICIO_PROF, GET_CEP,
GET_NUMERO, GET_ESCRITORIO, GET_TITULARIDADE,
GET_FATURAMENTO_ANTES, GET_FATURAMENTO_DEPOIS, GET_ATUACAO,
GET_PPE_CARGOS, GET_PPE_REPRESENTA, GET_SEGURADORA,
GET_VIGENCIA, GET_LIMITE, GET_RETROATIVA,
GET_PROPOSTA_RECUSADA, GET_PROPOSTA_DETALHE,
GET_RECLAMACAO, GET_RECLAMACAO_DETALHE,
GET_INVESTIGACAO, GET_INVESTIGACAO_DETALHE,
GET_FATO_TERCEIROS, GET_FATO_DETALHE,
GET_PAGOU_RECLAMACAO, GET_PAGOU_DETALHE,
GET_PLANO, SELECT_PARCELAS, CONFIRM_DATA,
AWAITING_SIGNATURE, COMPLETED, CANCELLED
```

**Ações pós-IA:**
- `routeToHuman` → escalona ticket para humano, notifica push
- `generateContractSignal` → gera contrato via ZapSign + Asaas cobrança + insert Wix BDRC
- `isOffTopic` count ≥ 3 → escalona para humano
- Valida CPF/CNPJ (algoritmo de dígitos verificadores)
- Se CPF existente no Wix/CRM → atribui ao parceiro original, notifica push
- Auto-preenche endereço via ViaCEP → BrasilAPI
- Sync dados para `Contact` no CRM

### 3. `src/lib/knowledge.ts` — RAG Pipeline
- **Chunking:** parágrafos separados por `\n\n`, max 1500 chars, overlap 150
- **Embedding:** `generateEmbedding(text, apiKey)` → `text-embedding-004`
- **Busca semântica:** `searchKnowledgeBase(tenantId, query, apiKey, topK=5)`
  1. Busca todos os chunks do tenant com embedding
  2. Gera embedding da query
  3. Calcula cosine similarity
  4. Filtra score > 0.3
  5. **Fallback textual:** keyword search (termos > 2 chars)
- **Store:** `embedAndStoreChunks(tenantId, documentId, text, apiKey)`

### 4. `src/lib/insurance-knowledge.ts` — Base de Conhecimento Estática
- Injetada no prompt da IA (não via RAG)
- Contém: dados da corretora, seguradora parceira (Kovr), coberturas, exclusões, FAQ, objeções de venda, regras de negócio PF/PJ

### 5. `src/lib/rc-plans.ts` — Planos de RC
- 7 tiers: `100k`, `300k`, `500k`, `1mi`, `1.5mi`, `2mi`, `3mi`
- Preços dinâmicos do Wix CMS (cache 5 min) com fallback hardcoded
- Se o Wix falha, usa `RC_PLANS` hardcoded (atualizado manualmente)

### 6. `src/lib/tenant-settings.ts` — Config do Tenant
- Cache em memória com TTL de 60s
- Interface `TenantConfig` com todos os campos de IA:
  - `geminiApiKey`, `geminiModel`
  - `aiEnabled`, `aiAgentName`, `aiAgentRole`
  - `businessHoursStart`, `businessHoursEnd`, `businessDays`
  - `outOfHoursMessage`, `aiCustomRules`

---

## Schema do Banco (Modelos de IA)

```prisma
model TenantSettings {
  // IA / Gemini
  geminiApiKey   String?
  geminiModel    String?        @default("gemini-2.5-flash")

  // Agente Virtual
  aiEnabled          Boolean    @default(true)
  aiAgentName        String?    @default("Ana")
  aiAgentRole        String?    @default("consultora de seguros")
  businessHoursStart String?    @default("08:00")
  businessHoursEnd   String?    @default("18:00")
  businessDays       Json?      // [1,2,3,4,5]
  outOfHoursMessage  String?
  aiCustomRules      String?    // Injetado no prompt
  chatbotFlow        Json?      // Fluxo visual do builder
}

model InsuranceLead {
  state           String   @default("INIT")  // Máquina de estados
  status          String   @default("IN_PROGRESS")
  // Dados pessoais, endereço, plano, ZapSign, Asaas
  extraData       Json?    // Dados extendidos + offTopicCount
}

model GeminiUsage {
  promptTokens     Int
  completionTokens Int
  totalTokens      Int
  model            String
  // tenantId, ticketId, createdAt
}

model KnowledgeDocument {
  title       String
  description String?
  category    String?    // "produto" | "seguradora" | "procedimento" | "faq" | "geral"
  sourceType  String     // "text" | "pdf" | "docx" | "txt"
  active      Boolean    @default(true)
  chunks      KnowledgeChunk[]
}

model KnowledgeChunk {
  content    String
  embedding  Json?     // Float[] como JSON
  chunkIndex Int
  document   KnowledgeDocument
}
```

---

## Decisões da IA (ContextType)

A IA classifica cada mensagem em um dos 10 tipos:

| Tipo | Quando |
|---|---|
| `greeting` | Saudação / primeiro contato |
| `question` | Dúvida geral sobre seguro RC |
| `commercial_rc` | Quer contratar Seguro RC |
| `commercial_other` | Quer outro produto (Saúde, Vida, Pet, etc.) |
| `financial` | Boleto, pagamento, pendências |
| `claim` | Sinistro / acionar seguro |
| `aftersales` | Pós-venda, dúvidas sobre apólice ativa |
| `verify_account` | Consultar dados da conta / plano vigente |
| `other` | Fora de escopo |

**Ações por tipo:**
- `commercial_other` + `claim` → `routeToSector` definido, redireciona para setor especializado
- `verify_account` → consulta dados no Wix/Asaas/CRM, informa apenas 4 dígitos do CPF como verificação
- `financial` → IA pode informar boletos e status de pagamento (nunca CPF completo)
- Demais → IA responde diretamente

---

## Gatilhos de Escalação para Humano

| Condição | Ação |
|---|---|
| `routeToHuman: true` | IA explicitamente pede atendente humano |
| `isOffTopic` ≥ 3 mensagens | Anti-loop: escala para humano |
| CPF já existente no Wix/CRM | Transfere para o parceiro original (ou Henry como fallback) |
| PJ / Sociedade de Advogados | Informa que requer cotação manual (Facility PJ) |
| Fora do horário comercial | Mensagem automática + registra no histórico |
| IA retorna null (falha na API) | Sistema escala manualmente |

---

## Regras de Segurança no Prompt

1. **Nunca revele que é IA** — confirme que é atendente humana
2. **Máx 3 linhas por mensagem** — quebra em múltiplas mensagens se precisar
3. **Nunca exiba dados sensíveis** — CPF completo, RG, endereço completo, telefone, dados bancários
4. **Verificação de 4 dígitos** — antes de informar dados da conta, pede os 4 últimos do CPF
5. **Link de assinatura** — envia direto no WhatsApp (não diz que foi por e-mail)
6. **OAB, CPF, CEP** — só dígitos, sem formatação
7. **100k é sempre à vista** — não pergunta parcelas para plano 100k
8. **Nunca oriente omissão de informações** — a apólice vincula o questionário

---

## Fluxo de Contratação (completo)

```
SAUDAÇÃO → GET_TIPO_CONTRATANTE (PF/PJ)
    ↓ PF
GET_NOME → GET_CPF → GET_EMAIL → GET_DATANASCTO → GET_OAB
    → GET_INICIO_PROF → GET_CEP (auto ViaCEP) → GET_NUMERO
    → GET_ESCRITORIO → GET_TITULARIDADE
    → GET_FATURAMENTO_ANTES → GET_FATURAMENTO_DEPOIS → GET_ATUACAO
    → GET_PPE_CARGOS (+ GET_PPE_REPRESENTA se Sim)
    → GET_ISRENOVACAO
        ├── Sim: GET_SEGURADORA → GET_VIGENCIA → GET_LIMITE → GET_RETROATIVA
        └── Não: continua
    → GET_PROPOSTA_RECUSADA
    → GET_RECLAMACAO → GET_RECLAMACAO_DETALHE
    → GET_INVESTIGACAO → GET_INVESTIGACAO_DETALHE
    → GET_FATO_TERCEIROS → GET_FATO_DETALHE
    → GET_PAGOU_RECLAMACAO → GET_PAGOU_DETALHE
    → GET_PLANO (escolha do plano) → SELECT_PARCELAS
    → CONFIRM_DATA (resumo + confirmação)
    → GENERATING_CONTRACT (ZapSign)
    → AWAITING_SIGNATURE (cliente assina)
    → COMPLETED (Asaas gera cobrança)
```

---

## Configuração por Tenant (UI Settings)

A página `/settings` (aba "Integrações") expõe:
- Chave da API Gemini
- Modelo Gemini
- Nome do agente (padrão: "Ana")
- Função do agente (padrão: "consultora de seguros")
- Horário comercial (início, fim, dias)
- Mensagem fora do horário
- IA ativada (on/off)
- Regras personalizadas (injetadas no system prompt com prioridade máxima)

---

## Observações Críticas

1. **Modelo lite é sobrescrito:** `gemini-2.5-flash-lite` é forçado para `gemini-2.5-flash` no código (`ai.ts:119-121`)
2. **System prompt está hardcoded** em `src/lib/ai.ts` — sem versionamento, sem template externo
3. **RAG é consultado antes de chamar o LLM** — os resultados são injetados no prompt, não via function calling
4. **Sem streaming** — a resposta completa é gerada e depois enviada ao WhatsApp
5. **O chatbot builder visual** (página `/chatbot`) salva fluxo como JSON em `TenantSettings.chatbotFlow`, mas o código atual não o utiliza — o fluxo real está hardcoded em `rc-chatbot.ts`
6. **Mensagens da IA marcadas com `senderName: "Ana (IA)"`** — usadas para contabilizar uso no dashboard de GeminiUsage
7. **O webhook da Meta tem `maxDuration: 60`** — contratos grandes podem demorar até 60s para gerar via ZapSign
8. **geoip-lite é dynamic import** — evita erro de path durante build
