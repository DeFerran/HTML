# Orçamentos — Fase 7: Proposta (documento para o cliente)

Geração da **proposta comercial** imprimível (HTML → PDF do navegador), com
separação inclusos/opcionais e observações cliente × internas. Aditivo — nenhum
cálculo/rota existente alterado; o documento não expõe nada interno.

## Objetivo realizado
1. **Proposta imprimível**: `window.print()` sobre um documento branco,
   profissional, com logo, número, cliente, escopo, preços, pagamento, validade e
   observações do cliente.
2. **Inclusos × Opcionais**: itens marcáveis; opcionais **não entram no total** e
   aparecem em seção separada (upsell sem poluir o preço principal).
3. **Obs cliente × obs internas**: nunca misturadas — só a do cliente vai à
   proposta.

## O documento (o que mostra / o que esconde)
- **Mostra**: logo (`logo-verde.png`, com fallback em texto — a logomarca não foi
  tocada), Nº ORC-AAAA-NNNN (vN), emissão/validade; cliente, fazenda, município,
  área, **responsável comercial**; **Serviços inclusos** (serviço + escopo técnico:
  malha, profundidades, ~amostras) + Subtotal/Desconto/Total; **Serviços
  opcionais** (fora do total); condição de pagamento + **cronograma de parcelas
  com vencimentos**; observações ao cliente; rodapé com o responsável.
- **NÃO mostra** (por design): custo, margem, preço mínimo, alçada/regras de
  aprovação, observações internas.

## Impressão sem servidor
- Sem lib de PDF nem popup: um **overlay** (`.orc-prop-overlay`) exibe a proposta;
  `@media print` esconde o resto do app e imprime só o documento
  (**"Imprimir / Salvar PDF"** usa o diálogo do navegador). Robusto ao CSP.

## Inclusos/opcionais e observações
- Toggle **Incluso ⇄ Opcional** por item na etapa Resumo; `qzRecalc` soma no total
  **apenas os inclusos** (subtotal/total/tabela).
- Campo **Observações internas** separado do **Observações para o cliente** na
  etapa Resumo (o interno nunca aparece na proposta).

## Onde acionar
- **Lista**: botão **proposta** por orçamento (registra "proposta gerada" no
  histórico).
- **Wizard (Resumo)**: botão **👁 Ver proposta** para pré-visualizar antes de
  gerar.

## Testes executados
- `bun test` → **143 pass / 0 fail** (motor inalterado).
- Smoke headless: 3 serviços (2 inclusos + Compactação **opcional**) → total
  **R$108.750** (opcional excluído); a proposta contém inclusos, opcionais,
  cliente, obs do cliente, cronograma 30/60/90 e responsável; **não vaza** obs
  interna nem custo/margem; overlay abre (`body.prop-open`). **0 erro de JS**
  (screenshot do documento).

## Arquivos
- `index.html`: CSS do documento/print; `qzItemEscopo`, `qzItemIncluso`,
  `qzPropostaHTML`, `orcProposta`, `orcPropostaFechar`; `qzRecalc` exclui
  opcionais; toggle incluso/opcional + obs interna + "Ver proposta" no Resumo;
  botão "proposta" na lista.
- `docs/orcamentos/F7-RESULTADO-PROPOSTA.md` (este relatório).

## Riscos / rollback
- Risco baixo: só leitura para montar o documento; nada é enviado a terceiros
  (a impressão é local no navegador). Rollback: reverter o commit remove a
  proposta e o toggle; orçamentos existentes seguem válidos.

## Pendência (refinamento futuro, opcional)
- **Descrição comercial cadastrável por serviço** (nome comercial/escopo padrão):
  hoje a proposta usa o escopo técnico (malha/profundidade) + a descrição opcional
  do item. Um cadastro de descrições por serviço pode entrar depois.

## Próxima fase
**Fase 8 — Lista + "Meus Orçamentos" + filtros**: recortes por período (hoje/
semana/mês), status, vendedor, cliente; cards no mobile; base para o dashboard
comercial (Fase 9). (Aguardando ordem explícita.)
