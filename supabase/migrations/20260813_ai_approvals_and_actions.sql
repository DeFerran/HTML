-- Fase APPROVALS — Action Tools controladas + Approval Engine (docs/ai/02 §15).
-- Registro em repositório da migração aplicada (nome: ai_approvals_and_actions).
-- Classes: READ / SAFE_WRITE / SENSITIVE_WRITE. SENSITIVE nunca executa sozinha:
-- vira ai_approvals 'pendente' e só ADMIN aprova/edita/rejeita -> executa -> auditoria.
-- SEM delete, SEM financas automaticas, SEM recomendacao agronomica final automatica.
-- SEM GRANT de DELETE. Escrita = pode_editar; decisao = is_admin.
-- Rollback: DROP TABLE ai_report_drafts, ai_tasks, ai_alerts, ai_approvals CASCADE;

create table if not exists public.ai_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa text not null default 'DF AGRO',
  agente text not null default 'Copiloto DF AGRO',
  tool text not null,
  nivel text not null default 'SENSITIVE_WRITE' check (nivel in ('SENSITIVE_WRITE')),
  entity_type text, entity_id text,
  payload jsonb not null default '{}'::jsonb,
  risco text not null default 'medio' check (risco in ('baixo','medio','alto')),
  status text not null default 'pendente' check (status in ('pendente','aprovado','rejeitado','executado','erro')),
  decidido_por uuid references auth.users(id) on delete set null,
  decidido_em timestamptz, resultado jsonb, erro text,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create index if not exists ai_approvals_status_idx on public.ai_approvals (status, criado_em desc);
alter table public.ai_approvals enable row level security;
grant select, insert, update on public.ai_approvals to authenticated;  -- sem DELETE
create policy approvals_select on public.ai_approvals for select to authenticated
  using ((((select auth.uid()) = user_id) or is_admin()) and is_membro_ativo());
create policy approvals_insert on public.ai_approvals for insert to authenticated
  with check (((select auth.uid()) = user_id) and pode_editar());
create policy approvals_update on public.ai_approvals for update to authenticated
  using (is_admin()) with check (is_admin());

create table if not exists public.ai_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa text not null default 'DF AGRO',
  nivel text not null default 'info' check (nivel in ('info','aviso','critico')),
  titulo text, mensagem text, entity_type text, entity_id text,
  origem text not null default 'ia', lido boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists ai_alerts_user_idx on public.ai_alerts (user_id, criado_em desc);
alter table public.ai_alerts enable row level security;
grant select, insert, update on public.ai_alerts to authenticated;  -- sem DELETE
create policy alerts_select on public.ai_alerts for select to authenticated
  using (((select auth.uid()) = user_id) and is_membro_ativo());
create policy alerts_insert on public.ai_alerts for insert to authenticated
  with check (((select auth.uid()) = user_id) and pode_editar());
create policy alerts_update on public.ai_alerts for update to authenticated
  using (((select auth.uid()) = user_id) and pode_editar())
  with check (((select auth.uid()) = user_id) and pode_editar());

create table if not exists public.ai_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa text not null default 'DF AGRO',
  titulo text not null, descricao text,
  status text not null default 'aberta' check (status in ('aberta','em_andamento','concluida')),
  prioridade text not null default 'media' check (prioridade in ('baixa','media','alta')),
  entity_type text, entity_id text, origem text not null default 'ia',
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create index if not exists ai_tasks_user_idx on public.ai_tasks (user_id, status, criado_em desc);
alter table public.ai_tasks enable row level security;
grant select, insert, update on public.ai_tasks to authenticated;  -- sem DELETE
create policy tasks_select on public.ai_tasks for select to authenticated
  using (((select auth.uid()) = user_id) and is_membro_ativo());
create policy tasks_insert on public.ai_tasks for insert to authenticated
  with check (((select auth.uid()) = user_id) and pode_editar());
create policy tasks_update on public.ai_tasks for update to authenticated
  using (((select auth.uid()) = user_id) and pode_editar())
  with check (((select auth.uid()) = user_id) and pode_editar());

create table if not exists public.ai_report_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa text not null default 'DF AGRO',
  titulo text not null, conteudo text, entity_type text, entity_id text,
  origem text not null default 'ia', criado_em timestamptz not null default now()
);
create index if not exists ai_report_drafts_user_idx on public.ai_report_drafts (user_id, criado_em desc);
alter table public.ai_report_drafts enable row level security;
grant select, insert on public.ai_report_drafts to authenticated;  -- sem UPDATE/DELETE
create policy drafts_select on public.ai_report_drafts for select to authenticated
  using (((select auth.uid()) = user_id) and is_membro_ativo());
create policy drafts_insert on public.ai_report_drafts for insert to authenticated
  with check (((select auth.uid()) = user_id) and pode_editar());
