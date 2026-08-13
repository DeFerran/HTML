# ai-gateway (Edge Function) — FOUNDATION + READ TOOLS

Único ponto de entrada da camada de IA. Conversa com um modelo Anthropic
Claude e, quando útil, chama **ferramentas SOMENTE-LEITURA** sobre os espelhos
`bi_*`. **Nunca escreve em dados de negócio** — grava apenas nas tabelas `ai_*`
(conversas, mensagens, auditoria/tool_calls).

## READ TOOLS (fase atual)

`index.ts` roda um loop de tool-use limitado (`MAX_TOOL_ITERS`), sempre nível
`READ`. As tools estão em `tools/read_tools.ts`; cada `tool_call` é registrado em
`ai_audit_log` (`tipo='tool_call'`).

| Tool | Fonte real | Observação |
| ---- | ---------- | ---------- |
| `get_client` | `bi_clientes` + `bi_visitas` + `bi_cross_sell` | busca por nome (ILIKE). |
| `get_season` | `bi_safras` + `bi_servicos` | safra = rótulo global (24/25…27/28). |
| `get_costs` | `bi_custos_mensais` + `bi_custo_categoria` + `bi_proj_gastos` | real vs projetado. |
| `get_collection_status` | `bi_operacao_situacao` + `bi_operacao_etapas` | só nível AGREGADO. |
| `search_knowledge` | `ai_knowledge_*` (RAG) | busca semântica; retorna as **fontes** usadas (resposta traz `fontes[]`). |
| `recall_memory` | `ai_memory` | READ — só memória **VALIDATED** do usuário. |
| `propose_memory` | `ai_memory` | **SAFE_WRITE** (editor/admin) — PROPÕE memória (`PENDING_REVIEW`); nunca oficializa. Agronômico exige validação. |
| `get_farm` | — | **stub**: `disponivel=false` (não há tabela). |
| `get_field` | — | **stub**: `disponivel=false` (não há tabela). |
| `get_soil_analysis` | — | **stub**: `disponivel=false` (não há tabela). |

**Segurança das tools:** o modelo só escolhe *nome + args do schema*; nunca envia
SQL. Toda consulta é parametrizada fixa sob o JWT do usuário (a RLS é a barreira
de tenant). Tools sem dado retornam `disponivel=false` — nunca inventam valores.

**Níveis:** tools `READ` liberadas a membro ativo; tools `SAFE_WRITE`
(`propose_memory`) só executam para **editor/admin** (gate por `meu_papel()`) e
nunca oficializam nada — gravam `PENDING_REVIEW`. O `ai_audit_log` registra o
nível real de cada `tool_call`.

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

- `index.ts` — gateway (auth, tenant, rate limit, timeout, logs, erros, loop de tools).
- `provider.ts` — abstração de provedor de LLM (`AIProvider`, blocos de tool-use).
- `anthropic.ts` — provedor Anthropic (Messages API via fetch, com tools).
- `tools/types.ts` — contrato das READ tools (sem runtime; testável fora do Deno).
- `tools/read_tools.ts` — as 7 READ tools + `runReadTool`/`toolSpecs`.
- `tools/read_tools.test.ts` — testes (bun): cross-tenant + dados inexistentes.
- `deno.json` — config do runtime.

## Rollback

Desabilitar/remover a função no painel do Supabase; e/ou
`DROP TABLE ai_audit_log, ai_messages, ai_conversations CASCADE;`. O app e o BI
continuam funcionando sem qualquer alteração.
