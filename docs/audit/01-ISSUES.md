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

## Decisões de negócio — RESOLVIDAS (dono delegou; decididas como gestor/especialista)

Todas as decisões D-01…D-07 foram resolvidas (ver 08-MANUAL-DECISIONS.md com a
justificativa de cada uma). Restam apenas itens de higiene P3 abaixo.

| # | Prior. | Status | Onde | Resolução |
|---|--------|--------|------|-----------|
| I-06 | P1 | 🔵→✅ | `recBruta()` (1763) | Índice fixo `[2]` ignorava `safraAtual()` → agora segue a safra em foco via `safraIdx()` (26/27 idêntico ao anterior). **D-01 aplicado**, verificado em headless. | **RESOLVIDO** (Opção B — por safra). |
| I-07 | P1 | 🔵→✅ | `renderServGeral` (2452) | Comissão divergente (rec−custoDir) → alinhada à regra única **sobre receita bruta** (`rec*comRate()`). **D-02 aplicado**. | **RESOLVIDO** (Opção A — sobre a receita). |
| I-08 | P1 | 🔵→✅ | `bi_custos_mensais` (zerada) → `get_costs` | **D-03 aplicado + deployado** (v7): total/categoria via `bi_custo_categoria` (reconcilia); mensal omitido com aviso. | **RESOLVIDO**. |
| I-09 | P2 | 🟡→✅ | `bi_metas` (realizado defasado) | **D-04**: espelho **sem consumidor** (0 usos na IA/renders); fonte viva é `D.metasSafra`. Nenhum código a corrigir. | **RESOLVIDO** (fonte viva). |
| I-10 | P2 | 🔵→✅ | `OpEntregasCalc.statusLinha`/`agg` | Dupla contagem eliminada: baldes mutuamente exclusivos (concluída/andamento/pendente). **D-05 aplicado** + testes. | **RESOLVIDO** (Opção A). |
| I-11 | P2 | 🟡→✅ | `renderOpResumo` (Ciclo) | "pontos na safra" → "pontos no total" (D-07). | **RESOLVIDO**. |
| I-12 | P2 | 🔵→✅ | Hectares clientes vs serviços | **D-06**: medem coisas distintas — ha-serviço (oficial p/ economia unitária, já usado por `haTotal()`) vs pegada física por cliente. Definição registrada, sem mudança de código. | **RESOLVIDO** (definição). |

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
