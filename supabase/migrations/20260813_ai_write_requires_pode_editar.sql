-- Ajuste de segurança (revisão): ESCRITA nas tabelas de IA exige editor/admin
-- (pode_editar()), alinhado ao CLAUDE.md (SAFE_WRITE = editor/admin) e ao modo
-- somente-leitura do app. LEITURA permanece para qualquer membro ativo.
-- Aditivo/reversível: apenas recria políticas de INSERT/UPDATE (nenhum dado muda).
-- Registro em repositório da migração aplicada (nome: ai_write_requires_pode_editar).
--
-- Rollback: recriar cada política usando is_membro_ativo() no lugar de pode_editar().

drop policy if exists ai_kdocs_insert on public.ai_knowledge_docs;
create policy ai_kdocs_insert on public.ai_knowledge_docs for insert to authenticated
  with check (((select auth.uid()) = user_id) and pode_editar());
drop policy if exists ai_kdocs_update on public.ai_knowledge_docs;
create policy ai_kdocs_update on public.ai_knowledge_docs for update to authenticated
  using (((select auth.uid()) = user_id) and pode_editar())
  with check (((select auth.uid()) = user_id) and pode_editar());

drop policy if exists ai_kchunks_insert on public.ai_knowledge_chunks;
create policy ai_kchunks_insert on public.ai_knowledge_chunks for insert to authenticated
  with check (((select auth.uid()) = user_id) and pode_editar());

drop policy if exists ai_memory_insert on public.ai_memory;
create policy ai_memory_insert on public.ai_memory for insert to authenticated
  with check (((select auth.uid()) = user_id) and pode_editar());
drop policy if exists ai_memory_update on public.ai_memory;
create policy ai_memory_update on public.ai_memory for update to authenticated
  using (((select auth.uid()) = user_id) and pode_editar())
  with check (((select auth.uid()) = user_id) and pode_editar());

drop policy if exists autorules_insert on public.automation_rules;
create policy autorules_insert on public.automation_rules for insert to authenticated
  with check (((select auth.uid()) = user_id) and pode_editar());
drop policy if exists autorules_update on public.automation_rules;
create policy autorules_update on public.automation_rules for update to authenticated
  using (((select auth.uid()) = user_id) and pode_editar())
  with check (((select auth.uid()) = user_id) and pode_editar());

drop policy if exists aijobs_insert on public.ai_jobs;
create policy aijobs_insert on public.ai_jobs for insert to authenticated
  with check (((select auth.uid()) = user_id) and pode_editar());
drop policy if exists aijobs_update on public.ai_jobs;
create policy aijobs_update on public.ai_jobs for update to authenticated
  using (((select auth.uid()) = user_id) and pode_editar())
  with check (((select auth.uid()) = user_id) and pode_editar());

drop policy if exists autoruns_insert on public.automation_runs;
create policy autoruns_insert on public.automation_runs for insert to authenticated
  with check (((select auth.uid()) = user_id) and pode_editar());
