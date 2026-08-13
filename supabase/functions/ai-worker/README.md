# ai-worker (Edge Function) — Automation Engine (Fase AUTOMAÇÕES)

Processa a fila **`ai_jobs`** (queue aprovada, doc 02 §12) e executa as regras de
`automation_rules` (TRIGGER / CONDITION / ACTION). **Sem ações financeiras. Sem
exclusões.** Retries controlados, dedupe por chave única (idempotência).

## Segurança

- `verify_jwt=true` + `auth.getUser()` + `is_membro_ativo()`.
- Tudo sob o **JWT do usuário** → a **RLS** é a barreira de tenant.
- A UI de Automações vive na **Central de IA** (somente admin).

## Ações (`POST`, `Authorization: Bearer <jwt>`)

| action | corpo | efeito |
| ------ | ----- | ------ |
| `run_rule` | `{ rule_id, idempotency_key? }` | enfileira (idempotente) + processa a regra agora; retorna os jobs processados. |
| `tick` | `{}` | enfileira schedules **due** (1×/dia, idempotente por data) + processa um lote. |

## Fluxo de um job

`claim atômico (automation_claim_jobs, FOR UPDATE SKIP LOCKED)` → carrega a regra
→ **CONDITION** (se falsa → `pulado`) → **ACTION** → grava `automation_runs` +
atualiza `ai_jobs` (ok) + `ultima_exec`. Em erro: `tentativas++`; se
`shouldRetry` → volta a `pendente` com backoff exponencial (`run_at` futuro);
senão → `erro`. Cada tentativa vira uma linha em `automation_runs`.

## Ações suportadas

- `generate_summary` — resumo **interno** determinístico a partir de `bi_*`
  (clientes, receita/custo da safra, docs indexados, memórias validadas). Sem
  LLM, sem custo. É a base da demo **"Resumo AP diário"**.
- `create_internal_alert` — registra um alerta interno (nível + mensagem) no
  `output` do run. Interno; não envia nada para fora.
- `run_agent` — chamada ao modelo (usa `ANTHROPIC_API_KEY`); opcional.

Nenhuma ação move dinheiro nem apaga dados.

## Idempotência / dedupe

`ai_jobs` tem **unique(user_id, dedupe_key)**. `enqueue` usa upsert com
`ignoreDuplicates` → nunca duplica um job da mesma chave lógica. Chaves:
`manual:<rule>:<bucket>` (bucket por minuto ou idempotency_key do cliente) e
`schedule:<rule>:<yyyy-mm-dd>` (um por dia).

## Agendamento autônomo (passo do dono — opcional)

Para o `tick` rodar sozinho (ex.: a cada hora), agende uma chamada a esta função
via `pg_cron` + `pg_net` (ou um agendador externo). Enquanto isso, o botão
**Executar** na UI dispara qualquer regra na hora. (Não habilitado por padrão
para não criar processo em segundo plano sem observabilidade.)

## Arquivos

- `index.ts` — worker (auth, claim, execução, retries, dedupe).
- `automation_logic.ts` — lógica pura (condition/retry/dedupe/schedule/summary), testável.
- `automation_logic.test.ts` — testes (bun).
- `deno.json` — config do runtime.

## Rollback

Remover/desabilitar a função; e/ou dropar as tabelas
(`automation_runs`, `ai_jobs`, `automation_rules`) e as funções
(`automation_claim_jobs`, `automation_due_rules`). App e BI seguem intactos.
