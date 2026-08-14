# 14 — Auditoria pós-implementação da arquitetura de IA

**Data:** 2026-08-14
**Tipo:** auditoria (sem implementar, sem corrigir, sem migrar, sem alterar
banco/RLS/componentes). Baseada no **código real**, no **banco real** (leitura via
MCP Supabase) e nos testes — os documentos foram usados só como referência de
intenção. **Avaliação sem suavização.**

**Método (evidências):** `bun test` (110/110), transpile de todas as Edge
Functions, varredura de mocks, `list_tables`/`list_migrations`/`get_advisors`
(Supabase), consultas SQL de leitura ao schema, e leitura direta de:
`ai-gateway` (index/anthropic/provider/tools), `ai-actions`, `ai-whatsapp`,
`ai-worker`, migrations e o `index.html`.

> **Segredos:** não são exibidos. Onde aplicável, apenas
> **CONFIGURADO / NÃO CONFIGURADO**.

---

## Achado que domina o diagnóstico

A arquitetura **existe de verdade** (código real, 37 tabelas com **RLS ativo em
todas**, integrações reais com Anthropic e WhatsApp, **sem mock de dado falso** —
só *stubs honestos* que dizem "não disponível"). **Porém quase nada está
operacional em produção**, por 3 motivos concretos:

1. **`ANTHROPIC_API_KEY` NÃO CONFIGURADA** → o Copiloto, o assistente do WhatsApp
   e `run_agent` **não respondem de verdade** (o provider lança `not_configured`).
2. **A migração de observabilidade (`20260814_ai_observability`) NÃO foi aplicada
   e o `ai-gateway` está em v6** (anterior ao código de métricas). Logo, o
   **AI Health Dashboard**, o **guardrail de custo** e o **split de tokens/custo**
   **não funcionam** — há **descompasso frontend×backend** (o front chama
   `{action:'metrics'}` que a v6 não conhece).
3. **Todas as tabelas de IA estão vazias** (0 documentos, 0 memórias, 0 regras,
   0 aprovações, 0 config WhatsApp). O que existe é **infra pronta e não exercida**.

Prova (SQL de leitura): `ai_audit_log` **não tem** `tokens_in/tokens_out/custo_usd`;
`ai_usage_today()` **não existe**; migrations aplicadas param em
`20260813213132 ai_approvals_and_actions`.

---

## Legenda

✅ FUNCIONAL · 🟡 PARCIAL · 🔵 IMPLEMENTADO MAS NÃO CONFIGURADO ·
🟣 SOMENTE INTERFACE · ⚪ MOCK/PLACEHOLDER · 🔴 COM ERRO · 🚨 RISCO CRÍTICO

---

## 1. Foundation

| Item | Status | Evidência |
|---|---|---|
| AI Gateway (`ai-gateway`) | 🔵 | Deploy **v6 ACTIVE**. Auth (JWT `getUser`), tenant (`empresa='DF AGRO'`), membro (`is_membro_ativo`), papel (`meu_papel`), rate-limit por `run`, timeout, tratamento de erro, auditoria — tudo real. Só não responde sem a chave. |
| Anthropic Provider (`anthropic.ts`) | 🔵 | **Chamada REAL** a `https://api.anthropic.com/v1/messages` (fetch cru, `x-api-key`, `anthropic-version`). **Sem mock/fallback**: sem chave → `ProviderError(503, not_configured)`. Usa `usage.input/output_tokens` reais. |
| Orchestrator | 🔵 | É o **loop de tools dentro do gateway** (não um serviço à parte): até 6 iterações, executa tools, ecoa `tool_result`. Real; depende da chave. |
| Conversations / Messages | ✅ | Tabelas `ai_conversations`/`ai_messages` (RLS por `user_id`+`is_membro_ativo`). Grava turno do usuário/assistente. (1 linha cada — uso mínimo.) |
| Agent Runs / Tool Calls | ✅ | `ai_audit_log` grava `tipo='run'` e `tipo='tool_call'` com nível real, ok/erro, latência, tokens. |
| Error handling / Timeout | ✅ | `AbortSignal.timeout`; mapeia 401/403→503, 429→429, refusal→422, rede→502. |
| Authentication / Tenant / User | ✅ / 🟡 / ✅ | JWT + membro ok; **tenant é constante `DF AGRO`** (single-tenant, ver §11). |
| Company context | 🟡 | `company_id='DF AGRO'` fixo (mesmo do tenant). |
| Secrets | ✅ | Só no backend (`Deno.env`); **nenhum** no frontend (verificado). |

**ANTHROPIC_API_KEY: NÃO CONFIGURADA** (não é possível ler o secret; pela
conversa o dono ainda ia configurar, e o backend de métricas está pendente —
confirme no painel **Configurações › Saúde**, que chama `{action:'health'}`).

**Chamada real vs mock:** **REAL** (não há fallback que finja resposta do modelo).

---

## 2. Read Tools

Confirmado: **nenhuma READ tool aceita SQL livre do LLM**. O modelo só escolhe
**nome + argumentos tipados** (JSON schema); o handler monta a consulta via
PostgREST sob o **JWT do usuário** (RLS é a barreira de tenant). Testes:
`read_tools.test.ts`.

| Tool | Arquivo/função | Origem dos dados | Tenant/User/RLS | Testes | Status |
|---|---|---|---|---|---|
| `get_client` | read_tools.ts · `getClient` | `bi_clientes`/`bi_visitas`/`bi_cross_sell` | JWT+RLS | sim | ✅ |
| `get_season` | `getSeason` | `bi_safras`/`bi_servicos` | JWT+RLS | sim | ✅ |
| `get_costs` | `getCosts` | `bi_custos_mensais`/`bi_custo_categoria`/`bi_proj_gastos` | JWT+RLS | sim | ✅ |
| `get_collection_status` | `getCollectionStatus` | `bi_operacao_situacao`/`bi_operacao_etapas` (agregado) | JWT+RLS | sim | ✅ |
| `get_farm` | `stubHandler` | — (não há tabela) | — | sim | 🟣 **stub honesto** (retorna "não disponível", **não** dado falso) |
| `get_field` | `stubHandler` | — | — | sim | 🟣 stub honesto |
| `get_soil_analysis` | `stubHandler` | — | — | sim | 🟣 stub honesto |
| `search_knowledge` (RAG) | `searchKnowledge` | `match_ai_knowledge` (pgvector) | JWT+RLS | — | 🔵 funcional, **0 documentos** |
| `recall_memory` | `recallMemory` | `ai_memory` (só `VALIDATED`) | JWT+RLS | — | 🔵 funcional, **0 memórias** |

---

## 3. Copiloto AP

| Item | Status | Nota |
|---|---|---|
| Botão / drawer / chat | ✅ | `copOpen`/`copSend` → `sb.functions.invoke('ai-gateway')`. |
| Persistência / histórico | ✅ | `ai_conversations`/`ai_messages` + `localStorage df_cop_conv`. |
| Loading / erros | ✅ | Estados tratados na UI. |
| Resposta real | 🔵 | **Depende da chave** (hoje não responde de verdade). |
| Contexto automático | 🟡 | `copContexto()` envia `tenant_id`, `company_id`, `empresa`, **`aba`** e **`season_id` (safra)**. **`client_id` NÃO é enviado** (embora existam clientes); `farm_id`/`field_id` não existem na plataforma. |

**client_id / farm_id / field_id / season_id:** apenas **season_id** é fornecido;
**client_id não** (lacuna); farm/field não se aplicam.

---

## 4. RAG

| Item | Status | Evidência |
|---|---|---|
| `ai_knowledge_docs` / `ai_knowledge_chunks` | ✅ (schema) | Existem, RLS ativo, **0 linhas**. |
| pgvector | ✅ | Extensão `vector` instalada. |
| `match_ai_knowledge(vector,int)` | ✅ | Existe (assinatura `query_embedding extensions.vector, match_count integer`). |
| Embeddings | ✅ | **`gte-small` NATIVO do Edge** (`Supabase.ai`), **sem chave externa** e **sem mock**. |
| Chunking | ✅ | `chunking.ts` + testes. |
| Isolamento de tenant / permissões | ✅ | RLS por usuário; só docs indexados/aprovados. |
| Citações/fontes | ✅ | `search_knowledge` devolve `fontes` (doc_id/título). |
| **Status geral** | 🔵 | **Funcional, porém vazio (0 docs)** → nada a recuperar até indexar. |

Provider/model de embedding: **gte-small (nativo)**. **Sem fallback mock.**

---

## 5. Memory

| Item | Status | Evidência |
|---|---|---|
| `ai_memory` (VALIDATED/PENDING_REVIEW/INVALIDATED) | ✅ (schema) | RLS; **0 linhas**. |
| Retrieval de contexto | ✅ | `recall_memory` só traz `VALIDATED`; WhatsApp usa `match_ai_memory`. |
| tenant/company/entity_id/user_id/confidence/source | ✅ | Campos presentes; `source='ia'`→`PENDING`. |
| Conversa comum **não** vira memória validada | ✅ | IA só **propõe** (`propose_memory`), grava `PENDING`; trigger `ai_memory_guard` reforça no banco. |
| **Status geral** | 🔵 | Funcional, **0 memórias**. |

---

## 6. Central de IA (telas)

| Tela | Backend? | Status |
|---|---|---|
| Visão Geral | Sim (`ai_audit_log`) | 🟡 lê contadores/latência/tokens reais; pouca/zero data |
| Copiloto | Sim (gateway) | 🔵 precisa da chave |
| Agentes | Não (informativo) | 🟣 painel **read-only** de config (agente/modelo/tools/prompt protegido) — por design, sem edição |
| Automações | Sim (`ai-worker`/`automation_rules`) | 🟡 UI real; **0 regras**, sem cron |
| Alertas | Sim (`ai_alerts` via `ai-actions`) | 🟡 funcional; vazio |
| Conhecimento | Sim (`ai-knowledge`) | 🔵 funcional; **0 docs** |
| Memória | Sim (`ai_memory`) | 🔵 funcional; **0 memórias** |
| WhatsApp | Sim (`ai-whatsapp`) | 🔵 UI + backend reais; **não configurado** |
| Aprovações | Sim (`ai_approvals` via `ai-actions`) | ✅ fluxo real; vazio |
| Histórico & Auditoria | Sim (`ai_audit_log`) | 🟡 funcional; pouca data |
| Configurações (Saúde/diagnóstico) | Sim (`{action:'health'}` — existe na v6) | ✅ funcional (status da chave/WhatsApp/etc.) |
| **Saúde da IA** (dashboard de métricas) | **`{action:'metrics'}` — NÃO na v6** | 🟣/🔴 UI publicada, **backend não deployado** → erro ao carregar |
| **Prioridades da IA** (detectores) | Client-side (sobre `D`) | ✅ funcional |

---

## 7. Automações

| Item | Status | Evidência |
|---|---|---|
| `automation_rules` / `automation_runs` / `ai_jobs` (queue) | ✅ (schema) | RLS; **0 linhas**. |
| Worker (`ai-worker`) | 🔵 | Deploy **v2 ACTIVE**; `run_rule`/`tick`; RPCs `automation_claim_jobs`/`automation_due_rules` existem. |
| Retry / idempotency / failure | ✅ (lógica) | `shouldRetry`/`retryDelaySeconds`/dedupe testados (`automation_logic.test.ts`). |
| **Cron** | 🔴 ausente | Execução **só manual**; **não há pg_cron/scheduler** → automações não rodam sozinhas. |
| **Status geral** | 🟡 | Motor real e testado, **sem gatilho automático e sem regras**. |

(Teste seguro executado: unitários. **Nenhuma** mensagem externa/alteração de negócio.)

---

## 8. WhatsApp

Implementação **real e cuidadosa** (`ai-whatsapp`, v1 ACTIVE, `verify_jwt=false`):
- **GET** handshake `WHATSAPP_VERIFY_TOKEN`; **POST webhook** valida **HMAC-SHA256**
  (`WHATSAPP_APP_SECRET`); **POST admin** exige **JWT + is_admin**.
- Inbound: parse, **dedupe** (`wa_message_id` único), persiste contato/conversa/
  mensagem, **orquestra READ-only** (RAG + memória validada + snapshot), envia com
  **retry**; grava logs. Escrita por **service role** (backend). Tokens só no env.

Porém: `whatsapp_config` **0 linhas** (sem config ativa → webhook recebe e ignora)
e secrets **não setados**.

**WHATSAPP: NÃO CONFIGURADO** (código completo; falta config + secrets).
**Nenhuma mensagem real enviada nesta auditoria.**

---

## 9. Approval Engine

`ai-actions` (v1 ACTIVE) — **invariante confirmada no código**:
- `execute_safe` → só **SAFE_WRITE** e só **editor/admin** (`canExecuteSafe`), auditado.
- `propose` → só **SENSITIVE_WRITE**, cria `ai_approvals` **pendente**, **não executa**.
- `decide` → **só admin** (`canDecide`); `reject`/`edit`/`approve`. Só no
  `approve` chama `execSensitive` (envio WhatsApp real).
- Guarda `isForbiddenAction` + `toolClass`; sem delete/finanças/agronômica final.

✅ **SENSITIVE_WRITE não executa sem aprovação de admin.** Tabela vazia (0). Testes:
`approval_logic.test.ts`.

---

## 10. IA Proativa (detectores)

Client-side, sobre `D` (READ-only; **não executa ação externa**). Pura e testada
(`tests/detectors.test.ts`).

| Detector | Detecta? | Cria insight | Executa auto? | Cron/queue | Mock? |
|---|---|---|---|---|---|
| Nova análise laboratorial | 🟡 aproximado (fert + coleta na safra) | sim (Prioridades) | não | não | não |
| Coleta atrasada (recoleta) | 🟡 por ciclo de safra | sim | não | não | não |
| Coleta concluída | 🟡 via `D.operacao.etapas` | sim | não | não | não |
| Custo/ha fora do parâmetro | ✅ (serviço × margem alvo) | sim | não | não | não |
| Dados faltantes | ✅ | sim | não | não | não |
| Amostras atrasadas / Entregas pendentes | ✅ (dado operacional real) | sim | não | não | não |

**Fluxo:** detectar → analisar → insight → mostrar. **Nenhuma** ação automática.
Observação honesta: 3 dos 5 do PDF são **reframes** ancorados no dado real (a
plataforma não tem coleta/análise por data) — documentado, **sem inventar**.

---

## 11. Segurança

| Vetor | Resultado |
|---|---|
| RLS | ✅ **ativo nas 37 tabelas**; sem lint de "RLS disabled". |
| Cross-tenant / cross-company | 🟡 **N/A hoje** — single-tenant (`empresa='DF AGRO'` fixo). Não há 2º tenant para exercitar isolamento. |
| Permissões de usuário | ✅ leitor/editor/admin (`meu_papel`/`pode_editar`); escrita exige `pode_editar`. |
| service_role exposto | ✅ só no `ai-whatsapp` (webhook sem JWT, por design) e nunca no frontend. |
| Chaves no frontend (Anthropic/WhatsApp/service_role) | ✅ **nenhuma**; só rótulos dizendo "fica no backend". |
| SQL injection | ✅ LLM não gera SQL; PostgREST parametrizado. |
| LLM tool injection / prompt injection | 🟡 mitigado: allowlist de tools + ações sensíveis exigem **aprovação humana**; conteúdo externo (RAG/WhatsApp) entra como contexto, não como comando. |
| IDOR / acesso por ID | ✅ toda leitura/escrita passa por RLS (dono/admin). |
| Advisors (Supabase) | 🟡 **WARN** (nenhum CRÍTICO): 6 funções `SECURITY DEFINER` de RBAC executáveis por `authenticated` (design; retornam escalares) + **leaked-password protection desativada** no Auth. |

**Nenhum segredo neste relatório.**

---

## 12. Banco (tabelas de IA/automação/WhatsApp)

Todas com **RLS ativo**, `empresa` (tenant), `user_id`, `criado_em` (e
`atualizado_em` onde faz sentido), índices e FKs conforme as migrations
(`ai_foundation_tables`, `ai_knowledge_base`, `ai_memory`, `ai_automation_engine`,
`ai_write_requires_pode_editar`, `ai_whatsapp`, `ai_approvals_and_actions`).

| Tabela | Objetivo | RLS | Linhas |
|---|---|---|---|
| ai_conversations / ai_messages | chat | ✅ | 1 / 1 |
| ai_audit_log | runs + tool_calls + erros | ✅ | 1 |
| ai_knowledge_docs / ai_knowledge_chunks | RAG | ✅ | 0 / 0 |
| ai_memory | memória | ✅ | 0 |
| automation_rules / ai_jobs / automation_runs | automações + fila + histórico | ✅ | 0 / 0 / 0 |
| whatsapp_config/contacts/conversations/messages/logs | WhatsApp | ✅ | 0 (todas) |
| ai_approvals | approval engine | ✅ | 0 |
| ai_alerts / ai_tasks / ai_report_drafts | SAFE_WRITE | ✅ | 0 / 0 / 0 |

**Pendente no banco:** colunas `tokens_in/tokens_out/custo_usd` em `ai_audit_log`
e função `ai_usage_today()` (migração `20260814_ai_observability` **não aplicada**).

---

## 13. Testes

| Tipo | Status |
|---|---|
| Typecheck/transpile (Edge Functions) | ✅ todas OK (Bun.Transpiler) |
| Lint | ⚪ não há linter configurado no repo |
| Build | ✅ funções compilam (deploy v6/v2/v1 ACTIVE) |
| Unitários | ✅ **110/110** (obs, detectores, coleta/amostras/entregas/csv, approval, whatsapp-logic, automation-logic, chunking, read-tools, memory-rules) |
| Integração (E2E) | 🔴 **0** (sandbox bloqueia `supabase.co`; sem chave) |
| RLS / cross-tenant | 🔴 **0** testes automatizados (single-tenant; não exercitado) |
| READ tools (unit) | ✅ `read_tools.test.ts` |

**Lacuna clara:** cobertura unitária de lógica pura é boa; **não há teste de
integração/RLS/cross-tenant/E2E** contra o backend vivo.

---

## 14. Mocks / placeholders

Varredura por `mock|fake|dummy|placeholder|hardcod|TODO|FIXME|simulat|stub`
em `supabase/functions`: **9 ocorrências**, **todas legítimas**:
- **stubs honestos** `get_farm/get_field/get_soil_analysis` → retornam "não
  disponível" (**não** dados falsos);
- **fallback** do guardrail de custo (soma própria sob RLS) e do preço por modelo.

**Nenhum ponto onde a interface finja dado real com dado artificial.** O único
risco de "parecer funcional sem estar" é a **aba Saúde da IA** (UI publicada,
endpoint `metrics` não deployado) e as telas com **backend pronto porém vazio**.

---

## 15. Mapa de fluxo real (o que existe hoje)

```
WEB → COPILOTO(copSend) → ai-gateway(v6) → [loop de tools = orchestrator]
   → Anthropic(REAL)🔴 sem chave → TOOL(READ, RLS) → bi_*/ai_* → RESPOSTA
   Elo quebrado: Anthropic (sem ANTHROPIC_API_KEY).

WHATSAPP → webhook(ai-whatsapp, HMAC ok) → orchestrate(RAG+memória+snapshot)
   → Anthropic(REAL)🔴 sem chave → send(retry) → RESPOSTA
   Elos quebrados: sem whatsapp_config ativo + sem secrets + sem chave.

EVENTO/CRON → (❌ não há cron) → ai_jobs(queue) → ai-worker(claim) → ação → run
   Elo quebrado: não há scheduler; execução só manual; 0 regras.

OBSERVABILIDADE → front {action:'metrics'} → ai-gateway v6 (❌ não conhece) 
   Elo quebrado: migração não aplicada + gateway não redeployado.
```

---

## 16. Relatório final — tabela

| Módulo | Status | Risco | Testado? | Dado real? | Pronto p/ prod? | Ação necessária |
|---|---|---|---|---|---|---|
| Foundation | 🔵 | Médio | unit | parcial | Não | Configurar chave |
| Claude API | 🔵 | Médio | unit | — | Não | Chave no backend |
| Orchestrator | 🔵 | Médio | unit | — | Não | Chave |
| Read Tools | ✅ | Baixo | unit | sim | Sim* | *depende do chat responder |
| Copiloto | 🔵 | Médio | unit | — | Não | Chave + `client_id` no contexto |
| Context | 🟡 | Baixo | não | parcial | Parcial | Enviar `client_id` |
| RAG | 🔵 | Médio | unit(chunk) | não(0 docs) | Não | Indexar documentos |
| Memory | 🔵 | Baixo | unit(regras) | não | Não | Validar memórias reais |
| Central IA | 🟡 | Médio | não | parcial | Parcial | Deploy Saúde; popular telas |
| Automation Engine | 🟡 | Alto | unit | não | Não | Criar regras + cron |
| Queue | 🔵 | Médio | unit | não | Não | Alimentar via regras |
| Worker | 🔵 | Médio | unit | não | Não | Cron/tick agendado |
| WhatsApp | 🔵 | Alto | unit(logic) | não | Não | Config + secrets |
| Approvals | ✅ | Baixo | unit | não | Sim* | *quando houver propostas |
| Proactive AI | ✅ | Baixo | unit | sim | Sim | — (client-side) |
| Audit | ✅ | Baixo | não | sim(mín) | Sim | — |
| Observability | 🔴 | Alto | unit | não | Não | **Aplicar migração + redeploy gateway** |
| Security | 🟡 | Médio | não | — | Parcial | E2E/RLS tests; leaked-pw; SEC DEFINER |

---

## 17. Score (0–100, sem suavizar)

| Dimensão | Nota | Razão curta |
|---|---:|---|
| Arquitetura | **82** | Camadas claras, allowlist, approval engine; mas single-tenant fixo e skew de observabilidade |
| Segurança | **76** | RLS em tudo, sem segredo no front, SENSITIVE só com admin, sem SQL livre; WARNs (SEC DEFINER, leaked-pw), cross-tenant não exercitado |
| IA (Copiloto) | **42** | Código real, mas **não responde** sem chave; E2E inexistente |
| Tools | **80** | 4 reais + 3 stubs honestos + RAG/memória; RLS; testadas |
| RAG | **52** | pgvector+fn+chunking+embedding nativo reais; **0 docs**, sem E2E |
| Memória | **52** | Schema+guard+recall reais; **0 memórias** |
| Automações | **38** | Motor/queue/retry reais e testados; **sem cron e sem regras** |
| WhatsApp | **40** | Webhook+orquestrador+envio reais; **não configurado** |
| Observabilidade | **28** | Código+dashboard+testes existem; **migração não aplicada + gateway não redeployado** |
| Multi-tenant | **24** | Colunas de tenant existem, mas `empresa` hardcoded; efetivamente single-tenant |
| Frontend | **80** | Rico, responsivo/mobile, estados vazios honestos; aba Saúde chama endpoint não deployado |
| Backend | **62** | Funções deployadas + migrations até approvals; observabilidade pendente; sem chave |
| Testes | **48** | 110 unit sólidos; **zero** integração/RLS/cross-tenant/E2E |
| **Production Readiness** | **34** | Sem a chave nada de IA responde; observabilidade quebrada; tudo vazio |

---

## 18. Bloqueadores para produção

**P0 — CRÍTICO**
- `ANTHROPIC_API_KEY` **não configurada** → Copiloto/WhatsApp/`run_agent` não
  respondem. (Chave anterior foi exposta no chat → **rotacionar** e setar a nova
  como **secret no backend**.)

**P1 — ALTO**
- **Observabilidade não operante:** aplicar `20260814_ai_observability` **e**
  redeploy do `ai-gateway` (v7). Sem isso a aba **Saúde da IA** falha e o
  **guardrail de custo** não age.
- **Sem testes E2E/integração/RLS** contra o backend vivo (o sandbox impede;
  precisa ser feito no ambiente do dono).
- **Automações sem cron** → não rodam sozinhas (execução só manual).

**P2 — MÉDIO**
- **WhatsApp** sem config + secrets (não recebe/responde).
- **Leaked-password protection** desativada no Auth.
- **Copiloto** não envia `client_id` no contexto (embora existam clientes).
- **Conteúdo vazio** (RAG/Memória/Regras) → recursos "prontos e não exercidos".

**P3 — MELHORIA**
- Advisors: 6 funções `SECURITY DEFINER` de RBAC executáveis por `authenticated`
  (revisar `EXECUTE`/`SECURITY INVOKER` se não for intencional).
- **Single-tenant hardcoded** (`empresa='DF AGRO'`) — quando for SaaS, escopar por
  tenant de verdade (RPC/consultas).

---

## 19. Próximo passo (ordem de correção recomendada) — **não executar ainda**

1. **[P0]** Rotacionar a chave Anthropic e setar `ANTHROPIC_API_KEY` (backend).
2. **[P1]** Aplicar a migração `20260814_ai_observability` e **redeploy** do
   `ai-gateway`.
3. **[P1]** Smoke test **E2E** real: chat (uma tool), `{action:'health'}` e
   `{action:'metrics'}`, um insight, uma automação manual (`tick`).
4. **[P2]** Indexar ≥1 documento (RAG) e validar ≥1 memória — exercitar o fluxo.
5. **[P2]** Configurar WhatsApp (secrets + `whatsapp_config`) se for usar o canal.
6. **[P2]** Enviar `client_id` no contexto do Copiloto; ligar leaked-password.
7. **[P2]** Definir agendamento das automações (pg_cron chamando `tick`).
8. **[P3]** Revisar advisors `SECURITY DEFINER`; planejar multi-tenant real.

---

**Veredito honesto:** a **fundação é sólida e real** (não é fachada): código
verdadeiro, RLS em tudo, integrações reais, sem mock de dado falso, e as
invariantes de segurança (SENSITIVE só com admin, sem SQL livre do LLM, segredos
só no backend) **se sustentam**. Mas a **prontidão para produção é baixa** hoje:
sem a chave nada de IA responde, a observabilidade está fora do ar por
falta de migração+deploy, e todos os módulos estão **vazios/não configurados**.
É um sistema **"pronto para ligar", não "ligado"**.

**PARADO.** Nenhuma correção foi feita nesta auditoria (conforme instruído).
