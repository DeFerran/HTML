# Fase 10 — Automation Engine — Resultado

**Data:** 2026-08-13
**Fase:** Automation Engine (fila + regras TRIGGER/CONDITION/ACTION + worker +
UI). **Sem WhatsApp.** Sem ações financeiras. Sem exclusões.
**Regra-mãe:** a IA é uma CAMADA. Tudo aditivo e isolado; nada toca
`painel_estado`, `bi_*`, `membros`, funções ou gatilhos existentes.

---

## 1. Objetivo realizado

Motor de automações com **fila aprovada (`ai_jobs`)**, separando **TRIGGER**
(quando), **CONDITION** (se) e **ACTION** (o quê); worker que processa a fila com
**retries controlados**, **dedupe/idempotência** e **histórico**; UI em
**Inteligência Artificial → Automações** (na Central, **somente admin**); e uma
**demo segura "Resumo AP diário"** que apenas gera resumo interno.

## 2. Tabelas criadas (migração aditiva aplicada)

| Tabela | Papel | Notas |
| ------ | ----- | ----- |
| `automation_rules` | regras (trigger/condition/action) | `ativo` liga/desliga; **sem DELETE**. |
| `ai_jobs` | **fila aprovada** | status pendente/rodando/ok/erro, `tentativas`, `max_tentativas`, `run_at`, **unique(user_id, dedupe_key)**; **sem DELETE**. |
| `automation_runs` | histórico de execuções | log **imutável** (só select/insert). |

Funções: `automation_claim_jobs(n)` (claim atômico `FOR UPDATE SKIP LOCKED`, RLS)
e `automation_due_rules()` (schedules ativos). Ambas SECURITY INVOKER,
`search_path` fixo. **RLS** por `user_id` + `is_membro_ativo()` em tudo.

## 3. TRIGGER / CONDITION / ACTION

- **TRIGGER** (`trigger_type`): `schedule`, `database_event`, `manual`.
  - `manual`: botão **Executar** (funciona já).
  - `schedule`: `trigger_config.frequencia` (daily/hourly); `tick` enfileira os
    "due" idempotentemente (1×/dia). Firing autônomo via `pg_cron` é passo
    **opcional do dono** (documentado; não habilitado para não criar processo
    sem observabilidade).
  - `database_event`: tipo suportado + config; enganchar gatilho em tabela fica
    para ativação futura (não anexamos triggers a tabelas existentes).
- **CONDITION** (`condition` jsonb): vazio = sempre; senão `{campo,op,valor}`
  (>, >=, <, <=, ==, !=, contains) avaliado contra um contexto real (clientes,
  receita, custo, margem da safra).
- **ACTION** (`action_type`): `run_agent`, `create_internal_alert`,
  `generate_summary`. **Nenhuma ação financeira; nenhuma exclusão.**

## 4. Retries, dedupe, idempotência

- **Retries controlados:** em erro, `tentativas++`; se `< max_tentativas` volta a
  `pendente` com **backoff exponencial** (30s, 60s, 120s… teto 900s) via `run_at`
  futuro; senão `erro`. Cada tentativa gera uma linha em `automation_runs`.
- **Evitar duplicação:** `unique(user_id, dedupe_key)` + `enqueue` com upsert
  `ignoreDuplicates` → nunca dois jobs da mesma chave lógica.
- **Idempotência:** chaves `manual:<rule>:<bucket-min|idempotency_key>` e
  `schedule:<rule>:<yyyy-mm-dd>`. Cliques repetidos / ticks do mesmo dia não
  duplicam.

## 5. Interface (Automações)

Na Central de IA (**admin**): criar, **editar** (carrega a regra no formulário),
**ativar/desativar** (`ativo`), **executar manualmente** (chama `ai-worker`),
**visualizar histórico** (`automation_runs`) e **visualizar erro** (coluna
Resultado/Erro). Botão **"Criar demo segura (Resumo AP diário)"**.

## 6. Demo segura — "Resumo AP diário"

Regra: trigger `schedule` (daily), action `generate_summary` (safra 26/27),
condition vazia. Ao executar, o worker lê `bi_*`/`ai_*` e compõe um **resumo
interno** (clientes, receita/custo/margem da safra, docs indexados, memórias
validadas) — determinístico, **sem LLM, sem custo, sem ação externa**.

## 7. Arquivos

**Criados**
- `supabase/functions/ai-worker/{index.ts, automation_logic.ts, automation_logic.test.ts, deno.json, README.md}`
- `supabase/migrations/20260813_ai_automation_engine.sql`
- `docs/ai/10-AUTOMACOES-RESULTADO.md`

**Modificados**
- `index.html` — painel **Automações** real dentro da Central (antes "Em
  implantação") + rota. Aditivo; nenhuma view/dado existente alterado; CSP intocada.

**Backend novo:** Edge Function `ai-worker` (deploy v1 ACTIVE, `verify_jwt=true`).

## 8. Testes executados

### Unitários (bun) — **41/41** (4 arquivos, +7 de automação)

`automation_logic.test.ts`: condition (numérica/textual/contains), retry
(`shouldRetry`), **backoff com teto**, **dedupe estável** (idempotência),
**schedule due 1×/dia**, `buildDailySummary` (resumo interno, sem inventar).
(Mantidos os 34 testes das fases anteriores.)

### UI (Chromium headless / Playwright) — **PASSOU**

Admin: `iahubGo('automacoes')` renderiza o formulário, a config por ação muda ao
trocar o tipo (summary → alert), o botão da demo aparece, e **Executar** chama o
worker (stub) sem erro. **0 erros de JS**.

### Estrutura / build / advisors

- 3 tabelas, 8 policies, **DELETE grants = 0**, unique dedupe, 2 funções — OK.
- `get_advisors`: **nenhum alerta novo**.
- Deploy `ai-worker` **v1 ACTIVE** = bundle Deno compilado server-side.
- Sintaxe do `index.html`: OK.

### Limite do ambiente (não é defeito)

- Execução real da fila ponta-a-ponta (HTTP ao worker) segue bloqueada no sandbox
  (proxy nega `*.supabase.co`; `execute_sql` é read-only, não faz INSERT). A
  lógica (claim/retry/dedupe/condition/summary) foi validada por testes unitários
  + estrutura + build. Recomenda-se um teste manual pelo dono (botão Executar).

## 9. Riscos

| Risco | Nível | Observação |
| ----- | ----- | ---------- |
| Ação perigosa/financeira | NENHUM | Só 3 ações seguras; nada move dinheiro; nada apaga. |
| Job duplicado | BAIXO | unique(dedupe_key) + upsert ignoreDuplicates. |
| Loop de retry | BAIXO | `max_tentativas` + backoff com teto. |
| Não-admin operar | BAIXO | UI só na Central (admin) + guarda; RLS por usuário. |
| Schedule não disparar sozinho | INFORMADO | firing autônomo é passo do dono (pg_cron); manual funciona já. |

## 10. Rollback

- **Front:** reverter o commit (ou `df_ia_kb='0'`).
- **Backend:** remover/desabilitar `ai-worker`.
- **Banco:** `DROP FUNCTION automation_claim_jobs, automation_due_rules; DROP
  TABLE automation_runs, ai_jobs, automation_rules CASCADE;`.
Nada afeta `painel_estado`, `bi_*`, `membros`, funções ou gatilhos.

## 11. Pendências

- (Opcional) habilitar `pg_cron` para o `tick` autônomo (passo do dono).
- Configurar `ANTHROPIC_API_KEY` se usar a ação `run_agent` (a demo não usa).
- Teste manual end-to-end pelo dono (Executar a demo).

## 12. Próxima fase sugerida

- **Aprovações (Approval Engine)** — trava humana para ações SENSITIVE_WRITE,
  antes de conectar automações a ações que alterem dados.
- **Alertas Inteligentes** consumindo `create_internal_alert` + uma tela própria.
- **WhatsApp** só depois, com webhook seguro no backend.

**Não iniciar sem ordem explícita do usuário.**

---

_PARADO conforme a regra de implementação incremental._
