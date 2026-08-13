-- Fase MEMÓRIA — migração aditiva e isolada (docs/ai/02 §11: ai_memory).
-- Registro em repositório da migração aplicada em produção (nome: ai_memory).
-- Memória contextual TIPADA, com estados VALIDATED/PENDING_REVIEW/INVALIDATED.
-- NADA aqui toca painel_estado, bi_*, membros, funções ou gatilhos existentes.
--
-- Regras de domínio (defesa em profundidade):
--   * agronômico crítico E toda proposta da IA => nasce PENDING_REVIEW (trigger).
--   * não há GRANT de DELETE => memória não é apagada silenciosamente (usa-se
--     INVALIDATED).
--
-- Rollback:
--   DROP TRIGGER IF EXISTS ai_memory_guard_trg ON public.ai_memory;
--   DROP FUNCTION IF EXISTS public.ai_memory_guard();
--   DROP FUNCTION IF EXISTS public.match_ai_memory(text, int);
--   DROP TABLE IF EXISTS public.ai_memory CASCADE;

create table if not exists public.ai_memory (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa      text not null default 'DF AGRO',
  tenant_id    text not null default 'DF AGRO',   -- placeholder single-tenant (ver doc 01/02)
  company_id   text not null default 'DF AGRO',   -- placeholder single-tenant
  entity_type  text,
  entity_id    text,
  memory_type  text not null,
  content      text not null,
  source       text not null default 'usuario' check (source in ('usuario','ia','import')),
  confidence   numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  validated    boolean not null default false,
  status       text not null default 'PENDING_REVIEW' check (status in ('VALIDATED','PENDING_REVIEW','INVALIDATED')),
  validado_por uuid references auth.users(id) on delete set null,
  validado_em  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists ai_memory_user_idx
  on public.ai_memory (user_id, status, updated_at desc);
create index if not exists ai_memory_entity_idx
  on public.ai_memory (entity_type, entity_id);

alter table public.ai_memory enable row level security;
-- Sem DELETE: memória não é apagada silenciosamente (usa-se INVALIDATED).
grant select, insert, update on public.ai_memory to authenticated;

create policy ai_memory_select on public.ai_memory
  for select to authenticated
  using (((select auth.uid()) = user_id) and is_membro_ativo());
create policy ai_memory_insert on public.ai_memory
  for insert to authenticated
  with check (((select auth.uid()) = user_id) and is_membro_ativo());
create policy ai_memory_update on public.ai_memory
  for update to authenticated
  using (((select auth.uid()) = user_id) and is_membro_ativo())
  with check (((select auth.uid()) = user_id) and is_membro_ativo());

-- guarda de domínio: agronômico crítico / proposta da IA nunca nasce VALIDATED.
create or replace function public.ai_memory_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  if (tg_op = 'INSERT') then
    if lower(coalesce(new.memory_type,'')) = any (array[
         'recomendacao_agronomica','analise_solo','manejo','dose_aplicacao','fertilidade','calagem'
       ])
       or lower(coalesce(new.source,'')) = 'ia' then
      new.status := 'PENDING_REVIEW';
      new.validated := false;
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists ai_memory_guard_trg on public.ai_memory;
create trigger ai_memory_guard_trg
  before insert or update on public.ai_memory
  for each row execute function public.ai_memory_guard();

-- recuperação de memória VALIDADA (SECURITY INVOKER → a RLS aplica).
create or replace function public.match_ai_memory(consulta text default null, match_count int default 8)
returns table (id uuid, entity_type text, entity_id text, memory_type text, content text, confidence numeric, updated_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select m.id, m.entity_type, m.entity_id, m.memory_type, m.content, m.confidence, m.updated_at
  from public.ai_memory m
  where m.status = 'VALIDATED'
    and (
      consulta is null or consulta = ''
      or m.content ilike '%' || consulta || '%'
      or coalesce(m.entity_id,'') ilike '%' || consulta || '%'
    )
  order by m.confidence desc, m.updated_at desc
  limit greatest(1, least(match_count, 30))
$$;
grant execute on function public.match_ai_memory(text, int) to authenticated;
