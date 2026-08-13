-- Fase FOUNDATION da camada de IA — migração aditiva e isolada.
-- Registro em repositório da migração aplicada em produção via Supabase
-- (nome: ai_foundation_tables). Cria SOMENTE as 3 tabelas aprovadas no
-- docs/ai/02-ARQUITETURA-IA-ALVO.md: ai_conversations, ai_messages, ai_audit_log.
--
-- Escopo real por (user_id, empresa). RLS por usuário + is_membro_ativo().
-- NADA aqui toca painel_estado, bi_*, membros, funções ou gatilhos existentes.
--
-- Rollback: DROP TABLE public.ai_audit_log, public.ai_messages,
--           public.ai_conversations CASCADE;  (sem efeito no app/BI existente)

-- ============ ai_conversations ============
create table if not exists public.ai_conversations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa       text not null default 'DF AGRO',
  titulo        text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists ai_conversations_user_idx
  on public.ai_conversations (user_id, atualizado_em desc);
alter table public.ai_conversations enable row level security;
grant select, insert, update, delete on public.ai_conversations to authenticated;

create policy ai_conversations_select on public.ai_conversations
  for select to authenticated
  using (((select auth.uid()) = user_id) and is_membro_ativo());
create policy ai_conversations_insert on public.ai_conversations
  for insert to authenticated
  with check (((select auth.uid()) = user_id) and is_membro_ativo());
create policy ai_conversations_update on public.ai_conversations
  for update to authenticated
  using (((select auth.uid()) = user_id) and is_membro_ativo())
  with check (((select auth.uid()) = user_id) and is_membro_ativo());
create policy ai_conversations_delete on public.ai_conversations
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ============ ai_messages ============
create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa         text not null default 'DF AGRO',
  papel           text not null check (papel in ('user','assistant','tool','system')),
  conteudo        text not null,
  tool_nome       text,
  tokens          integer,
  criado_em       timestamptz not null default now()
);
create index if not exists ai_messages_conv_idx
  on public.ai_messages (conversation_id, criado_em);
alter table public.ai_messages enable row level security;
grant select, insert on public.ai_messages to authenticated;

create policy ai_messages_select on public.ai_messages
  for select to authenticated
  using (((select auth.uid()) = user_id) and is_membro_ativo());
create policy ai_messages_insert on public.ai_messages
  for insert to authenticated
  with check (((select auth.uid()) = user_id) and is_membro_ativo());

-- ============ ai_audit_log ============
-- Cobre "agent runs" (tipo='run'), "tool call logging" (tipo='tool_call') e "erros".
create table if not exists public.ai_audit_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa         text not null default 'DF AGRO',
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  tipo            text not null default 'run' check (tipo in ('run','tool_call')),
  tool            text,
  nivel           text not null default 'READ' check (nivel in ('READ','SAFE_WRITE','SENSITIVE_WRITE')),
  args_hash       text,
  modelo          text,
  ok              boolean not null default true,
  erro            text,
  latencia_ms     integer,
  tokens          integer,
  criado_em       timestamptz not null default now()
);
create index if not exists ai_audit_log_user_idx
  on public.ai_audit_log (user_id, criado_em desc);
create index if not exists ai_audit_log_tool_idx
  on public.ai_audit_log (tool);
alter table public.ai_audit_log enable row level security;
grant select, insert on public.ai_audit_log to authenticated;

create policy ai_audit_log_select on public.ai_audit_log
  for select to authenticated
  using (((select auth.uid()) = user_id) or is_admin());
create policy ai_audit_log_insert on public.ai_audit_log
  for insert to authenticated
  with check (((select auth.uid()) = user_id) and is_membro_ativo());
