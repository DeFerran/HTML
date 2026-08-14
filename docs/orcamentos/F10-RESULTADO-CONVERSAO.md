# Orçamentos — Fase 10: Conversão → projeto operacional (fecha o módulo)

Ao **aceitar**, o orçamento vira a base do projeto operacional — sem redigitar.
Aditivo — nenhum cálculo/rota existente alterado; **receita não é lançada
automaticamente**.

## Objetivo realizado
"O vendedor vende X e a operação recebe o mesmo X": um botão **Converter** em
orçamentos aceitos que **pré-preenche** os módulos operacionais com os dados do
orçamento e registra a venda no funil existente (sem duplicar).

## O que a conversão cria (com cliente/fazenda/área/serviços do orçamento)
- **Coleta de Pontos** (`D.opColeta.lancamentos`): cliente, fazenda, **fator
  (ha/ponto) da malha escolhida**, status `planejada`, obs "Orçamento ORC-…".
  (Só quando há serviço de amostragem.)
- **Envio de Amostras** (`D.opAmostras.remessas`): fazenda(s) e **volume = amostras
  estimadas** do orçamento. (Só quando há amostragem.)
- **Controle de Entregas** (`D.opEntregas.linhas`): cliente, fazenda, área, e os
  **itens pré-marcados `pendente`** conforme os serviços (mapa→mapas,
  análise/fertilidade→propriedades químicas).
- **Funil** (`D.funil`, estágio "Fechado") — **só para safras não-base**, onde
  projeta sem duplicar. Na **safra-base**, a conversão **não** cria linha de funil
  (a carteira já governa a safra-base; `funilOps` ignoraria manual "Fechado" para
  evitar dupla contagem) — verificado no smoke (funil ficou 0 na base).

## Integração / segurança
- **Não cria segundo funil**: usa o `D.funil` existente; respeita a lógica de
  `funilOps` (anti-dupla-contagem na safra-base).
- **Não lança receita**: a conversão é o **handoff operacional**; a receita segue
  a regra existente (carteira/safra). Cada lançamento operacional carrega
  "Orçamento ORC-…" na observação (rastreabilidade).
- **Idempotência**: se já convertido, avisa antes de converter de novo; a lista
  mostra **✓ convertido** e esconde o botão Converter.
- Confirmação prévia lista tudo o que será criado.

## Fluxo completo (fechado)
**Orçamento → Aprovação → Aceite → Conversão → Projeto AP (Coleta → Lab/Amostras →
Entrega)** — usando os mesmos dados desde a origem.

## Testes executados
- `bun test` → **143 pass / 0 fail** (motor inalterado).
- Smoke headless: converter orçamento aceito 26/27 → cria opColeta (fator da
  malha, status planejada), opAmostras (volume 1250 amostras), opEntregas (área +
  itens propQuimicas/mapas), **funil não aumenta** (base); converter 27/28 → cria
  **1** oportunidade "Fechado" no funil (R$40k). Status→convertido, badge
  ✓ convertido, botão some. **0 erro de JS**.

## Arquivos
- `index.html`: `orcConverter(id)` (seed operacional + funil não-base + status
  convertido + log); botão **converter** / badge **✓ convertido** na lista.
- `docs/orcamentos/F10-RESULTADO-CONVERSAO.md` (este relatório).

## Riscos / rollback
- Risco baixo: só cria lançamentos operacionais e, fora da base, uma linha de
  funil; nenhuma receita é lançada. Rollback: reverter o commit remove o botão e
  `orcConverter`; dados existentes intactos.

---

## Módulo de Orçamentos — concluído (Fases 1–10)
Auditoria + arquitetura · motor de preços `QuoteCalc` (testado) · cadastros
comerciais · wizard Web + Mobile · desconto/alçada/aprovação · versionamento/
histórico/duplicar · proposta imprimível · lista/filtros/Meus Orçamentos ·
painel comercial · e agora a **conversão** para o operacional. O ciclo comercial
está completo e integrado à plataforma existente, reaproveitando clientes,
fazendas, serviços, preços, funil e módulos operacionais — sem duplicar base nem
lançar receita antes da regra real.
