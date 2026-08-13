-- Fase WHATSAPP — integração inicial (WhatsApp Cloud API). Aditiva e isolada.
-- Registro em repositório da migração aplicada (nome: ai_whatsapp).
-- Tokens SÓ no backend (env). Webhook escreve via service role; UI lê via RLS.
-- SEM exclusões (nenhum GRANT de DELETE). Dedupe por wa_message_id.
-- NADA aqui toca painel_estado, bi_*, membros, funções ou gatilhos existentes.
--
-- Rollback: DROP TABLE whatsapp_logs, whatsapp_messages, whatsapp_conversations,
--           whatsapp_contacts, whatsapp_config CASCADE;

create table if not exists public.whatsapp_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  empresa text not null default 'DF AGRO',
  numero text, phone_number_id text,
  ativo boolean not null default false,
  ultimo_evento_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.whatsapp_config enable row level security;
grant select, insert, update on public.whatsapp_config to authenticated;
create policy wacfg_select on public.whatsapp_config for select to authenticated
  using (((select auth.uid()) = user_id) and is_membro_ativo());
create policy wacfg_insert on public.whatsapp_config for insert to authenticated
  with check (((select auth.uid()) = user_id) and is_admin());
create policy wacfg_update on public.whatsapp_config for update to authenticated
  using (((select auth.uid()) = user_id) and is_admin())
  with check (((select auth.uid()) = user_id) and is_admin());

create table if not exists public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa text not null default 'DF AGRO',
  wa_id text not null, nome text, ultimo_contato_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (user_id, wa_id)
);
alter table public.whatsapp_contacts enable row level security;
grant select on public.whatsapp_contacts to authenticated;
create policy wacontacts_select on public.whatsapp_contacts for select to authenticated
  using (((select auth.uid()) = user_id) and is_membro_ativo());

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa text not null default 'DF AGRO',
  contact_id uuid references public.whatsapp_contacts(id) on delete set null,
  wa_id text, status text not null default 'aberta',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists wa_conv_user_idx on public.whatsapp_conversations (user_id, atualizado_em desc);
alter table public.whatsapp_conversations enable row level security;
grant select on public.whatsapp_conversations to authenticated;
create policy waconv_select on public.whatsapp_conversations for select to authenticated
  using (((select auth.uid()) = user_id) and is_membro_ativo());

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa text not null default 'DF AGRO',
  conversation_id uuid references public.whatsapp_conversations(id) on delete set null,
  contact_id uuid references public.whatsapp_contacts(id) on delete set null,
  wa_message_id text,
  direcao text not null check (direcao in ('in','out')),
  tipo text, texto text,
  status text not null default 'recebida' check (status in ('recebida','enviada','erro')),
  erro text, criado_em timestamptz not null default now()
);
create unique index if not exists wa_msg_waid_uk on public.whatsapp_messages (wa_message_id);
create index if not exists wa_msg_conv_idx on public.whatsapp_messages (conversation_id, criado_em);
create index if not exists wa_msg_user_idx on public.whatsapp_messages (user_id, criado_em desc);
alter table public.whatsapp_messages enable row level security;
grant select on public.whatsapp_messages to authenticated;
create policy wamsg_select on public.whatsapp_messages for select to authenticated
  using (((select auth.uid()) = user_id) and is_membro_ativo());

create table if not exists public.whatsapp_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users(id) on delete cascade,
  empresa text not null default 'DF AGRO',
  tipo text not null,
  nivel text not null default 'info' check (nivel in ('info','erro','aviso')),
  mensagem text, detalhe jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists wa_logs_idx on public.whatsapp_logs (user_id, criado_em desc);
alter table public.whatsapp_logs enable row level security;
grant select on public.whatsapp_logs to authenticated;
create policy walogs_select on public.whatsapp_logs for select to authenticated
  using (((user_id is null) or ((select auth.uid()) = user_id)) and is_membro_ativo());
