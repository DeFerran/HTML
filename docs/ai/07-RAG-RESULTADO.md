# Fase RAG (Base de Conhecimento) — Resultado

**Data:** 2026-08-13
**Fase:** Base de Conhecimento / RAG (sem memória comportamental, sem WhatsApp,
sem automações).
**Regra-mãe:** a IA é uma CAMADA. O RAG é aditivo e isolado (tabelas
`ai_knowledge_*`, extensão `vector`, uma Edge Function e um painel atrás de
feature flag). Nada toca `painel_estado`, `bi_*`, `membros`, funções ou gatilhos.

---

## 1. Objetivo realizado

Base de Conhecimento com **fluxo completo**:
`upload → validação → extração → chunking → embedding → indexação → retrieval`,
integrada ao Copiloto por uma **tool READ** (`search_knowledge`) que informa
**quais documentos** foram usados. **Nada é indexado automaticamente** — só
documentos que o usuário adiciona e **aprova**.

Embeddings pelo modelo **nativo do Supabase Edge (`gte-small`, 384 dim)** — sem
chave externa, sem custo extra (decisão do usuário).

## 2. Decisões desta fase (aprovadas)

- **Nomes reais:** doc 02 §10 aprovou `ai_knowledge_docs` / `ai_knowledge_chunks`
  (o pedido citava `ai_documents`/`ai_document_chunks` — mapeamento 1:1).
- **Embeddings:** `gte-small` nativo (384 dim), keyless.
- **Entrada:** texto colado ou arquivo `.txt/.md` (lido no navegador → texto).
  Sem Storage/bucket; PDF/binário fica para uma fase futura.
- **UI + Copiloto:** backend RAG + **painel "Inteligência Artificial →
  Conhecimento"** (feature flag). A integração ao **chat** do Copiloto (drawer)
  fica para a Fase 06 — mas a **tool de recuperação já está no gateway**.

## 3. Arquitetura aprovada × implementada

| Item pedido | Implementado |
| ----------- | ------------ |
| `ai_documents` | `ai_knowledge_docs` (título, fonte, tipo, **status de processamento**, aprovado, conteúdo, **metadados** jsonb, n_chunks, erro, tenant/`empresa`, `user_id`). |
| `ai_document_chunks` | `ai_knowledge_chunks` (doc_id, idx, trecho, **metadados** jsonb, `user_id`/`empresa`). |
| embeddings/vector | coluna `embedding vector(384)` + índice **hnsw** (cosine) + extensão `vector`. |
| status de processamento | `status ∈ {pendente, processando, indexado, erro, desativado}`. |
| metadados | `metadados jsonb` no doc e em cada chunk (`{doc_id, titulo, fonte, idx}`). |
| tenant | `empresa='DF AGRO'` + escopo por `user_id` (single-tenant real). |
| permissões | RLS por usuário + `is_membro_ativo()`; recuperação só de docs **aprovados**. |

## 4. Fluxo (pipeline)

1. **upload** — no painel: título, fonte, tipo, conteúdo (colado ou `.txt/.md`),
   checkbox **Aprovar**. O front insere a linha em `ai_knowledge_docs` (RLS).
2. **validação** — `ai-knowledge` exige conteúdo e limita tamanho (200k chars).
3. **extração** — normalização do texto (`normalizeText`).
4. **chunking** — `chunkText` (parágrafos agrupados ~900 chars, com overlap;
   parágrafo grande é fatiado). Determinístico. Teto de 400 chunks/doc.
5. **embedding** — `gte-small` (384 dim) por chunk, no Edge.
6. **indexação** — insere em `ai_knowledge_chunks` (com metadados) e marca o doc
   `indexado` + `n_chunks`.
7. **retrieval** — `match_ai_knowledge(query_embedding, k)` (SECURITY INVOKER →
   RLS aplica; só docs **aprovados+indexados** do usuário), ordenado por
   distância cosine.

## 5. Interface (INTELIGÊNCIA ARTIFICIAL → Conhecimento)

Aba nova `🧠 IA · Conhecimento` (feature flag `localStorage 'df_ia_kb'`, visível
a membro ativo). Permite, conforme pedido:

- **adicionar documento** (texto/`.txt`/`.md`, com aprovação);
- **visualizar status** (badges pendente/processando/indexado/erro/desativado + nº de trechos);
- **pesquisar** (busca semântica, mostrando as **fontes**);
- **desativar** (remove da IA: `aprovado=false`, `status='desativado'`);
- **reprocessar** (re-indexa: limpa chunks e refaz embeddings);
- (+ **aprovar/desaprovar** por documento).

`index.html` só ganhou: 1 botão de aba, 1 `<section>` e 1 bloco de funções — tudo
aditivo, atrás de flag. **Nenhuma página/dado existente foi alterado.** A CSP já
permitia `supabase.co` (funções incluídas) — **não foi tocada**.

## 6. Integração ao Copiloto

- Nova tool READ **`search_knowledge`** no `ai-gateway` (nível READ, logada em
  `ai_audit_log` como `tool_call`).
- O gateway injeta `retrieve` (embed + `match_ai_knowledge` sob RLS) no contexto
  das tools e **acumula as fontes**; a resposta 200 traz `fontes[]` (documentos
  usados). O system prompt manda **citar as fontes** e **não inventar** quando
  não houver documento.

## 7. Arquivos

**Criados**
- `supabase/functions/ai-knowledge/{index.ts, chunking.ts, chunking.test.ts, deno.json, README.md}`
- `supabase/functions/ai-gateway/tools/read_tools.test.ts` (novos testes de RAG — atualizado)
- `supabase/migrations/20260813_ai_knowledge_base.sql`
- `docs/ai/07-RAG-RESULTADO.md`

**Modificados**
- `supabase/functions/ai-gateway/tools/types.ts` (+`KnowledgeHit`, `retrieve`)
- `supabase/functions/ai-gateway/tools/read_tools.ts` (+`search_knowledge`)
- `supabase/functions/ai-gateway/index.ts` (embed + `retrieve` + `fontes`)
- `supabase/functions/ai-gateway/README.md`
- `index.html` (aba + seção + funções da Base de Conhecimento — aditivo)

## 8. Tabelas / migrations

- Migração **`ai_knowledge_base`** (aplicada): extensão `vector`, tabelas
  `ai_knowledge_docs` e `ai_knowledge_chunks` (RLS, grants, índices, hnsw),
  função `match_ai_knowledge`.
- Migração **`ai_knowledge_fn_search_path`** (aplicada): fixa `search_path` da
  função (advisor). Registro no repo: `supabase/migrations/20260813_ai_knowledge_base.sql`.
- Previstas e aprovadas no doc 02 §10. Aditivas/reversíveis.

## 9. Testes executados

### Unitários (bun) — **23 passaram, 0 falharam**

- **`chunking.test.ts`** (6): vazio→sem chunks; normalização; índices
  sequenciais; agrupamento; fatiamento com overlap; **determinismo**.
- **`read_tools.test.ts`** (17, +4 de RAG): `search_knowledge` retorna trechos e
  **fontes únicas**; **não toca o banco** (o escopo/RLS vem do `retrieve`
  injetado — isolamento por construção); sem resultados → `encontrado=false` (não
  inventa); sem `retrieve` → `disponivel=false`; consulta vazia → `encontrado=false`.
  (Mantidos os testes de cross-tenant e dados inexistentes das READ tools.)

### Estrutura de banco (execute_sql)

- `vector 0.8.2`, 2 tabelas, **7 policies**, função `match_ai_knowledge`
  presente, índice **hnsw** presente.

### Advisors de segurança (get_advisors)

- Corrigido o único alerta novo (`function_search_path_mutable`) fixando o
  `search_path`. Restantes são **pré-existentes** (SECURITY DEFINER do RBAC;
  leaked-password — pendência do dono).

### Build

- Deploy **`ai-knowledge` v1 ACTIVE** e **`ai-gateway` v3 ACTIVE**
  (`verify_jwt=true`) — bundles Deno compilados server-side = build validado.
- Parse/transpile de todos os `.ts` do edge (Bun.Transpiler): OK.
- Sintaxe do JS do `index.html` (inline scripts): OK.

### Limite do ambiente (não é defeito)

- Smoke test HTTP end-to-end das funções segue bloqueado (o proxy do sandbox
  nega CONNECT a `*.supabase.co`). A verificação foi por estrutura + RLS + testes
  unitários + build. Recomenda-se um teste manual pelo dono após configurar o
  secret do gateway.

## 10. Riscos

| Risco | Nível | Observação |
| ----- | ----- | ---------- |
| Indexar algo não aprovado | BAIXO | Recuperação exige `aprovado=true`; nada é indexado sem ação do usuário. |
| Vazamento cross-tenant | BAIXO | RLS nas `ai_knowledge_*`; `match_ai_knowledge` é SECURITY INVOKER (RLS aplica) com `search_path` fixo. |
| Qualidade do embedding | MÉDIO-BAIXO | `gte-small` é modesto; trocável por provedor melhor depois sem mudar o resto. |
| Custo | BAIXO | Embeddings locais (sem custo). Chat mantém `max_tokens`/rate limit. |
| UI nova no `index.html` | BAIXO | Aditiva, atrás de flag; rollback = desligar a flag. |

## 11. Rollback

1. **Front:** `localStorage.setItem('df_ia_kb','0')` (ou `desativarPainelIA()`) —
   some a aba, sem tocar nas demais.
2. **Gateway:** reverter para v2 (sem `search_knowledge`) ou redeployar.
3. **Função:** remover/desabilitar `ai-knowledge`.
4. **Banco:** `DROP FUNCTION match_ai_knowledge; DROP TABLE ai_knowledge_chunks,
   ai_knowledge_docs CASCADE;` (extensão `vector` pode ficar).
Nenhum passo afeta `painel_estado`, `bi_*`, `membros`, funções ou gatilhos.

## 12. Pendências

- Configurar o secret `ANTHROPIC_API_KEY` do `ai-gateway` (passo do dono) para o
  chat citar as fontes de ponta a ponta. A **ingestão e a busca** da Base já
  funcionam sem esse secret (usam só o `gte-small` nativo).
- Smoke test manual end-to-end pelo dono.

## 13. Próxima fase sugerida

- **Fase 06 — Copiloto (UI de chat):** botão global + drawer + histórico +
  contexto da página, ligando o chat do `ai-gateway` (que já tem tools READ +
  `search_knowledge`) à interface. A Base de Conhecimento já está pronta para ser
  citada nas respostas.
- Memória comportamental (`ai_memory`), automações e WhatsApp seguem **fora de
  escopo** até ordem explícita.

**Não iniciar sem ordem explícita do usuário.**

---

_PARADO conforme a regra de implementação incremental._
