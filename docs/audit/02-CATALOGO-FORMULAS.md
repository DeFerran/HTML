# 02 — Catálogo de Fórmulas

**Objetivo:** mapear toda fórmula financeira/agronômica, sua fonte única (ou
divergência), e se está testada. Referências em `index.html`.

## Cadeia financeira (single source declarada)

| Fórmula | Definição | Linha | Fonte | Status |
|---------|-----------|-------|-------|--------|
| `recBruta()` | `D.safras.receita[2]` (faturamento contratado 26/27) | 1763 | snapshot | 🔵 índice fixo `[2]` — não segue `safraAtual()` (I-06) |
| `imposto()` | `recBruta()*taxRate` | 1764 | `taxRate` (0.17 padrão) | ✅ |
| `recLiquida()` | `recBruta()−imposto()` | 1765 | derivada | ✅ |
| `custoTotal()` | `projGastos.total` (ou `sum(caixaMensal.custo)`); `−outrosVal()` se `outrosOff` | 1766 | snapshot | ✅ |
| `custoColeta()` | `Σ custoCategoria2026[cat de coleta]` | 2389 | snapshot | ✅ |
| `custoLab()` | `labTotal()` (Laboratório) ou `custoHa.laboratorio` (188.000 base) | 2390 | snapshot/base | ✅ |
| `custoDemais()` | `max(custoTotal−custoColeta−custoLab,0)` | 2391 | derivada | ✅ |
| `haTotal()` | `Σ servicos.ha2627 (>0)` ou 1 | 2387 | snapshot | ✅ (guarda `||1`) |
| `margemOper()` | `recLiquida()−custoTotal()` | 2379 | derivada | ✅ |
| `margemLiq()` | `margemOper()−comissaoVal()` | 2381 | derivada | ✅ |

## Comissão — **múltiplas bases divergentes** 🔵 (I-07)

Regra declarada (comentário linha 1771): *"laboratório é despesa, não entra na
base de comissão"* → base = **receita bruta**.

| Local | Expressão | Linha | Base efetiva |
|-------|-----------|-------|--------------|
| `comBase()` | `recBruta()` | 1771 | receita bruta ✅ (canônica) |
| `comissaoSobre(r)` | `r*comRate()` | 2366 | receita informada |
| `comissaoVal()` | plano escalonado **ou** `comBase()*comRate()` | 2376 | receita bruta / tiers |
| `servMC` (segmento) | `rec*comRate()` | 2410 | receita do segmento ✅ |
| `geralMC()` | `rec*comRate()` | 2412 | receita ✅ |
| **`renderServGeral` (custoHa)** | `max(rec−custoDir,0)*comRate()` | **2452** | receita **− custo direto** ❌ diverge |
| Plano escalonado Anderlírio | tiers 1.4M→7%, 1.5M→8%, 1.7M→9%, 1.8M→10% | 1515 | por faixa de vendas |

**Conclusão:** a linha 2452 é o ponto fora da curva. Todas as outras batem com
"comissão sobre receita". **Não auto-corrigido** — decidir a base oficial é
negócio (afeta margens exibidas). Ver 08.

## Ponto de equilíbrio / margem por hectare

| Fórmula | Onde | Status |
|---------|------|--------|
| `contribHa()` (contribuição/ha após lab+coleta) | renderMetas | ✅ |
| `breakevenHa()` = demais / contribHa | renderMetas | ✅ (guardado por formatadores finite-safe agora) |
| `breakevenRec()`, `margemSeguranca()` | renderMetas | ✅ |
| Cascata margem/ha (`stH`) | renderMetas (~2984) | ✅ |
| `PCT(x/rb)` diversos | 2544/2552/2560/2954… | ✅ agora à prova de `rb=0` (I-05) |

## Controle Operacional — cálculo puro (testado, bun)

| Bloco | Função | Status |
|-------|--------|--------|
| `<op-coleta-calc>` | `totalDia`, `hectares`, agregados | ✅ testado |
| `<op-amostras-calc>` | `diffDias`/`toDays` (Howard Hinnant, sem TZ), `situacao`, `diasRemessa`, `agg` | ✅ testado; `tempoMedio` agora exclui dias negativos (I-04) |
| `<op-entregas-calc>` | `statusItem`, `progresso`, `agg` | ✅ testado; `statusLinha` andamento/pendente ambíguo (I-10) 🔵 |
| `<op-csv>` | `opToCsv`, `opParseCsv`, **`opNum`** | ✅ testado (opNum novo, I-02) |

## Reconciliação com o banco (real, read-only)

| Verificação | Resultado |
|-------------|-----------|
| Receita 26/27 em bi_clientes / bi_servicos / bi_safras | **idênticas** (R$ 1.479.363,40) ✅ |
| `bi_caixa_mensal.margem == receita−custo` | divergência **0** ✅ |
| `bi_custo_categoria(2026) == bi_lancamentos(Pago)` | **R$ 908.726,57** ✅ |
| `bi_custos_mensais` TOTAL | **0** (288 linhas zeradas) 🔴 (I-08) |
| `bi_metas.receita_real` | **0** (meta 1.8M) 🟡 (I-09) |

**Veredito:** as fórmulas vivas do app são consistentes e majoritariamente
testadas. Os dois furos reais são (a) `recBruta` com índice fixo e (b) a base de
comissão da linha 2452 — ambos **negócio/decisão**, não auto-corrigíveis.
