-- Fase HARDENING/OBSERVABILIDADE — migração ADITIVA e retrocompatível.
-- Não altera dados existentes, não mexe em painel_estado/bi_*/membros.
-- 1) Colunas de observabilidade de custo em ai_audit_log (split de tokens + custo).
-- 2) RPC agregada de uso diário (guardrail de custo por tenant/usuário) —
--    SECURITY DEFINER retorna apenas SOMAS (nunca linhas), então funciona para
--    qualquer membro sem expor auditoria alheia (a RLS de linha continua intacta).
--
-- Rollback:
--   drop function if exists public.ai_usage_today();
--   alter table public.ai_audit_log drop column if exists tokens_in,
--     drop column if exists tokens_out, drop column if exists custo_usd;

-- 1) colunas aditivas (nullable → retrocompatível; linhas antigas ficam NULL)
alter table public.ai_audit_log add column if not exists tokens_in  integer;
alter table public.ai_audit_log add column if not exists tokens_out integer;
alter table public.ai_audit_log add column if not exists custo_usd  numeric(12,6);

-- índice para as consultas de métrica por janela de tempo (tipo + tempo)
create index if not exists ai_audit_log_tipo_tempo_idx
  on public.ai_audit_log (tipo, criado_em desc);

-- 2) uso de tokens do DIA corrente: total do tenant (single-tenant hoje) e do
--    próprio usuário. Aggregate-only + SECURITY DEFINER → não vaza linhas.
create or replace function public.ai_usage_today()
returns table(tenant_tokens bigint, user_tokens bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(tokens), 0)::bigint as tenant_tokens,
    coalesce(sum(tokens) filter (where user_id = auth.uid()), 0)::bigint as user_tokens
  from public.ai_audit_log
  where tipo = 'run'
    and criado_em >= date_trunc('day', now());
$$;

revoke all on function public.ai_usage_today() from public;
grant execute on function public.ai_usage_today() to authenticated;

-- NOTA (SaaS/multi-tenant futuro): quando houver mais de um tenant, escopar por
--   empresa do chamador (ex.: and empresa = public.minha_empresa()) para o total
--   do tenant. Hoje o painel é single-tenant (empresa='DF AGRO').
