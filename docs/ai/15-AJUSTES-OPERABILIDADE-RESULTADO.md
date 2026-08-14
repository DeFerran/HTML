# Fase 16 — Análise de especialista: correções e operabilidade — Resultado

**Data:** 2026-08-13
**Fase:** revisão da camada de IA inteira, focando no **realmente necessário**:
uma **correção de bug** e a **operabilidade** (o dono saber o que falta configurar).

---

## 1. Bug de correção (crítico) — rate limit contava tool_calls

**Problema:** o rate limit do gateway contava **todas** as linhas de
`ai_audit_log` do usuário nos últimos 60s. Como cada turno do Copiloto agora gera
**várias `tool_call`** (e ainda chama `ai-actions`), poucos turnos com
ferramentas estouravam o teto de 30/min e **travavam o usuário** com `429`.

**Correção:** o contador passou a filtrar **`tipo='run'`** — conta **turnos**,
não tool_calls. Assim o limite volta a significar "30 mensagens/min", como
pretendido. (`ai-gateway` v6.)

## 2. Operabilidade — painel Configurações (saúde)

**Problema:** nada indicava ao dono **o que está pronto e o que falta** (a chave
da IA, o WhatsApp). Sem a `ANTHROPIC_API_KEY`, o chat só "não responde", sem
diagnóstico.

**Solução:**
- Novo endpoint **`{action:'health'}`** no `ai-gateway` (após auth+membro; não
  gera run nem consome rate limit) → `{ anthropic_configured, model, papel }`.
- Submenu **Configurações** (antes "Em implantação") virou um **diagnóstico**
  (admin): status do gateway, da **chave da IA** (Anthropic + modelo), da Base de
  Conhecimento/Memória (sempre OK, `gte-small` nativo), Automações, Aprovações e
  **WhatsApp** (do `whatsapp_config`), além de uma **checklist de pendências do
  dono**. Os segredos continuam **só no backend** — a tela mostra apenas status.

## 3. Itens revisados e considerados OK (sem mudança necessária)

- **Secrets** só no backend; CSP intocada.
- **Escrita = editor/admin** (RLS `pode_editar`) + UI em modo leitura para leitor
  (corrigido em fase anterior).
- **SENSITIVE nunca executa sem aprovação de admin** (gateway só propõe; RLS
  `ai_approvals.update = is_admin`).
- **Sem exclusões** (nenhuma tabela de IA tem GRANT de DELETE).
- **WhatsApp orchestrator** é read-only (RAG/memória/snapshot), single-tenant —
  scoping multi-tenant fica documentado como trabalho futuro (não é necessário
  hoje).
- **Automação agendada (pg_cron)**: opcional; a execução manual já funciona.
- **Injeção de prompt** por conteúdo externo (conhecimento/WhatsApp): mitigada
  pelo controle certo — ações sensíveis exigem **aprovação humana**.

## 4. Arquivos

**Modificados**
- `supabase/functions/ai-gateway/index.ts` — rate limit por `run`; `action:'health'`.
- `index.html` — submenu **Configurações** real (diagnóstico) + rota.

**Criados**
- `docs/ai/15-AJUSTES-OPERABILIDADE-RESULTADO.md`

**Deploy:** `ai-gateway` **v6 ACTIVE**. Sem migração/tabela nova.

## 5. Testes executados

- **Unitários (bun):** **56/56** (nada de lógica pura mudou).
- **UI (Chromium headless):** Configurações renderiza status do gateway, chave da
  IA, WhatsApp e a checklist; nos dois cenários (com/sem chave) **0 erros de JS**.
- **Build:** `ai-gateway` v6 ACTIVE (bundle Deno). Transpile OK.
- **Limite do ambiente:** o efeito real do rate limit e do health depende de HTTP
  a `supabase.co` (bloqueado no sandbox) — validado por leitura de código + build
  + UI.

## 6. O que é realmente necessário a seguir (recomendação de especialista)

1. **Dono:** configurar `ANTHROPIC_API_KEY` — é o único bloqueio para o Copiloto
   responder de fato. (A aba Configurações agora aponta isso.)
2. **Dono (opcional):** secrets do WhatsApp + `pg_cron` para automações
   autônomas; **leaked-password protection** no Auth.
3. Depois disso, um **smoke test end-to-end** real (o sandbox não permite).

O restante da camada (RAG, memória, automações manuais, aprovações, ações) já
está **completo, seguro e testado no que o ambiente permite**.

**PARADO.**
