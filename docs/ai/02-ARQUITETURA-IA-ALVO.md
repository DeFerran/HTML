# Fase 1 — Arquitetura Técnica Alvo da IA

> Desenho definitivo da camada de IA, **ancorado na arquitetura real** encontrada
> na auditoria (`01-AUDITORIA-ATUAL.md`), não na visão aspiracional do
> `00-MASTER-IA-AP.md`. Este documento é **projeto apenas** — nenhuma linha de
> código, migração ou tabela foi criada.

## Princípios de projeto (do `CLAUDE.md`)

1. A IA é uma **camada aditiva** sobre a plataforma existente. Não substitui nem
   duplica a fonte da verdade (`painel_estado`) nem os espelhos (`bi_*`).
2. A IA **lê dos `bi_*`** (relacionais, com RLS, read-only) via ferramentas
   controladas. **Nunca** escreve em `painel_estado` diretamente.
3. O **secret** (`ANTHROPIC_API_KEY`) vive **só no backend** (Edge Function),
   nunca no `index.html` estático.
4. Escopo por **`user_id` + `empresa`** (realidade atual: single-tenant). Campos
   `tenant_id`/`company_id` **não existem** e são trabalho futuro explícito.
5. Fase inicial **READ‑ONLY**. Escrita só com Approval Engine, e jamais no blob.
6. Um **agente único** ("Agente AP") primeiro; especializações depois.

## Realidade que restringe o desenho (da auditoria)

| Fato | Implicação de projeto |
| --- | --- |
| Sem backend/runtime próprio | A IA precisa de um backend novo → **Supabase Edge Functions** (Deno). Aditivo. |
| Sem Storage | Base de conhecimento (RAG) precisa de tabelas + `pgvector`, não de buckets. |
| Fonte da verdade = 1 JSON; espelhos `bi_*` relacionais | Tools leem `bi_*`. Nunca o blob, nunca via "SQL livre da IA". |
| Sem modelo de fazenda/talhão/coleta/amostra | Tools de AP fina **não têm dados** → não implementar (regra "nunca inventar"). |
| RBAC real por RLS (`is_membro_ativo`/`pode_editar`/`is_admin`) | Reaproveitar essas funções para permissionar a IA. |
| Chave do front = publishable/anon | A Edge Function usa o **JWT do usuário** para ler `bi_*` sob RLS. |

---

## 1. AI Gateway

**O quê:** uma **Supabase Edge Function** (`ai-gateway`, Deno) — o único ponto de
entrada. O front (`index.html`) chama `POST /functions/v1/ai-gateway` com o
**JWT do usuário** (a sessão Supabase que já existe).

**Responsabilidades:**
- Validar o JWT (a função roda com `verify_jwt = true`); resolver `auth.uid()`.
- Verificar acesso: `is_membro_ativo()` (senão, recusa); ler papel via
  `meu_papel()` para decidir o nível de ferramentas permitido.
- Guardar o `ANTHROPIC_API_KEY` (Supabase secret, `Deno.env`). Nunca exposto.
- Rate-limit por usuário (contador em `ai_audit_log` / cabeçalhos).
- Encaminhar ao Orchestrator e devolver a resposta (streaming quando possível).

**Risco:** BAIXO — aditivo, isolado; não altera o app nem o banco existentes.

## 2. Provider de LLM

**Anthropic Claude**, via SDK oficial (`@anthropic-ai/sdk`) dentro da Edge
Function. O **model id vive no backend** (env `AI_MODEL`), nunca no front.

- **Recomendado:** `claude-sonnet-5` como padrão (melhor custo/qualidade para uma
  consultoria), com escalonamento opcional a `claude-opus-5` para análises
  complexas. Decisão de configuração, trocável por env sem redeploy do app.
- **Thinking adaptativo** (`thinking: {type:"adaptive"}`) + **streaming** para
  respostas longas. Loop de **tool-use** (o modelo pede uma tool → o gateway
  executa a READ tool → devolve o resultado → repete até `end_turn`).
- Chave sempre server-side; **CSP do front não muda** (o front fala só com o
  Supabase, que já está no `connect-src`).

**Risco:** BAIXO (secret protegido no backend, conforme `CLAUDE.md`).

## 3. Orchestrator

Lógica **dentro da Edge Function** que monta o contexto e roda o laço de
tool-use de forma **determinística**:

```
JWT válido + membro ativo
  → monta contexto (§4)
  → Claude (tool-use loop):
       modelo pede tool  →  Orchestrator valida contra allowlist do papel
                         →  executa READ tool (consulta bi_* sob JWT/RLS)
                         →  devolve resultado ao modelo
  → resposta final  →  grava em ai_messages + ai_audit_log  →  front
```

- **Allowlist por papel** (código, não "SQL livre"): leitor→READ; editor→READ (+
  SAFE_WRITE futuro); admin→+aprovar. Toda tool tem nível declarado.
- Sem acesso irrestrito ao banco: o modelo só chama as tools registradas.

**Risco:** MÉDIO — precisa de allowlist rígida e testes; mitigado por RLS (mesmo
que uma tool erre o escopo, a RLS barra dados de outro usuário).

## 4. Contexto

Montado **server-side** a cada chamada, em camadas:
- **System prompt**: domínio (agricultura de precisão + gestão DF AGRO), regras
  ("a IA não é fonte da verdade; use as ferramentas; nunca invente números").
- **Escopo**: `user_id`, papel, safra em foco (`SAFRA_BASE`).
- **Memória** (§11): fatos/preferências relevantes (de `ai_memory`).
- **RAG** (§10): trechos recuperados de `ai_knowledge_chunks` por similaridade.
- **Histórico recente**: últimas mensagens da conversa (de `ai_messages`).

**Risco:** BAIXO.

## 5. Tools

Funções controladas, definidas em código (JSON Schema), detalhadas em
`03-MAPA-DE-TOOLS.md`. **READ‑only na primeira versão**, lendo dos `bi_*`.
Nunca expõem "rode este SQL"; cada tool é uma consulta parametrizada fixa.

**Risco:** ALTO se criadas sobre dados inexistentes (fazenda/talhão/amostra) →
mitigação: só implementar tools com backing real (ver §5 do `01-AUDITORIA`).

## 6. Permissions

Mapa papel → nível de ferramenta, reaproveitando o RBAC do banco:

| Papel (via `meu_papel`) | READ | SAFE_WRITE | SENSITIVE_WRITE |
| --- | --- | --- | --- |
| leitor | ✅ | ❌ | ❌ |
| editor | ✅ | ✅ (só `ai_*`) | ❌ (só via aprovação) |
| admin | ✅ | ✅ | ✅ aprova/executa |

Todo acesso exige `is_membro_ativo()`. A RLS das `ai_*` e das `bi_*` é a
barreira final (o front/gateway não é a única defesa).

**Risco:** BAIXO (espelha o RBAC já validado).

## 7. Logs (auditoria)

Toda chamada de tool e resposta gravadas em `ai_audit_log` (tabela nova §Tabelas):
usuário, tool, parâmetros (hash), latência, tokens, resultado (resumo). Base para
observabilidade (§17) e para detectar abuso.

## 8. Conversations · 9. Messages

Tabelas `ai_conversations` e `ai_messages` (novas). Uma conversa por thread do
usuário; mensagens em ordem, com papel (user/assistant/tool) e conteúdo.

## 10. Knowledge Base (RAG)

`ai_knowledge_docs` (documento técnico) + `ai_knowledge_chunks` (`pgvector`).
Fluxo: documento → extração → chunks → embeddings → `pgvector` → recuperação
semântica → contexto. Extensão `vector` habilitada por migração aditiva.

## 11. Memory

`ai_memory` — fatos/preferências por usuário/empresa, **tipados** (fato oficial ≠
conhecimento técnico ≠ preferência). **Nunca** transformar conversa em fato
oficial automaticamente (regra do `00-MASTER`): gravação de memória é uma
SAFE_WRITE explícita, revisável.

## 12. Queues · 13. Worker

`ai_jobs` — fila simples em tabela (status: pendente/rodando/ok/erro). Um
**worker** (Edge Function agendada via `pg_cron`/Scheduled Functions) processa
jobs assíncronos (automações, WhatsApp, lotes). **Fase posterior** — não na v1.

## 14. Automations

`ai_automation_rules` — evento → condição → ação → job. **Fase posterior.** Toda
ação sensível passa por Approvals (§15).

## 15. Approvals (Approval Engine)

`ai_approvals` — toda SENSITIVE_WRITE cria um pedido pendente; um admin aprova
antes da execução. A IA **nunca** executa ação sensível automaticamente (regra
`CLAUDE.md`: não apagar, não alterar finanças, não enviar comunicação externa,
não mudar recomendação agronômica crítica sem aprovação).

## 16. WhatsApp

WhatsApp Cloud API → webhook (Edge Function) → mesmo Orchestrator → tools →
resposta. Requer mapear telefone→usuário (`ai_channel_identities`). O
`WHATSAPP_ACCESS_TOKEN` fica **só no backend**. **Fase posterior.**

## 17. Observability

View sobre `ai_audit_log`: tokens, custo estimado, latência, taxa de sucesso por
tool, erros. Sem PII no log (parâmetros por hash/resumo).

---

## Tabelas novas propostas (todas `ai_*`, aditivas, com RLS)

> Nenhuma criada nesta fase. Padrão comum: coluna `user_id uuid default auth.uid()`,
> `empresa text default 'DF AGRO'`, `criado_em timestamptz default now()`.
> **RLS** em todas: `(select auth.uid()) = user_id AND is_membro_ativo()` para
> SELECT; escrita conforme o papel. **Tenant:** escopo real por `user_id`
> (+`empresa` para compatibilidade futura). **Nunca** tocam `painel_estado`/`bi_*`.

### ai_conversations
- **Motivo:** agrupar mensagens de uma conversa.
- **Campos:** `id uuid pk`, `user_id`, `empresa`, `titulo text`, `criado_em`,
  `atualizado_em`.
- **Relacionamentos:** `user_id → auth.users`; 1‑N com `ai_messages`.
- **Indexes:** `(user_id, atualizado_em desc)`.
- **RLS:** dono lê/escreve a própria; membro ativo.
- **Risco:** BAIXO.

### ai_messages
- **Motivo:** histórico da conversa (contexto do modelo).
- **Campos:** `id uuid pk`, `conversation_id fk`, `user_id`, `papel text`
  (`user`/`assistant`/`tool`), `conteudo text`, `tool_nome text null`,
  `tokens int null`, `criado_em`.
- **Relacionamentos:** `conversation_id → ai_conversations`.
- **Indexes:** `(conversation_id, criado_em)`.
- **RLS:** via dono da conversa.
- **Risco:** BAIXO.

### ai_memory
- **Motivo:** memória tipada por usuário/empresa.
- **Campos:** `id uuid pk`, `user_id`, `empresa`, `tipo text`
  (`fato`/`conhecimento`/`preferencia`), `chave text`, `valor text`,
  `origem text`, `criado_em`, `atualizado_em`.
- **Indexes:** `(user_id, tipo, chave)`.
- **RLS:** dono; escrita = SAFE_WRITE (editor/admin).
- **Risco:** MÉDIO (não virar fato oficial automático → gravação explícita).

### ai_knowledge_docs
- **Motivo:** documentos técnicos da base de conhecimento.
- **Campos:** `id uuid pk`, `user_id`, `empresa`, `titulo`, `fonte`, `criado_em`.
- **Indexes:** `(user_id)`.
- **RLS:** dono; membro ativo.
- **Risco:** BAIXO.

### ai_knowledge_chunks
- **Motivo:** recuperação semântica (RAG).
- **Campos:** `id uuid pk`, `doc_id fk`, `user_id`, `trecho text`,
  `embedding vector(1536)`.
- **Relacionamentos:** `doc_id → ai_knowledge_docs`.
- **Indexes:** `ivfflat`/`hnsw` em `embedding`; `(doc_id)`. Requer extensão
  `vector` (migração aditiva `CREATE EXTENSION`).
- **RLS:** via dono do doc.
- **Risco:** MÉDIO (extensão nova; isolada, não afeta o app).

### ai_audit_log
- **Motivo:** auditoria e observabilidade de toda chamada de tool.
- **Campos:** `id uuid pk`, `user_id`, `empresa`, `tool text`, `args_hash text`,
  `nivel text` (READ/SAFE_WRITE/SENSITIVE_WRITE), `ok bool`, `latencia_ms int`,
  `tokens int`, `criado_em`.
- **Indexes:** `(user_id, criado_em desc)`, `(tool)`.
- **RLS:** dono lê o próprio; admin lê todos (via `is_admin`).
- **Risco:** BAIXO.

### ai_jobs (fila — fase posterior)
- **Motivo:** processamento assíncrono (automações, WhatsApp, lotes).
- **Campos:** `id uuid pk`, `user_id`, `empresa`, `tipo text`, `payload jsonb`,
  `status text` (`pendente`/`rodando`/`ok`/`erro`), `tentativas int`,
  `criado_em`, `atualizado_em`.
- **Indexes:** `(status, criado_em)`.
- **RLS:** dono; execução pelo worker (SECURITY DEFINER controlado).
- **Risco:** MÉDIO (concorrência do worker — só quando houver automações).

### ai_automation_rules (fase posterior)
- **Motivo:** regras evento→ação.
- **Campos:** `id uuid pk`, `user_id`, `empresa`, `evento text`,
  `condicao jsonb`, `acao jsonb`, `ativo bool`, `criado_em`.
- **RLS:** dono; edição = admin/editor.
- **Risco:** MÉDIO.

### ai_approvals (Approval Engine)
- **Motivo:** aprovação humana para SENSITIVE_WRITE.
- **Campos:** `id uuid pk`, `user_id`, `empresa`, `acao jsonb`,
  `status text` (`pendente`/`aprovado`/`negado`), `solicitado_por`,
  `decidido_por`, `criado_em`, `decidido_em`.
- **RLS:** solicitante lê o próprio; **só admin aprova** (`is_admin`).
- **Risco:** MÉDIO (é a trava de segurança das ações — precisa ser à prova de
  bypass; enforcement por RLS, não só UI).

### ai_channel_identities (WhatsApp — fase posterior)
- **Motivo:** mapear telefone → usuário.
- **Campos:** `id uuid pk`, `user_id`, `empresa`, `canal text` (`whatsapp`),
  `identificador text` (telefone), `verificado bool`, `criado_em`.
- **Indexes:** `unique(canal, identificador)`.
- **RLS:** dono; admin gerencia.
- **Risco:** MÉDIO (vincular canal externo a conta — exige verificação).

---

## Estratégia de rollback

A camada de IA é **inteiramente aditiva e isolada** — nada nela altera
`index.html` (salvo uma aba nova opcional), `painel_estado`, `bi_*`, `membros`,
funções ou gatilhos atuais.

- **Rollback de banco:** as tabelas `ai_*` e a extensão `vector` são criadas por
  migrações aditivas próprias; reverter = `DROP TABLE ai_*` (na ordem das FKs) +
  `DROP EXTENSION vector`. Zero impacto no app/BI existente.
- **Rollback de backend:** remover/desabilitar a Edge Function `ai-gateway` (e o
  worker). O app continua funcionando exatamente como hoje.
- **Rollback de front:** a aba "Inteligência Artificial" é aditiva e protegida
  por **feature flag** (`localStorage`/config) — desligar a flag remove a UI sem
  tocar nas views existentes.
- **Sem dados históricos alterados:** nenhuma migração modifica dados de
  `painel_estado`/`bi_*` (regra `CLAUDE.md`).
- **Por fase:** cada fase seguinte (FOUNDATION, READ TOOLS, COPILOTO, RAG, …) tem
  seu próprio commit e migração, revertível isoladamente por `git revert` +
  `DROP` das tabelas daquela fase.

---

## Próxima fase sugerida

`FOUNDATION` — implementar **apenas** o esqueleto aditivo e READ‑only:
1. Migração das tabelas `ai_conversations`, `ai_messages`, `ai_audit_log` (+ RLS).
2. Edge Function `ai-gateway` com validação de JWT + `is_membro_ativo`, secret no
   backend, e o loop de tool-use com **2–3 READ tools reais** (`get_client`,
   `get_costs`, `get_season`) lendo dos `bi_*`.
3. Aba "Inteligência Artificial" (Copiloto) atrás de feature flag.

Sem RAG, memória, automações ou WhatsApp ainda. Uma fase por vez, com testes e
relatório, conforme o `CLAUDE.md`.

**PARADA.** Nenhuma implementação será feita sem ordem explícita.
