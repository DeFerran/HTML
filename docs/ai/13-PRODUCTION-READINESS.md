# 13 — Production Readiness (Hardening + 1ª camada de IA proativa)

**Data:** 2026-08-14
**Escopo:** endurecimento (observabilidade, guardrails de custo, alertas técnicos,
AI Health Dashboard) + **primeira camada de IA proativa** (detectores seguros →
insights → "Prioridades da IA"). Nada executa ação externa automaticamente.

## Legenda

- **READY** — pronto para produção; validado no que o ambiente permite.
- **READY WITH RESTRICTIONS** — pronto, porém depende de configuração do dono
  e/ou de um smoke test end-to-end real (o sandbox bloqueia HTTP a `supabase.co`
  e não tem `ANTHROPIC_API_KEY`).
- **NOT READY** — não deve ir a produção ainda.

## Limite honesto do ambiente

Todo o código foi validado por: **77 testes unitários** (bun), **transpile** das
Edge Functions, **parse** de todos os scripts do `index.html` e **render headless**
(Chromium) das telas novas com **0 erros de JS**. O que **não** dá para validar
aqui e fica para o dono: chamadas reais a `supabase.co`, aplicação das migrações
em produção, e a `ANTHROPIC_API_KEY`. Esses pontos estão marcados como restrição.

---

## Status por módulo

| Módulo | Status | Justificativa / Restrições |
|---|---|---|
| **Observabilidade (métricas)** — `observability.ts` + `{action:'metrics'}` | **READY WITH RESTRICTIONS** | Lógica pura 100% testada (13 testes). Agrega `ai_audit_log`+`ai_jobs`+`automation_runs`. Restrição: requer a migração `20260814_ai_observability.sql` aplicada e ser admin; números reais dependem de tráfego. |
| **AI Health Dashboard** (aba *Saúde da IA*) | **READY** | Render validado (headless, claro/escuro, 0 erro). Mostra sucesso, erros, latência p95/média, tokens (in/out), custo, volume, tool/queue/automation failures, alertas técnicos e orçamento. Degrada com mensagem clara se o backend não responder. |
| **Guardrails de custo** (orçamento tokens/dia por tenant e usuário) | **READY WITH RESTRICTIONS** | `costGuard`/`budgetStatus` testados. Ligado no gateway antes do modelo; **fail-open** se a medição falhar (disponibilidade > corte rígido; o rate-limit/min já limita abuso). Restrição: limites vêm de env (`AI_DAILY_TOKEN_LIMIT`, `AI_DAILY_USER_TOKEN_LIMIT`) — **0 = ilimitado por padrão**; o dono precisa definir os tetos. Total do tenant usa a RPC `ai_usage_today` (migração). |
| **Alertas técnicos** (`deriveTechnicalAlerts`) | **READY** | Testado (modelo não configurado→crítico; erro alto; fila; automação; orçamento). Exibidos no dashboard. Persistência automática em `ai_alerts` **desligada de propósito** (evita spam) — pode ser promovida por ação humana. |
| **Detectores proativos** (5) + **Prioridades da IA** | **READY** | Motor **puro e testado** (8 testes) + UI validada. Cada insight traz os 6 campos: o que aconteceu, por quê, dados usados, impacto, confiança, próxima ação. **READ-only**: nenhuma ação externa. Ver nota de calibração abaixo. |
| **ai-gateway (Copiloto + READ tools)** | **READY WITH RESTRICTIONS** | Auth+tenant+RLS+rate-limit+timeout+erro já cobertos; tools READ testadas. Restrição: chat real exige `ANTHROPIC_API_KEY` e HTTP a `supabase.co`. |
| **ai-actions (Approval Engine)** | **READY WITH RESTRICTIONS** | SAFE executa; SENSITIVE só **propõe** (aprovação de admin). Lógica testada. Restrição: E2E real = dono. |
| **ai-worker (Automações/fila)** | **READY WITH RESTRICTIONS** | Fila `ai_jobs` (claim/dedupe/idempotência) + `automation_runs`; retries testados (`shouldRetry`/`retryDelaySeconds`). Restrição: agendamento autônomo (`pg_cron`) é opcional; execução manual funciona; E2E = dono. |
| **ai-knowledge (RAG)** | **READY WITH RESTRICTIONS** | Chunking testado; embeddings nativas (`gte-small`). Restrição: indexação/consulta reais = dono. |
| **ai-memory** | **READY WITH RESTRICTIONS** | IA só **propõe** (PENDING); trigger `ai_memory_guard` reforça no banco. Restrição: E2E = dono. |
| **ai-whatsapp** | **READY WITH RESTRICTIONS** | `wa_logic` testado; orchestrator read-only, single-tenant. Restrição: secrets do WhatsApp + indisponibilidade do canal = validação do dono. |
| **RLS / cross-tenant** | **READY WITH RESTRICTIONS** | Políticas por `user_id`+`is_membro_ativo()`; `ai_audit_log` admin-wide; RPC de uso é aggregate-only (não vaza linhas). Hoje **single-tenant** (`empresa='DF AGRO'`); isolamento cross-tenant real só é exercitável quando houver 2+ tenants (SaaS futuro). |
| **Rate limit** | **READY WITH RESTRICTIONS** | 30/min por usuário, contando **runs**. Lógica revisada; efeito real = HTTP (dono). |
| **Multi-tenant/plano (limites por plano)** | **NOT READY (por design)** | A arquitetura é single-tenant hoje. A lógica de guardrail já aceita limites por escopo (tenant/usuário) e a RPC tem o ponto de extensão documentado; limites **por plano** entram quando o SaaS existir. |

---

## Matriz de testes solicitada

| Teste | Situação |
|---|---|
| **Unitários** | ✅ **77/77** (observabilidade 13, detectores 8, automação, approval, whatsapp, chunking, read tools, memória). |
| **Integração** | ⚠️ Edge Functions com **transpile OK**; E2E real bloqueado no sandbox (dono). |
| **RLS** | ⚠️ Políticas revisadas (por usuário + admin); teste ao vivo = dono. |
| **Cross-tenant** | ⚠️ Single-tenant hoje; estrutura pronta; exercício real quando SaaS. |
| **Rate limit** | ⚠️ Lógica revisada (30/min por run); efeito real = dono. |
| **Queue** | ⚠️ `ai_jobs` claim/dedupe + `automation_runs`; retries **testados**; E2E = dono. |
| **Retries** | ✅ Unit (`shouldRetry`, `retryDelaySeconds`, backoff) · ⚠️ live = dono. |
| **Modelo indisponível** | ✅ Unit (`deriveTechnicalAlerts` → `model_unconfigured` crítico; provider lança erro tratado) · ⚠️ live = dono. |
| **WhatsApp indisponível** | ⚠️ `wa_logic` testado; canal fora do ar = validação do dono. |
| **Dados ausentes** | ✅ Detectores com estado vazio → `[]`; READ tools retornam `disponivel=false` (nunca inventam). |

---

## Nota de calibração dos detectores (importante — sem dados fictícios)

A plataforma **não** possui registros individuais de coleta/análise com
data/status de calendário. O mecanismo real é **por safra**
(`clientes.ultimaColeta` + `cicloColeta` → `proximaColeta`), custo/ha por serviço
e checagens de cadastro. Por isso os 5 detectores foram **ancorados no dado real**
(nunca inventando):

1. **Nova análise de laboratório disponível** — clientes de Fertilidade com coleta
   lançada na safra ativa (análise pronta para entrega).
2. **Coleta/recoleta devida** — ciclo de coleta vencido (proximaColeta ≤ safra atual).
3. **Coleta concluída** — etapas de operação marcadas como concluídas (`D.operacao.etapas`).
4. **Custo/ha acima do parâmetro** — serviços cuja margem de contribuição fica
   abaixo do alvo (`metasServico.margemGeralMeta`) ou custo/ha ≥ preço/ha.
5. **Dado importante faltante** — clientes sem serviço/vendedor/ciclo; serviços sem área.

Fluxo garantido: **detectar → analisar → criar insight → mostrar**. Nenhuma ação
externa é executada; cada insight só **sugere** a próxima ação.

---

## O que o dono precisa fazer para ir 100% a produção

1. Aplicar a migração `supabase/migrations/20260814_ai_observability.sql`.
2. Redeploy do `ai-gateway` (novo `{action:'metrics'}` + guardrail + split de tokens).
3. Configurar `ANTHROPIC_API_KEY` (bloqueio real do Copiloto) e, se desejar,
   `AI_DAILY_TOKEN_LIMIT` / `AI_DAILY_USER_TOKEN_LIMIT` (guardrails).
4. Rodar um **smoke test end-to-end** real (chat, uma automação, um insight, o
   dashboard de Saúde) — o único passo que o sandbox não permite.

**Veredito geral:** a camada está **READY WITH RESTRICTIONS** — código completo,
seguro e testado no que o ambiente permite; só falta a configuração/o E2E do dono.
