# Fase 17 — Hardening + 1ª camada de IA proativa — Resultado

**Data:** 2026-08-14
**Fase:** endurecimento (observabilidade/guardrails/alertas técnicos/AI Health
Dashboard) + **primeira camada de IA proativa** (detectores seguros → insights →
"Prioridades da IA"). Aditiva, sem tocar em dados/lógica de negócio existentes.

---

## 1. Objetivo realizado

### Observabilidade
- Novo módulo **puro** `ai-gateway/observability.ts`: `summarizeAudit` (taxa de
  sucesso, erros, latência avg/p95, tokens in/out, custo, volume, tool failures),
  `estimateCostUsd` (preços por modelo), `budgetStatus`/`costGuard`,
  `deriveTechnicalAlerts`.
- Endpoint **`{action:'metrics'}`** no `ai-gateway` (admin, sem run/rate-limit):
  agrega `ai_audit_log` + `ai_jobs` (queue failures) + `automation_runs`
  (automation failures) + orçamento do dia.
- `ai_audit_log` do run agora grava **`tokens_in`/`tokens_out`/`custo_usd`**.

### Guardrails de custo
- Orçamento **tokens/dia por tenant e por usuário** checado antes de chamar o
  modelo (env `AI_DAILY_TOKEN_LIMIT` / `AI_DAILY_USER_TOKEN_LIMIT`; 0 = ilimitado).
  Total do tenant via RPC agregada `ai_usage_today` (não vaza linhas). SaaS-ready
  (limites por escopo; ponto de extensão por plano documentado).

### Alertas técnicos
- `deriveTechnicalAlerts`: modelo não configurado (crítico), erro alto, latência,
  tool/queue/automation failures, custo e orçamento perto do teto. Exibidos no
  dashboard (persistência automática desligada de propósito).

### AI Health Dashboard
- Nova aba **Saúde da IA** (Central de IA, admin) consumindo `{action:'metrics'}`:
  KPIs + alertas técnicos + orçamento + "ferramentas que mais falham".

### 1ª camada de IA proativa (5 detectores seguros)
- Motor **puro e testável** `AIDetectors` (bloco `// <ai-detectors>` no `index.html`):
  1) nova análise de laboratório disponível; 2) coleta/recoleta devida;
  3) coleta concluída; 4) custo/ha acima do parâmetro; 5) dado importante faltante.
- Fluxo **detectar → analisar → criar insight → mostrar**; **nenhuma ação externa**.
- Nova aba **Prioridades da IA**: cada insight traz **o que aconteceu, por que
  chamou atenção, dados utilizados, impacto, confiança e próxima ação sugerida**.
- **Calibração honesta:** a plataforma não tem coleta/análise por data de
  calendário; os detectores foram ancorados no mecanismo real (ciclo por safra,
  custo/ha, cadastro), sem inventar dados (ver `docs/ai/13-PRODUCTION-READINESS.md`).

## 2. Arquivos

**Criados**
- `supabase/functions/ai-gateway/observability.ts` (+ `.test.ts`)
- `supabase/migrations/20260814_ai_observability.sql` (colunas de custo + RPC `ai_usage_today`)
- `tests/detectors.test.ts` (extrai e testa o bloco puro do index.html)
- `docs/ai/13-PRODUCTION-READINESS.md`, `docs/ai/16-HARDENING-PROATIVA-RESULTADO.md`

**Modificados**
- `supabase/functions/ai-gateway/index.ts` (`{action:'metrics'}`, guardrail de
  custo, split de tokens + custo no log)
- `index.html` (motor de detectores; `buildDetectStateFromD`; abas
  `iahubPrioridades` e `iahubSaude`; itens na sidebar + `IAHUB_SUBS`; ícones SVG)

## 3. Testes executados

- **Unitários (bun): 77/77** (+13 observabilidade, +8 detectores; 56 anteriores).
- **Transpile** de `ai-gateway/index.ts` e `observability.ts`: OK.
- **Parse** de todos os scripts do `index.html`: OK (baseline inalterada).
- **Render headless (Chromium):** *Prioridades da IA* (com os 6 campos por card)
  e *Saúde da IA* (todos os KPIs + alertas + orçamento) — **0 erros de JS**, claro
  e escuro.
- **Matriz solicitada:** ver tabela em `docs/ai/13-PRODUCTION-READINESS.md`
  (unit ✅; integração/RLS/cross-tenant/rate-limit/queue/live = dono, por limite
  do sandbox; retries/modelo-indisponível/dados-ausentes cobertos por unit).

## 4. Segurança / invariantes preservadas

- Secrets só no backend; CSP intocada. Nenhum DROP/DELETE; migração **aditiva**.
- RLS intacta; a RPC de uso é **aggregate-only** (SECURITY DEFINER sem vazar linhas).
- Camada proativa é **READ-only**; não executa ação externa.

## 5. Riscos / rollback

- Risco: BAIXO (aditivo; guardrail fail-open para não derrubar disponibilidade).
- Rollback: `git revert` do commit; migração reversível (drop das colunas + função).

## 6. Pendências (dono)

1. Aplicar `20260814_ai_observability.sql` e redeploy do `ai-gateway`.
2. Configurar `ANTHROPIC_API_KEY` e, opcionalmente, os tetos de tokens/dia.
3. Smoke test end-to-end real (o sandbox não permite HTTP a `supabase.co`).

**Veredito:** camada **READY WITH RESTRICTIONS** — completa, segura e testada no
que o ambiente permite.

**PARADO** conforme a regra de implementação incremental.
