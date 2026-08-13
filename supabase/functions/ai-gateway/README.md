# ai-gateway (Edge Function) — Fase FOUNDATION

Único ponto de entrada da camada de IA. Conversa com um modelo Anthropic
Claude, **sem ferramentas** e **sem escrever em dados de negócio**. Grava apenas
nas tabelas `ai_*` (conversas, mensagens, auditoria).

## Requisitos atendidos

| # | Requisito | Como |
| - | --------- | ---- |
| 1 | API key só no backend | `Deno.env.get("ANTHROPIC_API_KEY")` — nunca no front |
| 2 | Autenticação obrigatória | `verify_jwt=true` no deploy + `auth.getUser()` |
| 3 | Tenant obrigatório | `empresa = 'DF AGRO'` em toda escrita; escopo por `user_id` |
| 4 | Logs | `ai_audit_log` (run + erros) |
| 5 | Timeout | `AbortSignal.timeout(60s)` na chamada ao provedor |
| 6 | Tratamento de erro | `ProviderError` + JSON estruturado `{error:{code,message}}` |
| 7 | Rate limiting | 30 req/min por usuário (contagem em `ai_audit_log`) |
| 8–11 | Sem WRITE tools / automação / WhatsApp / RAG | não implementados nesta fase |

## Configuração segura de secrets (só o dono faz — 1 vez)

A função **não funciona** até o secret ser configurado. Pelo painel do Supabase
(**Edge Functions → ai-gateway → Secrets**) ou pela CLI:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # obrigatório
supabase secrets set AI_MODEL=claude-sonnet-5       # opcional (padrão)
```

`SUPABASE_URL` e `SUPABASE_ANON_KEY` são injetados automaticamente pelo Supabase.

## Contrato

`POST /functions/v1/ai-gateway` — cabeçalho `Authorization: Bearer <jwt do usuário>`.

Corpo:
```json
{ "message": "texto", "conversation_id": "uuid opcional" }
```

Resposta `200`:
```json
{ "conversation_id": "uuid", "reply": "...", "usage": { "input": 0, "output": 0 } }
```

Erros: `{ "error": { "code": "...", "message": "..." } }` com status HTTP
apropriado (`401` sem token, `403` não-membro, `429` rate limit, `422` recusa,
`503` não configurado, `504` timeout, `502` provedor).

## Arquivos

- `index.ts` — gateway (auth, tenant, rate limit, timeout, logs, erros).
- `provider.ts` — abstração de provedor de LLM (`AIProvider`).
- `anthropic.ts` — provedor Anthropic (Messages API via fetch).
- `deno.json` — config do runtime.

## Rollback

Desabilitar/remover a função no painel do Supabase; e/ou
`DROP TABLE ai_audit_log, ai_messages, ai_conversations CASCADE;`. O app e o BI
continuam funcionando sem qualquer alteração.
