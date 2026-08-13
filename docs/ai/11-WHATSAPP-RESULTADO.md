# Fase 12 — Integração inicial WhatsApp (Cloud API) — Resultado

> Arquivo `docs/ai/11-WHATSAPP-RESULTADO.md` conforme solicitado (o número 11 já
> fora usado pelo relatório de ajustes `11-AJUSTES-RESULTADO.md`; aqui é a fase
> seguinte).

**Data:** 2026-08-13
**Fase:** integração inicial com **WhatsApp Cloud API** (API oficial). Aditiva e
isolada. **Somente leitura** (consultas/respostas/resumos); **sem ações
sensíveis**.
**Regra-mãe:** a IA é uma CAMADA. Nada toca `painel_estado`, `bi_*`, `membros`,
funções ou gatilhos existentes. **Tokens só no backend.**

---

## 1. Objetivo realizado

Pipeline completo de entrada:
**receber → validar webhook → identificar contato → registrar → orchestrator
(ferramentas autorizadas, só leitura) → gerar resposta → responder**, com
**deduplicação**, **logs** e **retry seguro**. Backend seguro para **webhook** e
**send_message**. Tela **Inteligência Artificial → WhatsApp** (admin).

## 2. Segurança do webhook (ponto crítico)

O webhook precisa ser **público** (o WhatsApp não envia JWT). A função
`ai-whatsapp` roda `verify_jwt=false` e se protege sozinha:

- **GET (handshake):** `hub.verify_token` == `WHATSAPP_VERIFY_TOKEN` →
  devolve `hub.challenge` (senão 403).
- **POST (inbound):** valida a **assinatura HMAC-SHA256** (`X-Hub-Signature-256`)
  com `WHATSAPP_APP_SECRET` sobre o corpo cru — assinatura inválida ⇒ **401** +
  log. (Comparação em tempo constante.)
- **POST (admin: `send_message`/`status`):** valida o **JWT do usuário** e exige
  **`is_admin()`**.

Escrita no banco pelo **service role** (backend). Os segredos WhatsApp e o
service role **nunca** vão para o front (CSP intocada).

## 3. Tabelas criadas (migração aditiva aplicada)

| Tabela | Papel |
| ------ | ----- |
| `whatsapp_config` | número + `phone_number_id` + `ativo` + último evento (sem segredos). Escrita = **admin**. |
| `whatsapp_contacts` | contatos (`wa_id`), `unique(user_id, wa_id)`. |
| `whatsapp_conversations` | conversas por contato. |
| `whatsapp_messages` | mensagens in/out; **`unique(wa_message_id)`** = dedupe; status recebida/enviada/erro. |
| `whatsapp_logs` | logs e erros (webhook/orchestrator/send). |

RLS: leitura por `user_id` + `is_membro_ativo()`. **Sem GRANT de DELETE** (sem
exclusões). Escrita das tabelas de tráfego é só do service role (webhook);
`whatsapp_config` é editável por admin pela UI.

## 4. Backend (`ai-whatsapp`, deploy v1 ACTIVE, `verify_jwt=false`)

- **webhook** (GET verify + POST inbound com HMAC).
- **send_message** (admin) e **status** (admin).
- **Orchestrator READ-only:** usa ferramentas **autorizadas** — recuperação de
  **Conhecimento** (`match_ai_knowledge`), **memória validada**
  (`match_ai_memory`) e um **snapshot** (clientes, receita/custo da safra) — e
  então o modelo responde **curto e objetivo**, proibido de inventar números ou
  executar ações sensíveis. Sem `ANTHROPIC_API_KEY`, responde um aviso seguro.
- **Retry seguro** no envio (até 3× com backoff; 4xx≠429 não repete).
- **Dedupe** por `wa_message_id` (upsert ignoreDuplicates) — reenvio do webhook
  não duplica.

> **Escopo/limite (single-tenant):** o webhook resolve o **dono** pela
> `whatsapp_config` ativa e usa service role; as buscas (RAG/memória) hoje
> abrangem o tenant único (`DF AGRO`). Scoping multi-tenant fino é trabalho
> futuro, coerente com a auditoria (doc 01).

## 5. Tela (INTELIGÊNCIA ARTIFICIAL → WhatsApp) — admin

Na Central de IA (admin). Mostra: **status da conexão**, **número**,
**conversas**, **mensagens** (direção/texto/status), **logs & erros**. Permite:
salvar a conexão (`whatsapp_config`), ver o **URL do webhook** a configurar na
Meta, e **enviar mensagem de teste** (admin → `send_message`). Deixa claro que os
segredos ficam **só no backend**.

## 6. Ferramentas permitidas nesta fase

Apenas **consultas / respostas / resumos** (RAG + memória validada + snapshot).
**Nada de ações sensíveis** (sem escrita de dados, sem finanças, sem SAFE_WRITE,
sem automações) via WhatsApp.

## 7. Arquivos

**Criados**
- `supabase/functions/ai-whatsapp/{index.ts, wa_logic.ts, wa_logic.test.ts, deno.json, README.md}`
- `supabase/migrations/20260813_ai_whatsapp.sql`
- `docs/ai/11-WHATSAPP-RESULTADO.md`

**Modificados**
- `index.html` — painel **WhatsApp** real na Central (antes "Em implantação") + rota.

## 8. Testes executados

### Unitários (bun) — **46/46** (5 arquivos, +5 de WhatsApp)

`wa_logic.test.ts`: parsing do payload (id/remetente/nome/texto; payloads de
status → vazio), `verifyChallenge` (só com token correto), **`verifySignature`
HMAC** (aceita a correta; rejeita errada/ausente/corpo adulterado/sem segredo),
`clampText`.

### UI (Chromium headless) — **PASSOU**

Admin: `iahubGo('whatsapp')` renderiza status/conexão, formulário, **URL do
webhook**, envio de teste e tabelas (conversas/logs/mensagens). **0 erros de JS.**

### Estrutura / build / advisors

- 5 tabelas, RLS/policies, **DELETE grants = 0**, `unique(wa_message_id)` — OK.
- `get_advisors`: **nenhum alerta novo**.
- Deploy `ai-whatsapp` **v1 ACTIVE, verify_jwt=false** = bundle Deno compilado.
- Sintaxe do `index.html`: OK.

### Limite do ambiente (não é defeito)

- Chamada real ao webhook / ao Graph API está bloqueada no sandbox (proxy nega
  `*.supabase.co` e `graph.facebook.com`; `execute_sql` read-only). A verificação
  foi por **estrutura + testes unitários (incl. HMAC real) + build**. O teste de
  ponta-a-ponta é do dono, após configurar os secrets e o webhook na Meta.

## 9. Configuração do dono (uma vez)

1. Secrets no backend: `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`,
   `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` (ou preencher na tela),
   e `ANTHROPIC_API_KEY`.
2. No app da Meta, apontar o webhook para
   `…/functions/v1/ai-whatsapp` usando o mesmo `WHATSAPP_VERIFY_TOKEN`.
3. Na tela WhatsApp, salvar o número + marcar **Conexão ativa**.

## 10. Riscos

| Risco | Nível | Observação |
| ----- | ----- | ---------- |
| Webhook aberto | BAIXO | HMAC obrigatório; sem assinatura válida ⇒ 401. |
| Vazamento de token | BAIXO | Tokens/service role só no backend. |
| Ação sensível via WhatsApp | NENHUM nesta fase | Orchestrator é read-only; nenhuma tool de escrita exposta. |
| Duplicação | BAIXO | `unique(wa_message_id)`. |
| Resposta inventada | BAIXO | System prompt proíbe inventar; usa só o contexto autorizado. |

## 11. Rollback

- **Front:** reverter o commit (ou `df_ia_kb='0'`).
- **Backend:** desabilitar/remover `ai-whatsapp`.
- **Banco:** `DROP TABLE whatsapp_* CASCADE;`.
Nada afeta `painel_estado`, `bi_*`, `membros`, funções ou gatilhos.

## 12. Próxima fase sugerida

- **Aprovações (Approval Engine)** antes de qualquer ação sensível por qualquer
  canal (inclusive WhatsApp).
- Orchestrator do WhatsApp com o **tool-loop completo** (reuso das READ tools do
  gateway) e mapeamento **multi-tenant** de telefone → usuário.

**Não iniciar sem ordem explícita do usuário.**

---

_PARADO conforme a regra de implementação incremental._
