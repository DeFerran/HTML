# 01 — Catálogo de Issues (Auditoria 360°)

**Data:** 2026-08-14 · **Base:** `main` @ commit da auditoria · **Método:** código
confrontado com o banco (Supabase MCP, read-only), docs e testes. Nada foi
inventado — cada item aponta arquivo:linha ou tabela.

## Legenda

- **Prioridade:** P0 (perda/corrupção de dados) · P1 (cálculo/negócio errado) ·
  P2 (inconsistência/UX enganosa) · P3 (higiene/risco futuro).
- **Status:** ✅ correto · 🟡 inconsistente · 🔴 quebrado · 🚨 risco de dados ·
  ⚪ não implementado · 🟣 mock/placeholder · 🔵 necessita decisão.

## Corrigidos nesta auditoria (ver 07-FIXES-APPLIED.md)

| # | Prior. | Status | Onde | Problema | Correção |
|---|--------|--------|------|----------|----------|
| I-01 | P0 | 🚨→✅ | `index.html` `mergeImport` (~3384) | Importar a planilha GESTÃO_AP apagava **todo** o Controle Operacional e as metas/preços por safra (não estavam na lista de preservação → `hydrate()` recriava vazios). | Adicionadas as chaves `opColeta/opAmostras/opEntregas/metasSafra/precosSafra` à preservação. Teste `tests/importmerge.test.ts` + smoke headless. |
| I-02 | P1 | 🔴→✅ | `index.html` `opEnImport` (~2136) | Import de Entregas destruía os decimais da **Área** (`/[^\d]/g` fazia `1.234,5` → `12345`). | Novo helper puro `opNum()` (pt-BR, à prova de vazio). Teste `tests/opcsv.test.ts`. |
| I-03 | P1 | 🚨→✅ | `opEnExportar`/`opAmExportar`/`opAmImport`/`opEnImport` | Coluna **Observações** não era exportada nem relida → sumia no round-trip export→import. | Coluna adicionada nas duas telas (ida e volta). Smoke round-trip. |
| I-04 | P2 | 🟡→✅ | `OpAmostrasCalc.agg` (~2188) | `tempoMedio` somava **dias negativos** (data de resultado antes do envio). | Exclui negativos da média. Teste `tests/opamostras.test.ts`. |
| I-05 | P2 | 🟡→✅ | `BRL`/`BRLk`/`PCT` (1595-1597) | Divisão por zero (base receita = 0) exibia `R$ NaN` / `Infinity%`. | Formatadores tratam NaN/Infinity como 0. Teste `tests/formatadores.test.ts`. |

## Abertos — necessitam DECISÃO do dono (não auto-corrigidos por regra)

| # | Prior. | Status | Onde | Problema | Por que não auto-corrigi |
|---|--------|--------|------|----------|--------------------------|
| I-06 | P1 | 🔵 | `recBruta()` (1763) `return D.safras.receita[2];` | Índice **fixo `[2]`** = safra 26/27. Ignora `safraAtual()`. Todo o bloco financeiro (imposto, margem, comissão, ponto de equilíbrio) usa receita bruta da 26/27 mesmo com outra safra ativa. | Mudar a base financeira por safra é alteração estrutural de regra de negócio com regressão ampla. Ver 08-MANUAL-DECISIONS. |
| I-07 | P1 | 🔵 | `renderServGeral` custoHa (2452) vs `comBase()` (1771) | Comissão calculada em **≥2 bases divergentes**: regra declarada é sobre **receita bruta** (`comBase()=recBruta()`), mas a linha 2452 usa `Math.max(rec−custoDir,0)*comRate()` (receita **menos** custo direto). | Qual é a base oficial da comissão é decisão de negócio; mudar afeta margens exibidas. |
| I-08 | P1 | 🔵 | `bi_custos_mensais` (288 linhas, `SUM(valor)=0`) | Tabela-espelho de custos mensais **totalmente zerada**. `get_costs` (ai-gateway) lê dela → IA reporta custo mensal **R$ 0**. | Requer decidir/reprocessar o ETL do snapshot; não é bug de código do app. |
| I-09 | P2 | 🟡 | `bi_metas` (`receita_meta=1.800.000`, `receita_real=0`) | Espelho de metas com **realizado zerado/defasado**. | ETL/snapshot; a fonte viva é `D.metasSafra` no app. |
| I-10 | P2 | 🔵 | `OpEntregasCalc.statusLinha`/`agg` (~2270) | Linha 100% pendente conta como **andamento E pendente** ao mesmo tempo. | Definição de "em andamento" é regra de negócio ambígua. |
| I-11 | P2 | 🟡→✅ | `renderOpResumo` (Ciclo) | Único rótulo enganoso ("pontos na safra") sem filtro por safra → trocado para "pontos no total" (D-07). Demais telas já usavam "no período". | **CORRIGIDO** — render headless confirma. |
| I-12 | P2 | 🔵 | Hectares: `bi_clientes`≈20.003 vs `bi_servicos`≈28.500 | Duas bases de área divergentes conforme a origem. | Qual é a área oficial é decisão de negócio. |

## Abertos — higiene / risco futuro (P3)

| # | Prior. | Status | Onde | Nota |
|---|--------|--------|------|------|
| I-13 | P3 | 🟡 | 6 funções `SECURITY DEFINER` RBAC (`is_admin`, `pode_editar`, `meu_papel`, `is_membro_ativo`, `meu_email`, `vincular_meu_usuario`) | Advisor WARN. **Por design** (checam papel sob RLS). Sem correção necessária; documentado. |
| I-14 | P3 | 🟡 | Auth: leaked-password protection **desligada** | Toggle no painel Supabase (HaveIBeenPwned). Recomendado ligar. |
| I-15 | P3 | 🟡 | `membros` — política duplicada; 11 FKs sem índice; 9 índices sem uso | Advisors INFO/WARN. Otimização, sem impacto funcional. |
| I-16 | P3 | ⚪ | WhatsApp (`whatsapp_config` vazia) e Anthropic (sem chave no ambiente) | Integrações **reais mas não configuradas**. Esperado até o dono ligar. |
| I-17 | P3 | 🟡 | `index.html` monolítico (~6.3k linhas) | Manutenibilidade. Blocos puros já extraídos e testados mitigam. |

**Total:** 5 corrigidos · 7 necessitam decisão/negócio · 5 higiene. Detalhe de
cada categoria nos relatórios 02–06.
