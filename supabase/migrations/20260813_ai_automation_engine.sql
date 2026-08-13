-- Fase AUTOMAÇÕES — migração aditiva e isolada (docs/ai/02 §12-14).
-- Registro em repositório da migração aplicada em produção (nome: ai_automation_engine).
-- Queue aprovada = tabela ai_jobs. Regras (TRIGGER/CONDITION/ACTION) + histórico.
-- SEM ações financeiras. SEM exclusões: nenhuma tabela recebe GRANT de DELETE.
-- NADA aqui toca painel_estado, bi_*, membros, funções ou gatilhos existentes.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.automation_claim_jobs(int);
--   DROP FUNCTION IF EXISTS public.automation_due_rules();
--   DROP TABLE IF EXISTS public.automation_runs, public.ai_jobs, public.automation_rules CASCADE;

create table if not exists public.automation_rules (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa        text not null default 'DF AGRO',
  nome           text not null,
  descricao      text,
  ativo          boolean not null default true,
  trigger_type   text not null check (trigger_type in ('schedule','database_event','manual')),
  trigger_config jsonb not null default '{}'::jsonb,
  condition      jsonb not null default '{}'::jsonb,
  action_type    text not null check (action_type in ('run_agent','create_internal_alert','generate_summary')),
  action_config  jsonb not null default '{}'::jsonb,
  ultima_exec    timestamptz,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists automation_rules_user_idx on public.automation_rules (user_id, ativo, atualizado_em desc);
alter table public.automation_rules enable row level security;
grant select, insert, update on public.automation_rules to authenticated;  -- sem DELETE
create policy autorules_select on public.automation_rules for select to authenticated
  using (((select auth.uid()) = user_id) and is_membro_ativo());
create policy autorules_insert on public.automation_rules for insert to authenticated
  with check (((select auth.uid()) = user_id) and is_membro_ativo());
create policy autorules_update on public.automation_rules for update to authenticated
  using (((select auth.uid()) = user_id) and is_membro_ativo())
  with check (((select auth.uid()) = user_id) and is_membro_ativo());

create table if not exists public.ai_jobs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa        text not null default 'DF AGRO',
  tipo           text not null default 'automation',
  rule_id        uuid references public.automation_rules(id) on delete set null,
  dedupe_key     text not null,
  payload        jsonb not null default '{}'::jsonb,
  status         text not null default 'pendente' check (status in ('pendente','rodando','ok','erro')),
  tentativas     integer not null default 0,
  max_tentativas integer not null default 3,
  run_at         timestamptz not null default now(),
  resultado      jsonb,
  erro           text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create unique index if not exists ai_jobs_dedupe_uk on public.ai_jobs (user_id, dedupe_key);
create index if not exists ai_jobs_claim_idx on public.ai_jobs (status, run_at);
alter table public.ai_jobs enable row level security;
grant select, insert, update on public.ai_jobs to authenticated;  -- sem DELETE
create policy aijobs_select on public.ai_jobs for select to authenticated
  using (((select auth.uid()) = user_id) and is_membro_ativo());
create policy aijobs_insert on public.ai_jobs for insert to authenticated
  with check (((select auth.uid()) = user_id) and is_membro_ativo());
create policy aijobs_update on public.ai_jobs for update to authenticated
  using (((select auth.uid()) = user_id) and is_membro_ativo())
  with check (((select auth.uid()) = user_id) and is_membro_ativo());

create table if not exists public.automation_runs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa      text not null default 'DF AGRO',
  rule_id      uuid references public.automation_rules(id) on delete set null,
  job_id       uuid references public.ai_jobs(id) on delete set null,
  trigger_type text,
  status       text not null check (status in ('ok','erro','pulado')),
  tentativa    integer not null default 1,
  started_at   timestamptz,
  finished_at  timestamptz,
  duracao_ms   integer,
  output       jsonb,
  erro         text,
  criado_em    timestamptz not null default now()
);
create index if not exists automation_runs_rule_idx on public.automation_runs (rule_id, criado_em desc);
create index if not exists automation_runs_user_idx on public.automation_runs (user_id, criado_em desc);
alter table public.automation_runs enable row level security;
grant select, insert on public.automation_runs to authenticated;  -- log imutável (sem update/delete)
create policy autoruns_select on public.automation_runs for select to authenticated
  using (((select auth.uid()) = user_id) and is_membro_ativo());
create policy autoruns_insert on public.automation_runs for insert to authenticated
  with check (((select auth.uid()) = user_id) and is_membro_ativo());

create or replace function public.automation_claim_jobs(max_jobs int default 5)
returns setof public.ai_jobs
language plpgsql security invoker set search_path = public
as $$
begin
  return query
  update public.ai_jobs j set status = 'rodando', atualizado_em = now()
   where j.id in (
     select id from public.ai_jobs
      where status = 'pendente' and run_at <= now()
      order by run_at asc for update skip locked
      limit greatest(1, least(max_jobs, 20))
   )
  returning j.*;
end $$;
grant execute on function public.automation_claim_jobs(int) to authenticated;

create or replace function public.automation_due_rules()
returns setof public.automation_rules
language sql stable security invoker set search_path = public
as $$
  select * from public.automation_rules where ativo = true and trigger_type = 'schedule'
$$;
grant execute on function public.automation_due_rules() to authenticated;
