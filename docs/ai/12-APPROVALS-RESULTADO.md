# Fase 13 — Action Tools controladas + Approval Engine — Resultado

> Arquivo `docs/ai/12-APPROVALS-RESULTADO.md` conforme solicitado.

**Data:** 2026-08-13
**Fase:** classes de ação (READ / SAFE_WRITE / SENSITIVE_WRITE) + Approval Engine.
Aditiva e isolada. **Sem delete, sem finanças automáticas, sem recomendação
agronômica final automática.**
**Regra-mãe:** a IA é uma CAMADA. Nada toca `painel_estado`, `bi_*`, `membros`,
funções ou gatilhos existentes.

---

## 1. Classes de ação

| Classe | Execução | Quem |
| ------ | -------- | ---- |
| **READ** | direta (Copiloto/gateway) | membro ativo |
| **SAFE_WRITE** | direta, reversível/interna | editor/admin |
| **SENSITIVE_WRITE** | **nunca sozinha** → aprovação humana | propor: editor/admin · **decidir: admin** |

Registro **allowlist rígido** + guarda por regex contra ações proibidas
(delete/apagar/excluir, finanças/pagamento/transferência, recomendação/agronômica
final). Qualquer nome fora da allowlist ou que bata na guarda ⇒ recusado.

## 2. Ferramentas desta fase

- **SAFE_WRITE:** `create_internal_alert` (→ `ai_alerts`), `create_task`
  (→ `ai_tasks`), `generate_report_draft` (→ `ai_report_drafts`).
- **SENSITIVE_WRITE:** `send_external_whatsapp_message` (envio externo — exige
  aprovação; risco alto).

## 3. Fluxo obrigatório (SENSITIVE_WRITE)

`IA propõe → ai_approvals 'pendente' → admin analisa → Aprovar / Editar / Rejeitar
→ (Aprovar) executa → status executado/erro → auditoria`.

- **Propor** (`propose`): editor/admin cria a proposta pendente. **Não executa.**
- **Aprovar** (`decide approve`): admin — executa a ação e grava
  `executado`/`erro` + `resultado`.
- **Editar** (`decide edit`): admin — ajusta o `payload`; **continua pendente**.
- **Rejeitar** (`decide reject`): admin — `rejeitado`.
- Toda decisão/execução é auditada em `ai_audit_log` (com a classe/nível).

## 4. Tabelas criadas (migração aditiva aplicada)

`ai_approvals` (fila de aprovação), `ai_alerts`, `ai_tasks`, `ai_report_drafts`.
**RLS:** leitura por membro (approvals: dono **ou** admin); escrita SAFE_WRITE por
`pode_editar()`; **decisão em `ai_approvals` só `is_admin()`** (update policy).
**Zero GRANT de DELETE** (verificado = 0) — sem exclusões.

## 5. Backend (`ai-actions`, deploy v1 ACTIVE, verify_jwt=true)

`execute_safe` (editor/admin), `propose` (editor/admin, só SENSITIVE),
`decide` (**admin**). Executores: SAFE_WRITE inserem nos respectivos artefatos;
o SENSITIVE `send_external_whatsapp_message` é executado **apenas na aprovação**
(Graph API com retry). Toda operação é auditada. `approval_logic.ts` é puro e
testável.

## 6. Tela (INTELIGÊNCIA ARTIFICIAL → Aprovações) — admin

Mostra: **ação** (tool), **agente**, **usuário solicitante**, **entidade**,
**payload**, **data**, **risco** (badge) e status. Botões por proposta pendente:
**Aprovar · Editar · Rejeitar**. Inclui um "Propor (teste)" de
`send_external_whatsapp_message` que cria uma pendência (não envia nada até a
aprovação).

## 7. Não implementado nesta fase (proibido)

`delete`, **alterações financeiras automáticas**, **alteração automática de
recomendação agronômica final** — barrados pela allowlist + guarda.

## 8. Arquivos

**Criados**
- `supabase/functions/ai-actions/{index.ts, approval_logic.ts, approval_logic.test.ts, deno.json, README.md}`
- `supabase/migrations/20260813_ai_approvals_and_actions.sql`
- `docs/ai/12-APPROVALS-RESULTADO.md`

**Modificados**
- `index.html` — painel **Aprovações** real na Central (antes "Em implantação") + rota.

## 9. Testes executados

### Unitários (bun) — **51/51** (6 arquivos, +5 do Approval Engine)

`approval_logic.test.ts`: classes das ferramentas; **ações proibidas** nunca
permitidas (delete/finanças/agronômica final); permissões (SAFE_WRITE =
editor/admin; **decidir = só admin**); risco padrão; máquina de estados
(approve→executado/erro, reject→rejeitado, edit→pendente); registro só com as 4
ações desta fase.

### Permissionamento (Chromium headless) — **PASSOU**

- **admin**: painel Aprovações com **Aprovar/Editar/Rejeitar** e risco; sem
  "Acesso restrito".
- **leitor**: **"Acesso restrito"**, sem botões de decisão.
- 0 erros de JS em ambos.

### Estrutura / build / advisors

- 4 tabelas; `ai_approvals.update = is_admin()`; **DELETE grants = 0**.
- Deploy `ai-actions` **v1 ACTIVE** (bundle Deno compilado).
- Sintaxe do `index.html`: OK.

### Limite do ambiente (não é defeito)

- Execução real ponta-a-ponta (HTTP à função / Graph API) bloqueada no sandbox.
  Validado por unit tests + estrutura/RLS + build + teste de UI. Teste E2E é do
  dono (após configurar os secrets do WhatsApp).

## 10. Riscos

| Risco | Nível | Observação |
| ----- | ----- | ---------- |
| Ação sensível sem aprovação | NENHUM | SENSITIVE nunca executa direto; RLS `update=is_admin`. |
| Não-admin decidir | BAIXO | UI admin-only + `ai-actions` checa `is_admin` + RLS. |
| Ação proibida | BAIXO | allowlist + guarda por regex; fora dela ⇒ recusa. |
| Exclusão de dados | NENHUM | Sem DELETE em nenhuma tabela. |

## 11. Rollback

- **Front:** reverter o commit.
- **Backend:** desabilitar/remover `ai-actions`.
- **Banco:** `DROP TABLE ai_report_drafts, ai_tasks, ai_alerts, ai_approvals CASCADE;`.

## 12. Próxima fase sugerida

- Wire do **Copiloto** (gateway) para **propor** SENSITIVE e **executar**
  SAFE_WRITE via `ai-actions` (a IA propondo de fato dentro do chat).
- Telas de **Alertas** e **Tarefas** consumindo `ai_alerts`/`ai_tasks`.

**Não iniciar sem ordem explícita do usuário.**

---

_PARADO conforme a regra de implementação incremental._
