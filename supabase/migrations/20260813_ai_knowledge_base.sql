-- Fase RAG (Base de Conhecimento) — migração aditiva e isolada.
-- Registro em repositório das migrações aplicadas em produção via Supabase:
--   1) ai_knowledge_base           (tabelas + extensão vector + função de match)
--   2) ai_knowledge_fn_search_path (pin do search_path da função — advisor)
--
-- Cria SOMENTE o previsto no docs/ai/02-ARQUITETURA-IA-ALVO.md §10:
-- ai_knowledge_docs + ai_knowledge_chunks (pgvector, gte-small = 384 dim) e a
-- função de recuperação semântica. NADA aqui toca painel_estado, bi_*, membros,
-- funções ou gatilhos existentes.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.match_ai_knowledge(extensions.vector(384), int);
--   DROP TABLE IF EXISTS public.ai_knowledge_chunks, public.ai_knowledge_docs CASCADE;
--   -- (a extensão vector pode permanecer; é inofensiva)

create extension if not exists vector with schema extensions;

-- ============ ai_knowledge_docs ============
create table if not exists public.ai_knowledge_docs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa       text not null default 'DF AGRO',
  titulo        text not null,
  fonte         text,
  tipo          text not null default 'texto' check (tipo in ('texto','markdown')),
  status        text not null default 'pendente' check (status in ('pendente','processando','indexado','erro','desativado')),
  aprovado      boolean not null default false,
  conteudo      text,
  metadados     jsonb not null default '{}'::jsonb,
  n_chunks      integer not null default 0,
  erro          text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists ai_kdocs_user_idx
  on public.ai_knowledge_docs (user_id, atualizado_em desc);
alter table public.ai_knowledge_docs enable row level security;
grant select, insert, update, delete on public.ai_knowledge_docs to authenticated;

create policy ai_kdocs_select on public.ai_knowledge_docs
  for select to authenticated
  using (((select auth.uid()) = user_id) and is_membro_ativo());
create policy ai_kdocs_insert on public.ai_knowledge_docs
  for insert to authenticated
  with check (((select auth.uid()) = user_id) and is_membro_ativo());
create policy ai_kdocs_update on public.ai_knowledge_docs
  for update to authenticated
  using (((select auth.uid()) = user_id) and is_membro_ativo())
  with check (((select auth.uid()) = user_id) and is_membro_ativo());
create policy ai_kdocs_delete on public.ai_knowledge_docs
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ============ ai_knowledge_chunks ============
create table if not exists public.ai_knowledge_chunks (
  id         uuid primary key default gen_random_uuid(),
  doc_id     uuid not null references public.ai_knowledge_docs(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa    text not null default 'DF AGRO',
  idx        integer not null,
  trecho     text not null,
  metadados  jsonb not null default '{}'::jsonb,
  embedding  extensions.vector(384),
  criado_em  timestamptz not null default now()
);
create index if not exists ai_kchunks_doc_idx
  on public.ai_knowledge_chunks (doc_id, idx);
create index if not exists ai_kchunks_emb_idx
  on public.ai_knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);
alter table public.ai_knowledge_chunks enable row level security;
grant select, insert, delete on public.ai_knowledge_chunks to authenticated;

create policy ai_kchunks_select on public.ai_knowledge_chunks
  for select to authenticated
  using (((select auth.uid()) = user_id) and is_membro_ativo());
create policy ai_kchunks_insert on public.ai_knowledge_chunks
  for insert to authenticated
  with check (((select auth.uid()) = user_id) and is_membro_ativo());
create policy ai_kchunks_delete on public.ai_knowledge_chunks
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ============ recuperação semântica (SECURITY INVOKER → a RLS aplica) ============
-- Só devolve trechos de documentos APROVADos e INDEXADos do próprio usuário.
create or replace function public.match_ai_knowledge(
  query_embedding extensions.vector(384),
  match_count int default 5
)
returns table (id uuid, doc_id uuid, idx int, trecho text, titulo text, fonte text, distancia float)
language sql
stable
set search_path = public, extensions
as $$
  select c.id, c.doc_id, c.idx, c.trecho, d.titulo, d.fonte,
         (c.embedding <=> query_embedding) as distancia
  from public.ai_knowledge_chunks c
  join public.ai_knowledge_docs d on d.id = c.doc_id
  where d.aprovado = true
    and d.status = 'indexado'
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit greatest(1, least(match_count, 20))
$$;
grant execute on function public.match_ai_knowledge(extensions.vector(384), int) to authenticated;
