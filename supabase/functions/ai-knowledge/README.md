# ai-knowledge (Edge Function) — Fase RAG

Ingestão e busca da **Base de Conhecimento** do Copiloto. Embeddings pelo modelo
**nativo do Supabase Edge** (`gte-small`, 384 dim) — **sem chave externa, sem
custo extra**. Só grava/lê nas tabelas `ai_knowledge_*` (RLS por usuário).

## Segurança

- `verify_jwt=true` + `auth.getUser()` + `is_membro_ativo()` (mesmo RBAC do painel).
- Todas as operações usam o **JWT do usuário** → a **RLS** é a barreira de tenant.
- **Não indexa nada automaticamente:** processa apenas o `doc_id` que o usuário
  enviou. A busca (`match_ai_knowledge`) só devolve documentos **aprovados** e
  **indexados** do próprio usuário.

## Ações (`POST`, corpo JSON, `Authorization: Bearer <jwt>`)

| action | corpo | efeito |
| ------ | ----- | ------ |
| `process` | `{ doc_id }` | valida → extrai/normaliza texto → chunking → embedding (gte-small) → grava `ai_knowledge_chunks` → marca doc `indexado`. Reprocessa (limpa chunks antigos). |
| `search` | `{ consulta, limite? }` | embed da consulta → `match_ai_knowledge` (RLS) → `{ resultados[], fontes[] }`. |

Cada chunk guarda `metadados = { doc_id, titulo, fonte, idx }` — suficiente para
identificar a fonte de cada trecho.

## Pipeline

`upload (texto/.md/.txt no front) → validação → extração/normalização → chunking
→ embedding (gte-small) → indexação (pgvector/hnsw) → retrieval (match_ai_knowledge)`.

## Integração com o Copiloto

O `ai-gateway` tem a tool READ `search_knowledge`, que usa a mesma recuperação e
retorna as **fontes** citáveis; a resposta do gateway inclui `fontes[]` (quais
documentos foram usados).

## Arquivos

- `index.ts` — função (auth, RBAC, process/search, embeddings nativas).
- `chunking.ts` — chunking puro (testável fora do Deno).
- `chunking.test.ts` — testes (bun).
- `deno.json` — config do runtime.

## Rollback

Remover/desabilitar a função no painel; e/ou dropar as tabelas
`ai_knowledge_*` (ver `supabase/migrations/20260813_ai_knowledge_base.sql`). O
app e o BI continuam funcionando sem alteração.
