# Fase 14 — Copiloto liga-se às Action Tools (propor/executar) — Resultado

**Data:** 2026-08-13
**Fase:** wire do Copiloto (gateway) ao Approval Engine — a IA **propõe**
SENSITIVE e **executa** SAFE_WRITE de fato dentro do chat, via `ai-actions`.
Aditiva e isolada.

---

## 1. Objetivo realizado

O Copiloto agora pode, dentro da conversa:
- **executar SAFE_WRITE** (`create_internal_alert`, `create_task`,
  `generate_report_draft`) — direto, para editor/admin;
- **propor SENSITIVE_WRITE** (`send_external_whatsapp_message`) — que **não
  envia**: cria uma **aprovação pendente** para um admin decidir.

Tudo passando pela **fonte única** `ai-actions` (allowlist + guarda contra ações
proibidas + auditoria + RLS). O gateway apenas **encaminha** com o **JWT do
usuário** — logo, as permissões do próprio usuário se aplicam.

## 2. Como ficou

- **Registro de tools do gateway** ganhou 4 ações, com **classe declarada**
  (`SAFE_WRITE`/`SENSITIVE_WRITE`). Os handlers **não gravam direto**: chamam
  `ctx.callActions` → `POST /functions/v1/ai-actions` com o header de auth do
  usuário.
- **Gate no loop de tools:** `SAFE_WRITE` **e** `SENSITIVE_WRITE` exigem
  editor/admin (`podeEscrever`); leitor é bloqueado antes de qualquer chamada.
- **SENSITIVE nunca executa no gateway:** o handler chama `propose` (cria
  `ai_approvals` pendente) e responde "aguarda aprovação". A execução real só
  ocorre quando um **admin aprova** (fase anterior).
- **System prompt** atualizado: instrui a IA a deixar claro que envio externo é
  só proposta e a **nunca prometer** que algo sensível foi feito sem aprovação.
- **Auditoria:** cada `tool_call` já é logado em `ai_audit_log` com o **nível
  real** (READ/SAFE_WRITE/SENSITIVE_WRITE); o `ai-actions` audita a execução.

## 3. Arquivos

**Modificados**
- `supabase/functions/ai-gateway/tools/types.ts` (nível +SENSITIVE_WRITE; `ctx.callActions`)
- `supabase/functions/ai-gateway/tools/read_tools.ts` (+4 action tools; forward p/ ai-actions)
- `supabase/functions/ai-gateway/tools/read_tools.test.ts` (+testes das action tools)
- `supabase/functions/ai-gateway/index.ts` (`callActions`, gate SENSITIVE, prompt)
- `supabase/functions/ai-gateway/README.md`

**Backend:** `ai-gateway` redeploy **v5 ACTIVE** (`verify_jwt=true`). Nenhuma
tabela/migração nova (reusa `ai-actions` e as tabelas da fase anterior).

## 4. Testes executados

### Unitários (bun) — **56/56** (+5 das action tools)

`read_tools.test.ts`: `create_task`/`create_internal_alert`/
`generate_report_draft` encaminham **`execute_safe`**;
`send_external_whatsapp_message` encaminha **`propose`** (nunca executa) e
retorna `status='pendente'` + aviso "aguarda"; sem `callActions` no contexto →
`disponivel=false`; níveis corretos no registro. (Mantidos os 51 anteriores.)

### Build

- Deploy `ai-gateway` **v5 ACTIVE** = bundle Deno compilado com as 4 tools.
- Transpile de `index.ts`/`read_tools.ts`/`types.ts`: OK.

### Limite do ambiente (não é defeito)

- Chat real ponta-a-ponta (gateway → ai-actions) depende de HTTP a `supabase.co`,
  bloqueado no sandbox, e de `ANTHROPIC_API_KEY`. Validado por unit tests (o
  encaminhamento e as classes) + build. E2E é do dono.

## 5. Segurança / invariantes preservadas

- SENSITIVE **nunca** executa sem aprovação de admin (gateway só propõe; RLS
  `ai_approvals.update = is_admin()`).
- Leitor não escreve (gate no gateway + `pode_editar()` no RLS + checagem no
  `ai-actions`).
- Ações proibidas (delete/finanças/agronômica final) barradas pela allowlist +
  guarda do `ai-actions`.

## 6. Rollback

Reverter o `ai-gateway` para v4 (sem as action tools) ou `git revert` do commit.
Sem mudanças de banco nesta fase.

## 7. Próxima fase sugerida

- Telas de **Alertas** e **Tarefas** (consumir `ai_alerts`/`ai_tasks`) e de
  **rascunhos** (`ai_report_drafts`).
- Aba **Alertas Inteligentes** ligada a `create_internal_alert`.

**Não iniciar sem ordem explícita do usuário.**

---

_PARADO conforme a regra de implementação incremental._
