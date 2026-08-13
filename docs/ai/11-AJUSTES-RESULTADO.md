# Fase 11 — Auditoria da camada de IA e ajustes — Resultado

**Data:** 2026-08-13
**Fase:** revisão de tudo que foi construído (FOUNDATION → Automações) e correção
dos pontos necessários. Aditivo; nada de dados alterado.

---

## 1. O que foi auditado

Toda a camada de IA em produção:

- **DB:** `ai_conversations`, `ai_messages`, `ai_audit_log`, `ai_knowledge_docs`,
  `ai_knowledge_chunks`, `ai_memory`, `automation_rules`, `ai_jobs`,
  `automation_runs` (+ funções `match_ai_knowledge`, `match_ai_memory`,
  `ai_memory_guard`, `automation_claim_jobs`, `automation_due_rules`).
- **Edge Functions:** `ai-gateway` (v4), `ai-knowledge` (v1), `ai-worker` (v2).
- **Front:** Copiloto (drawer), Conhecimento, Memória, Central de IA, Automações.

## 2. Achado principal (corrigido) — escrita liberada para leitor

**Problema:** todas as políticas de **escrita** (INSERT/UPDATE) das tabelas de IA
exigiam apenas `is_membro_ativo()`. Como `pode_editar()` = papel ∈ {admin,
editor}, um **`leitor`** (membro somente-leitura) podia **inserir/alterar**
documentos de conhecimento, memórias e regras de automação — violando o
`CLAUDE.md` (SAFE_WRITE = editor/admin) e o modo `somente-leitura` do painel.

**Correção (RLS — fonte da verdade):** migração `ai_write_requires_pode_editar`
recria as 10 políticas de INSERT/UPDATE exigindo
`((select auth.uid()) = user_id) and pode_editar()`. **Leitura permanece** para
qualquer membro ativo. Tabelas afetadas: `ai_knowledge_docs`,
`ai_knowledge_chunks`, `ai_memory`, `automation_rules`, `ai_jobs`,
`automation_runs`.

Verificado: **10/10** políticas de escrita agora usam `pode_editar()`.

## 3. Ajuste de UI — modo leitura nos painéis de IA

Front (`index.html`): novo `podeEditarIA()` (= editor/admin). Para **leitor**:

- **Conhecimento**: some o formulário "Adicionar documento" (vira aviso "🔒 Modo
  leitura") e as ações por linha (reprocessar/aprovar/desativar) viram "🔒
  leitura". Pesquisa e visualização continuam.
- **Memória**: some o formulário "Adicionar memória" e as ações
  validar/editar/invalidar. Pesquisa e visualização continuam.
- **Central de IA / Automações**: já eram **admin-only** (sem mudança).

Isso alinha a UI ao RLS (defesa em profundidade) e evita que o leitor receba
erros ao tentar escrever.

## 4. Ajuste no worker — não desperdiçar retries em erro terminal

`ai-worker` (v2): erros **terminais** (`not_configured` do `run_agent`, ação
desconhecida) **não são reprocessados** — o job vai direto para `erro` com a
mensagem, em vez de tentar 3×. Erros transitórios continuam com retry + backoff.

## 5. Itens verificados que estão OK (sem mudança)

- **Secrets:** `ANTHROPIC_API_KEY` só no backend; front nunca vê. CSP intocada.
- **Gateway SAFE_WRITE:** `propose_memory` já era bloqueado para leitor (gate
  `meu_papel`) — agora reforçado também no RLS.
- **Sem exclusões:** nenhuma tabela de IA tem GRANT de DELETE; memória usa
  INVALIDATED; jobs mudam de status; regras usam `ativo=false`.
- **Idempotência/dedupe** das automações: `unique(user_id, dedupe_key)`.
- **Advisors:** nenhum alerta novo além dos pré-existentes (SECURITY DEFINER do
  RBAC e leaked-password — pendência do dono).
- **Central admin-only** e Copiloto/context: testados nas fases 06/09.

## 6. Pendências que continuam (do dono — não são bugs)

- **`ANTHROPIC_API_KEY`**: sem o secret, o **chat** do Copiloto e a ação
  `run_agent` não respondem (retornam aviso amigável). Conhecimento (ingestão/
  busca com `gte-small`), Memória, Central e as automações `generate_summary`/
  `create_internal_alert` **funcionam sem esse secret**.
- **Leaked-password protection**: habilitar no painel (Auth).
- **`pg_cron` para o `tick`** das automações agendadas (opcional).

## 7. Arquivos

**Criados**
- `supabase/migrations/20260813_ai_write_requires_pode_editar.sql`
- `docs/ai/11-AJUSTES-RESULTADO.md`

**Modificados**
- `index.html` (`podeEditarIA()` + gating de escrita em Conhecimento/Memória)
- `supabase/functions/ai-worker/index.ts` (retry terminal) → deploy **v2 ACTIVE**

## 8. Testes executados

- **Migração/RLS:** 10/10 políticas de escrita com `pode_editar()`; advisors sem
  novos alertas.
- **UI (Chromium headless):** editor vê formulários/ações; **leitor** vê painéis
  "🔒 Modo leitura" sem botões de escrita; **0 erros de JS**.
- **Central (regressão):** teste de permissão admin/leitor segue válido.
- **Unitários (bun):** **41/41**.
- **Build:** `ai-worker` v2 ACTIVE (bundle Deno compilado).

## 9. Riscos / rollback

- Risco: BAIXO (correção de permissão + UI; nada destrutivo).
- Rollback RLS: recriar as políticas com `is_membro_ativo()`. Rollback UI/worker:
  reverter o commit / redeployar v1.

**PARADO.**
