# Orçamentos — Fase 3 (Web): resultado

Wizard Web de novo orçamento, com resumo sempre à vista. Aditivo — nenhum
cálculo, funil, financeiro ou rota existente foi alterado. Reaproveita clientes,
fazendas, serviços, preços e o motor `QuoteCalc` (Fase 2).

## Objetivo realizado
Gerar um orçamento em poucos passos, reusando tudo o que já existe:
**Cliente → Área → Serviços → Configuração → Pagamento → Resumo → Gerar**, com
**resumo sticky** (35%) ao lado do formulário (65%) no desktop.

## Onde vive
- Nova entrada **Orçamentos** no grupo **Comercial** da barra lateral + aba do
  topo; view `#v-orcamentos` (dispatch em `renderOrcamentosView`).

## Fluxo do wizard (reuso)
1. **Cliente** — select de `nomesClientes()`; ao escolher, **auto-preenche**
   vendedor (`cliente.vendedor`) e município; lista as **fazendas do cliente**
   (`D.fazendas`) como chips; fazenda única já traz a área.
2. **Área** — "Fazenda inteira · X ha" (de `fazenda.areaHa`) ou digitar; mostra
   área total.
3. **Serviços** — **cards grandes** do catálogo (`funilServicoLista()`) com
   "a partir de R$ X/ha" (preço real via `precoServ`), e **pacotes**
   (`D.comercial.pacotes`) que adicionam vários serviços de uma vez.
4. **Configuração** — para serviços de amostragem: **malha** e **profundidades**
   por chips grandes; calcula pontos e amostras (`QuoteCalc.pontos/amostrasTotal`).
5. **Pagamento** — condição por chips (`D.comercial.condicoesPgto`) + validade;
   mostra o **cronograma de parcelas** com valores e vencimentos.
6. **Resumo** — quebra por item, subtotal, total, pagamento, validade, observações
   para o cliente; botão **Gerar orçamento**.

## Preço e escopo (separados, como pedido)
- **Preço comercial**: por hectare, da tabela vigente (`precoServ`) — o vendedor
  não digita preço. `QuoteCalc` calcula subtotal/total.
- **Escopo técnico**: malha + profundidades geram pontos/amostras estimadas
  (mostrados no item), que alimentarão a conversão operacional (Fase 10) e a
  proposta (Fase 7). Não alteram o preço por-ha.

## Rascunho e número
- **Rascunho auto-salvo** em `D.quotes` a cada passo/edição (reusa a persistência
  local + snapshot). Número sequencial **ORC-AAAA-NNNN**.
- "Gerar" só conclui após **reconciliação** (`QuoteCalc.reconcilia`) passar.

## Testes executados
- `bun test` → **138 pass / 0 fail** (motor já coberto na Fase 2).
- Smoke headless (Chromium, tema escuro): wizard completo com dados reais —
  cliente auto-preenche vendedor/município/área (fazenda única 1.250 ha);
  Grid 3 (R$75/ha×1250 = R$93.750) + Mapa (R$12/ha×1250 = R$15.000) = **R$108.750**;
  malha 1pt/1ha → 1.250 pontos/amostras; reconciliação OK; salvo como
  **ORC-2026-0001**. Mobile 390px: wizard **empilha em 1 coluna, sem scroll
  horizontal**. **0 erro de JS** (screenshots desktop + mobile).

## Arquivos
- `index.html`: nav/tab/view Orçamentos; CSS do wizard (stepper, cards, chips,
  grid sticky); dispatch em troca de aba; motor de UI `renderOrcamentosView`/
  `renderOrcWizard`/`qzStepHTML` + estado `_qz`, recálculo, rascunho, número,
  gerar; helpers de bridge (`qtPrecoTabela`, `qtMalhaHaPorPonto`, etc.).
- `docs/orcamentos/F3-RESULTADO-WEB.md` (este relatório).

## Riscos / rollback
- Risco baixo: view nova e isolada; usa só leitura dos cadastros e o `QuoteCalc`
  puro. Rollback: reverter o commit remove a view/CSS/JS; `D.quotes` fica inócuo.

## Pendências desta fase (deliberadas — vêm nas próximas)
- **Desconto + alçada + preço mínimo + aprovação** → Fase 5.
- **Versionamento/histórico/duplicar** → Fase 6.
- **Proposta (PDF/print), inclusos/opcionais, obs interna** → Fase 7.
- **Lista rica / "Meus Orçamentos" / filtros** → Fase 8 (Fase 3 já traz uma lista
  simples).
- **Refino mobile (stepper 1-etapa/tela, barra inferior)** → Fase 4.

## Próxima fase
**Fase 4 — Mobile**: transformar o wizard em stepper foco-total (uma etapa por
tela, botões maiores, total fixo no rodapé, proteção anti-duplo-envio). O núcleo
já é responsivo; a Fase 4 aprimora a ergonomia do vendedor no celular.
