# Orçamentos — Fase 5: Desconto + alçada + preço mínimo + aprovação

Camada comercial de desconto e a governança de aprovação. Aditivo — nenhum
cálculo/funil/financeiro existente foi alterado; reusa `QuoteCalc`, a tabela de
preços e os papéis de acesso.

## Objetivo realizado
1. **Desconto** no orçamento com preço-tabela × preço-negociado.
2. **Alçada por papel** e **preço mínimo** configuráveis.
3. **Fluxo de aprovação**: acima da alçada/abaixo do mínimo → **Aguardando
   aprovação**; o gestor aprova, devolve ou recusa.
4. **Margem** visível só para quem tem permissão.

## Motor (puro, testado)
- `QuoteCalc.descontoEfetivoPct(total,totTab)` — desconto real vs tabela.
- `QuoteCalc.aprovacaoNecessaria(descPct,alcadaMax,total,totTab,precoMinPct)` →
  `{exigida,motivos[]}` — exige aprovação se o desconto passa da alçada **ou** o
  total fica abaixo do preço mínimo. 5 testes novos (dentro/fora da alçada,
  abaixo do mínimo, dois motivos).

## Papéis (modelo real)
- **Gestor** = admin (ou dono local, não-membro): alçada `gestorMaxDescPct`, **vê
  margem**, **aprova**.
- **Vendedor** = editor logado: alçada `vendedorMaxDescPct`, **não vê custo/
  margem**.
- Tudo vem de `D.comercial.alcadas` (configurável na aba Comercial).

## UI
- **Etapa Resumo**: campo **Desconto geral (%)**; mostra **Preço de tabela →
  Desconto (%) → Total negociado**; **aviso âmbar** quando exige aprovação; bloco
  de **Custo/Margem** só para gestor; o botão vira **"Enviar para aprovação"**
  quando aplicável.
- **Lista**: seção **⏳ Aprovações comerciais** (só para gestor) com número,
  cliente, vendedor, total, desconto, **margem** (gestor) e o motivo, com botões
  **Aprovar · Devolver · Rejeitar**.

## Fluxo de status
- Gerar dentro da alçada → `rascunho`.
- Gerar fora da alçada/abaixo do mínimo → `aguardando_aprovacao` (grava
  `aprovacao.motivo`, quem solicitou e quando).
- **Aprovar** → `aprovado`; **Devolver** → `rascunho` (+ motivo, p/ o vendedor
  ajustar); **Rejeitar** → `recusado`. Cada ação registra `por`/`em`.

## Testes executados
- `bun test` → **143 pass / 0 fail** (5 novos do motor de aprovação).
- Smoke headless (tema escuro): alçada gestor 15% —
  - desconto 10% → `rascunho` (sem aprovação); desconto 25% →
    `aguardando_aprovacao` com motivo "Desconto de 25% acima da sua alçada
    (15%)"; margem calculada e exibida (gestor); painel de aprovações visível;
    **Aprovar → `aprovado` (por: gestor)**. **0 erro de JS** (screenshot do
    resumo com desconto 22%, aviso e margem).

## Arquivos
- `index.html`: `QuoteCalc.descontoEfetivoPct/aprovacaoNecessaria`; helpers de
  papel/margem/alçada; desconto + aviso + margem no Resumo; `qzGerar` decide o
  status; `orcAprovar/orcDevolver/orcRejeitar` + seção de aprovações na lista.
- `tests/quotes.test.ts`: +5 testes.
- `docs/orcamentos/F5-RESULTADO-DESCONTO-APROVACAO.md` (este relatório).

## Riscos / rollback
- Risco baixo: reusa o motor puro e a tabela de preços; margem só leitura.
- Rollback: reverter o commit remove desconto/alçada/aprovação; os orçamentos
  existentes seguem válidos (campos novos ficam inócuos).

## Próxima fase
**Fase 6 — Versionamento + histórico + duplicar**: versão do orçamento na
negociação (V1→V2 sem sobrescrever), histórico de alterações/status, e a ação
**Duplicar** (repuxando o preço vigente com aviso). (Aguardando ordem explícita.)
