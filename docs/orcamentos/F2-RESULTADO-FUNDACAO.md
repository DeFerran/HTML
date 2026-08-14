# Orçamentos — Fase 2 (Fundação): resultado

Fundação do módulo comercial: modelo de dados + motor de cálculo puro (testado) +
cadastros comerciais. Tudo **aditivo** — nenhum cálculo, funil, financeiro, banco
ou rota existente foi alterado.

## Objetivo realizado
1. **Modelo de dados** `D.quotes` + `D.comercial` (aditivos, com seeds).
2. **Motor de precificação puro e testável** (`QuoteCalc`).
3. **Cadastros comerciais** na nova aba **Comercial** do hub Cadastros.

## Modelo de dados (hydrate + mergeImport)
- `D.quotes = []` — orçamentos comerciais (preenchido nas fases de UI).
- `D.comercial = { profundidades, malhas, condicoesPgto, pacotes, alcadas,
  validadePadraoDias, metodoPorServico }` — com **seeds sensatos**:
  - malhas 1 ponto / 1·2·3·5 ha (espelham `D.lab.gridHa`);
  - profundidades 0–20 (fator 1) · 0–10 (0,30) · 20–40 (0,20) (espelham
    `D.lab.pctColeta`);
  - condições À vista · 30 · 30/60 · 30/60/90;
  - alçadas vendedor 5% / gestor 15% / preço mínimo 0; validade 15 dias.
- Ambos entram no `hydrate` (default) e no `mergeImport` (preservados no
  re-import). Nada hardcodado na lógica — tudo cadastrável.

## Motor de cálculo — `QuoteCalc` (bloco puro `// <quote-calc>`)
Funções puras (sem depender de `D`), testáveis via `bun test`:
- `pontos(area, haPorPonto)` = round(área ÷ ha/ponto) — malha → pontos;
- `amostras(pontos, fatores)` / `amostrasTotal` — pontos → amostras por profundidade;
- `quantidade(metodo, ctx)` — quantidade cobrável por método (ha·ponto·amostra·fixo·pacote);
- `itemSubtotal`, `itemTotal` (desconto do item), `somaItens`, `totais`
  (desconto geral), `totalTabela`, `desvioPct` (negociado vs tabela);
- `parcelas(total, condParcelas, dataBase)` — **última parcela absorve o resíduo
  de centavos** (Σparcelas === total exato); `venc()` determinístico em UTC;
- `reconcilia(q)` — valida Σitens=subtotal, subtotal−desconto=total, Σparcelas=total.

## Cadastros comerciais (aba **Comercial** no hub)
Editores: **Malhas** e **Profundidades** (via `edTable`), **Condições de
pagamento** (parcelas "%/dias", validação de soma 100%), **Pacotes** (nome +
serviços por toque + desconto + descrição), **Alçadas & validade** (via `edForm`).
Todos gravam em `D.comercial` e salvam automático.

## Testes executados
- `bun test` → **138 pass / 0 fail** (11 novos testes do motor em
  `tests/quotes.test.ts`): malha→pontos, pontos→amostras, quantidade por método,
  subtotal/total, desvio, vencimentos (UTC), **parcelas sem erro de centavo**,
  reconciliação ponta-a-ponta, e caso área zero (sem NaN).
- Smoke headless (Chromium, tema escuro): seeds corretos; aba Comercial renderiza
  as 5 seções; criar condição "20/0, 40/30, 40/60" persiste; condição com soma ≠
  100% **bloqueada**; pacote "Completo AP" (2 serviços, 8%) salvo pela UI com o
  nome preservado entre toques. **0 erro de JS** (screenshot).

## Arquivos
- `index.html` (modificado): seeds no hydrate; preserve no mergeImport; bloco puro
  `QuoteCalc`; aba/pane Comercial; `renderComercialConfig` + editores + `cadTab`/
  `renderConfig`.
- `tests/quotes.test.ts` (novo).
- `docs/orcamentos/F2-RESULTADO-FUNDACAO.md` (este relatório).

## Riscos / rollback
- Risco baixo: adições isoladas; motor é puro; nenhuma tela/КPI existente mudou.
- Rollback: reverter o commit remove `D.quotes`/`D.comercial` (inócuos em `D`), o
  bloco `QuoteCalc`, os testes e a aba Comercial.

## Próxima fase
**Fase 3 — Orçamento Web (wizard + resumo sticky)**: Cliente → Área → Serviços →
Configuração → Pagamento → Resumo → Gerar, reusando cliente/fazenda/preço e o
`QuoteCalc`. (Aguardando ordem explícita.)
