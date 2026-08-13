# Fase FOUNDATION — Resultado

**Data:** 2026-08-13
**Fase:** Fundação da camada de IA (primeira fase de implementação)
**Regra-mãe:** a IA é uma CAMADA sobre a plataforma existente. Nada aqui
substitui, duplica ou toca a fonte da verdade (`painel_estado`), os espelhos
`bi_*`, `membros`, funções RBAC ou gatilhos. Ver `CLAUDE.md` e
`docs/ai/02-ARQUITETURA-IA-ALVO.md`.

---

## 1. Objetivo realizado

Criar a **infraestrutura mínima** para conversar com um modelo Anthropic Claude,
**sem nenhuma ferramenta** e **sem qualquer capacidade de alterar dados de
negócio**. A IA nesta fase apenas:

- recebe uma mensagem autenticada de um membro ativo;
- conversa com o modelo (uma passada, sem tools);
- persiste conversa, mensagens e auditoria **somente** nas tabelas `ai_*`;
- devolve a resposta.

Não há WRITE tools, automações, WhatsApp nem RAG. A chave da Anthropic vive
somente no backend.

---

## 2. Arquivos criados

| Arquivo | Papel |
| ------- | ----- |
| `supabase/functions/ai-gateway/provider.ts` | Abstração de provedor de LLM (`AIProvider`, `ChatMessage`, `ProviderRequest`, `ProviderResult`, `ProviderError`). Mantém o gateway independente de fornecedor. |
| `supabase/functions/ai-gateway/anthropic.ts` | Provedor Anthropic (Messages API por `fetch` cru, sem SDK). Lê a chave só do ambiente; trata timeout, rede, 429, 401/403 e recusa. |
| `supabase/functions/ai-gateway/index.ts` | AI Gateway: único ponto de entrada. Auth → tenant/RBAC → rate limit → conversa/mensagens → provider → auditoria. |
| `supabase/functions/ai-gateway/deno.json` | Configuração do runtime (strict). |
| `supabase/functions/ai-gateway/README.md` | Documentação da função, mapeamento de requisitos, secrets, contrato e rollback. |
| `supabase/migrations/20260813_ai_foundation_tables.sql` | Registro em repositório da migração aplicada (3 tabelas `ai_*`). |
| `docs/ai/04-FASE-FOUNDATION-RESULTADO.md` | Este relatório. |

## 3. Arquivos modificados

Nenhum. Nenhum arquivo existente da plataforma foi tocado (`index.html`, `sw.js`,
`manifest.webmanifest`, etc.). A fundação é totalmente aditiva e isolada.

---

## 4. Tabelas criadas

Exatamente as **3** tabelas previstas e aprovadas em
`docs/ai/02-ARQUITETURA-IA-ALVO.md` (nenhuma a mais):

| Tabela | Finalidade | RLS |
| ------ | ---------- | --- |
| `ai_conversations` | Uma conversa por (user_id, empresa). | `select/insert/update`: dono **e** `is_membro_ativo()`; `delete`: só o dono. |
| `ai_messages` | Mensagens (`user`/`assistant`/`tool`/`system`) de uma conversa. Append-only. | `select/insert`: dono **e** `is_membro_ativo()`. Sem update/delete. |
| `ai_audit_log` | "Agent runs" (`tipo='run'`), "tool call logging" (`tipo='tool_call'`) e erros. Append-only. | `insert`: dono **e** `is_membro_ativo()`; `select`: dono **ou** `is_admin()`. |

Características de segurança comuns:

- escopo real por `(user_id, empresa='DF AGRO')` — o mesmo tenant único
  encontrado na auditoria (`docs/ai/01-AUDITORIA-ATUAL.md`);
- `user_id` com `default auth.uid()` e FK para `auth.users(id) on delete cascade`;
- RLS **habilitada** em todas; policies usam `(select auth.uid())` (padrão
  otimizado, sem re-avaliação por linha);
- reaproveitam o RBAC existente (`is_membro_ativo()`, `is_admin()`) — não criam
  um segundo modelo de permissão;
- CHECK constraints em `papel`, `tipo` e `nivel`;
- índices por `(user_id, ...)` e por `tool`.

## 5. Migrations criadas

- **Aplicada em produção** via `apply_migration` (nome: `ai_foundation_tables`).
- **Registrada no repositório** em
  `supabase/migrations/20260813_ai_foundation_tables.sql` (mesmo DDL).
- Natureza: **aditiva, reversível, retrocompatível**. Só `CREATE TABLE`,
  `CREATE INDEX`, `CREATE POLICY`, `GRANT`, `ALTER TABLE ... ENABLE RLS`.
  Nenhum `DROP`, `TRUNCATE`, `DELETE`, `ALTER` de tabela existente.

## 6. Endpoints criados

- **Edge Function `ai-gateway`** — `POST /functions/v1/ai-gateway`
  (deploy `ACTIVE`, `verify_jwt=true`).
  - Requer `Authorization: Bearer <jwt>`.
  - Corpo: `{ "message": "texto", "conversation_id": "uuid opcional" }`.
  - Resposta `200`: `{ conversation_id, reply, usage }`.
  - Erros estruturados: `401` sem/JWT inválido, `403` não-membro, `429` rate
    limit, `400` corpo inválido/mensagem vazia/muito longa, `422` recusa,
    `503` não configurado, `504` timeout, `502` provedor.

## 7. Tools criadas

**Nenhuma.** Requisito 8 (nenhuma WRITE tool) e o escopo desta fase. O gateway
faz uma única passada de conclusão, sem `tools` na chamada ao modelo. As tools
READ virão na próxima fase, conforme `docs/ai/03-MAPA-DE-TOOLS.md`.

---

## 8. Requisitos × implementação

| # | Requisito | Onde |
| - | --------- | ---- |
| 1 | API key só no backend | `Deno.env.get("ANTHROPIC_API_KEY")` em `anthropic.ts`/`index.ts`. Nunca no frontend. |
| 2 | Autenticação obrigatória | `verify_jwt=true` (plataforma) **+** `auth.getUser()` (401 se ausente/expirada). |
| 3 | Tenant obrigatório | `empresa='DF AGRO'` em toda escrita; escopo por `user_id`; exige `is_membro_ativo()` (403 se não). |
| 4 | Logs | `ai_audit_log`: um registro por run (ok/erro, modelo, latência, tokens). |
| 5 | Timeout | `AbortSignal.timeout(60_000)` na chamada ao provedor → `504`. |
| 6 | Tratamento de erro | `ProviderError` + JSON `{error:{code,message}}` com status HTTP correto; erro também é logado. |
| 7 | Rate limiting | 30 req/min por usuário, contando em `ai_audit_log` nos últimos 60s (429). Usa infra já criada nesta fase. |
| 8 | Nenhuma WRITE tool | Nenhuma tool. Gateway não altera `painel_estado`/`bi_*`/`membros`. |
| 9 | Nenhuma automação | Sem cron, sem gatilho, sem fila. Só request/response síncrono. |
| 10 | Nenhum WhatsApp | Não implementado. |
| 11 | Nenhum RAG | Sem embeddings, sem busca vetorial, sem base de conhecimento. |

---

## 9. Testes executados

| Verificação | Método | Resultado |
| ----------- | ------ | --------- |
| Migração aplicada | `information_schema.tables` (`ai_%`) | **OK** — `ai_conversations`, `ai_messages`, `ai_audit_log` presentes. |
| RLS habilitada | `pg_class.relrowsecurity` | **OK** — habilitada nas 3 tabelas. |
| Policies corretas | `pg_policies` | **OK** — dono + `is_membro_ativo()`; audit `select` inclui `is_admin()`; `delete` de conversa só do dono. |
| CHECK/FK/índices/defaults | `information_schema` / `pg_constraint` | **OK** — `papel`, `tipo`, `nivel`, FKs `on delete cascade`/`set null`, índices e `default auth.uid()` presentes. |
| Grants | `has_table_privilege('authenticated', ...)` | **OK** — `select/insert` (+`update/delete` só em conversations) para `authenticated`; RLS ainda filtra por linha. |
| Isolamento entre organizações | RLS por `user_id` + `is_membro_ativo()` | **OK por construção** — nenhuma policy expõe linha de outro usuário; `select` de audit adiciona apenas `is_admin()`. |
| Build da função | `deploy_edge_function` (bundle/compila no Supabase) | **OK** — deploy `ACTIVE`, versão 1, `verify_jwt=true`. |
| Advisors de segurança | `get_advisors` | **OK** — as tabelas `ai_*` não introduziram nenhum alerta novo. |

### Testes bloqueados pelo ambiente (não são defeitos de código)

| Teste | Motivo | Mitigação |
| ----- | ------ | --------- |
| Smoke test HTTP real da função | O proxy de saída do sandbox **nega CONNECT** para `*.supabase.co` (403 de política). | Build validado pelo deploy; auth garantida por `verify_jwt=true`; contrato revisado por leitura. Recomenda-se um smoke test manual pelo dono após configurar o secret (§11). |
| Simulação de RLS via SQL com role `authenticated` | `execute_sql` é **read-only** (não faz INSERT) e não pode `set role authenticated` nem executar função `SECURITY DEFINER` do RBAC. | Policies verificadas estruturalmente (definição exata) + grants confirmados; a lógica de isolamento é a mesma já em produção nas tabelas do painel. |

---

## 10. Erros encontrados

- Durante a validação: limitações do **sandbox** (egress para `supabase.co`
  negado pelo proxy; `execute_sql` read-only). Contornadas com validação
  estrutural + build por deploy. Nenhum erro de código.
- Nenhum erro de lint/compilação: o deploy do Supabase compila o bundle Deno
  server-side e retornou `ACTIVE`.

---

## 11. Pendência de configuração (só o dono faz — 1 vez)

A função **só responde** depois que o secret for configurado. Pelo painel
(**Edge Functions → ai-gateway → Secrets**) ou CLI:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # obrigatório
supabase secrets set AI_MODEL=claude-sonnet-5       # opcional (padrão)
```

`SUPABASE_URL` e `SUPABASE_ANON_KEY` são injetados automaticamente. **Nunca**
colocar a chave no frontend.

---

## 12. Riscos

| Risco | Nível | Observação |
| ----- | ----- | ---------- |
| Custo de tokens | BAIXO | `max_tokens=1024`, histórico limitado a 20 mensagens, rate limit 30/min por usuário. |
| Vazamento de chave | BAIXO | Chave só no backend; nunca versionada; nunca no front. |
| Alteração indevida de dados | NENHUM nesta fase | Sem tools, sem WRITE; gateway não toca `painel_estado`/`bi_*`/`membros`. |
| Acesso indevido | BAIXO | `verify_jwt` + `is_membro_ativo()` + RLS por `user_id`. |
| Alucinação de números | MITIGADO | System prompt proíbe inventar dados e manda dizer quando não tem acesso; tools reais virão na próxima fase. |

---

## 13. Rollback

Totalmente reversível, sem impacto no app/BI:

1. Desabilitar/remover a função `ai-gateway` no painel do Supabase.
2. (Opcional) remover as tabelas:
   `DROP TABLE public.ai_audit_log, public.ai_messages, public.ai_conversations CASCADE;`
3. (Opcional) remover o secret `ANTHROPIC_API_KEY`.

Nada disso afeta `painel_estado`, `bi_*`, `membros`, funções, gatilhos ou o
frontend.

---

## 14. Próxima fase sugerida

**Fase READ TOOLS** — implementar as ferramentas somente-leitura sobre os
espelhos `bi_*` descritas em `docs/ai/03-MAPA-DE-TOOLS.md` (ex.: área,
produtividade, custos, clientes, safras), ligando o loop de tool-use no gateway
com `nivel='READ'` e registro em `ai_audit_log` (`tipo='tool_call'`). Continua
**sem** WRITE, automação, WhatsApp ou RAG.

**Não iniciar sem ordem explícita do usuário.**

---

_PARADO conforme a regra de implementação incremental._
