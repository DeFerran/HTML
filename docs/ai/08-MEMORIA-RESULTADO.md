# Fase MEMÓRIA — Resultado

**Data:** 2026-08-13
**Fase:** Sistema de memória da IA (sem automações, sem WhatsApp).
**Regra-mãe:** a IA é uma CAMADA. A memória é aditiva e isolada (`ai_memory` +
tool READ/SAFE_WRITE + painel). Nada toca `painel_estado`, `bi_*`, `membros`,
funções ou gatilhos existentes.

---

## 1. Objetivo realizado

Memória contextual que **não transforma toda conversa em verdade oficial**:
- a IA pode **PROPOR** memórias, mas elas nascem **PENDING_REVIEW**;
- **informações agronômicas críticas** e **toda proposta da IA** **sempre**
  exigem validação humana (regra + trigger no banco);
- só memória **VALIDATED** é recuperada para o Copiloto;
- nada é apagado silenciosamente — descarte é **INVALIDATED** (mantido).

## 2. Modelo de dados (`ai_memory`)

Contém **todos** os campos pedidos (+ auditoria de validação):

| Campo | Observação |
| ----- | ---------- |
| `tenant_id`, `company_id` | placeholders single-tenant (`'DF AGRO'`) — a plataforma não tem multi-tenant real (doc 01/02); mantidos para compatibilidade futura. |
| `user_id` | dono; escopo real + FK `auth.users`. |
| `entity_type`, `entity_id` | vínculo com entidade (ex.: `cliente` / nome). |
| `memory_type` | ex.: `preferencia`, `fato`, `conhecimento`, `recomendacao_agronomica`. |
| `content` | texto da memória. |
| `source` | `usuario` / `ia` / `import`. |
| `confidence` | 0–1 (check). |
| `validated` | boolean. |
| `status` | **VALIDATED / PENDING_REVIEW / INVALIDATED** (check). |
| `created_at`, `updated_at` | timestamps (`updated_at` mantido pelo trigger). |
| `validado_por`, `validado_em` | quem/quando validou. |
| `empresa` | tenant literal existente. |

**Estados:** `VALIDATED` (oficial, usada pela IA), `PENDING_REVIEW` (proposta,
aguardando revisão), `INVALIDATED` (descartada, nunca apagada).

## 3. Regras de validação (definidas)

Enforcement em **duas camadas** (defesa em profundidade):

1. **Código** (`tools/memory_rules.ts`, puro/testável): `initialMemoryStatus()`
   — agronômico crítico → PENDING; `source='ia'` → PENDING; manual não-crítico →
   pode VALIDATED.
2. **Banco** (`trigger ai_memory_guard`): no INSERT, se `memory_type` ∈
   {recomendacao_agronomica, analise_solo, manejo, dose_aplicacao, fertilidade,
   calagem} **ou** `source='ia'` → força `status='PENDING_REVIEW'`,
   `validated=false`. Assim, **nem via API** um agronômico/proposta nasce oficial.

## 4. Integração ao Copiloto (respeitando contexto e tenant)

- **`recall_memory`** (READ): recupera **só** memória `VALIDATED` do usuário (RLS
  = barreira de tenant); nunca traz pendente/invalidada.
- **`propose_memory`** (**SAFE_WRITE**): a IA **propõe** → grava `PENDING_REVIEW`
  (`source='ia'`); o gate do gateway (`meu_papel()`) só executa para
  **editor/admin**; o trigger reforça o estado. O `ai_audit_log` registra o nível
  real (`SAFE_WRITE`).

## 5. Interface (INTELIGÊNCIA ARTIFICIAL → Memória)

Aba nova `🧠 IA · Memória` (mesma feature flag `df_ia_kb`, membro ativo). Permite
o pedido completo:

- **visualizar** (tabela com conteúdo, tipo, entidade, fonte, confiança, estado);
- **pesquisar** (ilike no conteúdo) e **filtrar** (estado, tipo);
- **validar** (→ VALIDATED, grava `validado_por`/`validado_em`);
- **editar** (conteúdo);
- **invalidar** (→ INVALIDATED, **sem apagar**);
- **adicionar** manual (tipos agronômicos entram como PENDENTE mesmo marcando validar).

`index.html` ganhou só 1 botão de aba, 1 `<section>` e 1 bloco de funções —
aditivo, atrás de flag. **Nenhuma página/dado existente alterado.**

## 6. Arquivos

**Criados**
- `supabase/functions/ai-gateway/tools/memory_rules.ts` (+ `memory_rules.test.ts`)
- `supabase/migrations/20260813_ai_memory.sql`
- `docs/ai/08-MEMORIA-RESULTADO.md`

**Modificados**
- `supabase/functions/ai-gateway/tools/types.ts` (memory types + `papel`/`proposeMemory` + `nivel` READ|SAFE_WRITE)
- `supabase/functions/ai-gateway/tools/read_tools.ts` (+`recall_memory`, +`propose_memory`, `toolNivel`)
- `supabase/functions/ai-gateway/tools/read_tools.test.ts` (+testes de memória)
- `supabase/functions/ai-gateway/index.ts` (papel, `proposeMemory`, gate SAFE_WRITE, nível na auditoria)
- `supabase/functions/ai-gateway/README.md`
- `index.html` (aba + seção + funções da Memória — aditivo)

## 7. Tabelas / migrations

- Migração **`ai_memory`** (aplicada): tabela + RLS (select/insert/update; **sem
  delete**) + trigger `ai_memory_guard` + função `match_ai_memory`. Prevista e
  aprovada no doc 02 §11. Aditiva/reversível.

## 8. Endpoints

- `ai-gateway` **v4 ACTIVE** (`verify_jwt=true`): agora com `recall_memory`
  (READ) e `propose_memory` (SAFE_WRITE, gate editor/admin).

## 9. Testes executados

### Unitários (bun) — **34 passaram, 0 falharam** (3 arquivos)

- **`memory_rules.test.ts`** (5): agronômico sempre PENDING (mesmo manual+validar);
  proposta da IA nunca nasce validada; manual não-crítico pode VALIDATED;
  case-insensitive.
- **`read_tools.test.ts`** (+6 de memória): `recall_memory` só devolve VALIDATED,
  filtra por consulta, e "sem validada" → `encontrado=false`; `propose_memory`
  chama o injetado e retorna `PENDING_REVIEW`, agronômico traz aviso de validação,
  e sem `proposeMemory` no contexto → `disponivel=false`. (Mantidos os testes de
  cross-tenant, dados inexistentes e RAG.)

### Banco (execute_sql / advisors)

- `ai_memory` presente, **3 policies**, **DELETE grant = 0** (não apaga),
  trigger + 2 funções presentes. `get_advisors`: **nenhum alerta novo** (funções
  SECURITY INVOKER com `search_path` fixo).

### Build / sintaxe

- Deploy **`ai-gateway` v4 ACTIVE** = bundle Deno compilado server-side.
- Transpile de todos os `.ts` do edge: OK. Sintaxe do JS do `index.html`: OK.

### Limite do ambiente (não é defeito)

- Smoke test HTTP e simulação de RLS/trigger com role `authenticated` seguem
  bloqueados no sandbox (proxy nega `*.supabase.co`; `execute_sql` é read-only).
  Enforcement verificado por estrutura + regras unitárias + o trigger no banco.

## 10. Riscos

| Risco | Nível | Observação |
| ----- | ----- | ---------- |
| Conversa virar "fato oficial" sozinha | BAIXO | Proposta da IA nasce PENDING (código + trigger); só humano valida. |
| Recomendação agronômica errada validada por engano | MÉDIO-BAIXO | Sempre PENDING; validação é ato humano explícito e auditável (`validado_por`). |
| Perda de histórico | BAIXO | Sem DELETE; descarte = INVALIDATED (mantido). |
| Escrita indevida pela IA | BAIXO | `propose_memory` é SAFE_WRITE, gate editor/admin; RLS por usuário. |

## 11. Rollback

1. **Front:** `desativarPainelIA()` (flag) some com as abas de IA.
2. **Gateway:** reverter para v3 (sem memory tools) ou redeploy.
3. **Banco:** `DROP TRIGGER ai_memory_guard_trg; DROP FUNCTION ai_memory_guard,
   match_ai_memory; DROP TABLE ai_memory CASCADE;`.
Nada afeta `painel_estado`, `bi_*`, `membros`, funções ou gatilhos.

## 12. Pendências

- Configurar `ANTHROPIC_API_KEY` (passo do dono) para o chat propor/recuperar
  memória de ponta a ponta. O **painel de Memória já funciona** sem esse secret
  (CRUD direto via PostgREST/RLS).
- Smoke test manual end-to-end pelo dono.

## 13. Próxima fase sugerida

- **Fase 06 — Copiloto (UI de chat):** drawer + histórico + contexto da página,
  ligando o chat (que já tem READ tools + RAG + memória) à interface.
- Automações, Approval Engine e WhatsApp seguem **fora de escopo** até ordem
  explícita.

**Não iniciar sem ordem explícita do usuário.**

---

_PARADO conforme a regra de implementação incremental._
