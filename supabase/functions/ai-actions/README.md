# ai-actions (Edge Function) — Action Tools + Approval Engine

`verify_jwt=true`. Classes de ação: **READ** (gateway), **SAFE_WRITE** e
**SENSITIVE_WRITE**. Tudo sob o JWT do usuário (RLS) + auditoria (`ai_audit_log`).

## Ações (`POST`)

| action | quem | efeito |
| ------ | ---- | ------ |
| `execute_safe {tool,payload}` | editor/admin | executa SAFE_WRITE direto: `create_internal_alert` (→ai_alerts), `create_task` (→ai_tasks), `generate_report_draft` (→ai_report_drafts). |
| `propose {tool,entity_*,payload,risco}` | editor/admin | cria `ai_approvals` **pendente** para uma SENSITIVE_WRITE (não executa). |
| `decide {approval_id,decision,payload?}` | **admin** | `reject`/`edit`/`approve`. Approve **executa** a ação sensível (ex.: `send_external_whatsapp_message` via Graph API) e grava `executado`/`erro`. |

## Regras

- **SENSITIVE_WRITE nunca executa sozinha** — sempre passa por `ai_approvals` e
  aprovação de **admin** (RLS `update = is_admin()`).
- **Proibido** (allowlist rígida + guarda por regex): delete, finanças
  automáticas, recomendação agronômica final automática.
- Toda operação é auditada em `ai_audit_log` com a classe (nível).

## Secrets (backend)
`WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` para executar o envio externo
na aprovação. `SUPABASE_ANON_KEY` injetado.

## Arquivos
- `index.ts` — engine (execute_safe/propose/decide + executores).
- `approval_logic.ts` — classes/permissões/estados (puro, testável).
- `approval_logic.test.ts` — testes (bun).

## Rollback
Desabilitar/remover a função; DROP das tabelas `ai_approvals`/`ai_alerts`/
`ai_tasks`/`ai_report_drafts`. App/BI intactos.
