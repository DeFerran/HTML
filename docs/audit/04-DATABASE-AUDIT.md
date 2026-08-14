# 04 — Auditoria de Banco (Supabase)

**Projeto:** `pvftibzzqcbpgdihfcmb` · single-tenant (`empresa='DF AGRO'`) ·
verificação **read-only** via MCP.

## Números (confirmados por query)

| Métrica | Valor |
|---------|-------|
| Tabelas no schema `public` | **37** |
| Políticas RLS | **69** |
| Tabelas **sem** RLS | **0** ✅ |
| `bi_custos_mensais` linhas / SUM(valor) | 288 / **0** 🔴 |
| `bi_metas` receita_meta / receita_real | 1.800.000 / **0** 🟡 |

## Arquitetura de dados

- **Fonte oficial**: `painel_estado` (snapshot JSON do estado `D`).
- **Espelhos ETL `bi_*`**: derivados do snapshot, chaveados por **texto**, sem
  FKs nem `created_at`. Servem à IA (leitura) e a relatórios.

## Reconciliação (dados reais)

| Invariante | Situação |
|-----------|----------|
| Receita 26/27: bi_clientes = bi_servicos = bi_safras | ✅ R$ 1.479.363,40 |
| bi_caixa_mensal: margem = receita − custo | ✅ (divergência 0) |
| bi_custo_categoria(2026) = bi_lancamentos(Pago) | ✅ R$ 908.726,57 |
| **bi_custos_mensais** total | 🔴 **0** — espelho zerado (I-08) |
| **bi_metas** realizado | 🟡 **0** — espelho defasado (I-09) |

## Divergências estruturais (necessitam decisão)

| # | Descrição | Impacto |
|---|-----------|---------|
| I-08 | `bi_custos_mensais` zerada | `get_costs` da IA reporta custo mensal R$ 0 |
| I-09 | `bi_metas` realizado defasado | IA/relatórios de meta desatualizados; fonte viva é `D.metasSafra` |
| I-12 | Hectares bi_clientes (~20.003) vs bi_servicos (~28.500) | Área "oficial" ambígua |

## Advisors — Performance (INFO/WARN, P3)

- **11 FKs sem índice de cobertura** — otimização de JOIN.
- **9 índices sem uso** — candidatos a remoção futura (não urgente).
- **Política duplicada em `membros`** — limpeza.

Todos **P3**, sem impacto funcional. Nenhuma ação destrutiva recomendada.

## Migrações

Padrão observado: **aditivo** (CREATE TABLE / ADD COLUMN / CREATE POLICY),
retrocompatível. Nenhuma migração destrutiva encontrada. Conforme CLAUDE.md.

## Regras de segurança de dados (auto-impostas nesta auditoria)

Nenhum DROP/TRUNCATE/DELETE/rename/alteração de RLS foi executado. Toda a
verificação de banco foi **somente leitura**. As correções aplicadas são
**exclusivamente no frontend** (`index.html`) — o banco não foi tocado.

## Recomendações (não executadas — aguardam ordem)

1. Reprocessar o ETL de `bi_custos_mensais` e `bi_metas` (fora do escopo de
   código do app).
2. Avaliar índices nas 11 FKs quentes.
3. Remover a política duplicada de `membros`.
