# Orçamentos — Fase 6: Versionamento + histórico + duplicar

Rastreabilidade e negociação sem perder o passado. Aditivo — nenhum
cálculo/funil/financeiro existente alterado.

## Objetivo realizado
1. **Versionamento**: editar um orçamento já enviado/aprovado cria a **v+1** sem
   sobrescrever a versão anterior.
2. **Histórico**: linha do tempo de eventos (criado, gerado, aprovações,
   devolução, nova versão, duplicado) com quem e quando.
3. **Duplicar**: nova proposta a partir de uma existente, **repuxando o preço
   vigente** e avisando quando muda.

## Versionamento (não sobrescrever a versão enviada)
- Cada orçamento tem `versao`, `versaoDe` (predecessor) e `substituidoPor`.
- **Abrir** um orçamento que **não é rascunho** (enviado/negociação/aprovado/…)
  pergunta e cria **v+1** (`orcNovaVersao`): a versão anterior é **preservada
  intacta** (status e histórico), apenas marcada `substituidoPor`; a nova nasce
  `rascunho` e editável, com o mesmo número.
- A **lista mostra só a versão-cabeça** de cada número (as substituídas ficam
  guardadas, nunca apagadas); badge **vN** quando `versao>1`.
- Rascunho/devolvido continuam editando direto (sem criar versão).

## Histórico
- `qzLog(q,acao,detalhe)` registra em `q.historico[]` (em/quem/ação/detalhe).
- Eventos logados: **criado · gerado · enviado para aprovação · aprovado ·
  devolvido · recusado · nova versão · duplicado**.
- Timeline visível na lista por um botão **histórico** (expande em linha),
  mais recente no topo; o histórico **é carregado para a nova versão**, então a
  v2 mostra também o que aconteceu na v1.

## Duplicar
- `orcDuplicar` cria um **novo número** (v1, rascunho), copia cliente/fazenda/
  área/serviços/config/pagamento e **recalcula com a tabela vigente**
  (`qtPrecoTabela`/`qzRecalc`).
- Se algum preço mudou vs a origem, avisa: *"Preços atualizados para a tabela
  vigente"* (e registra no histórico) — **nunca reutiliza preço antigo em
  silêncio**.

## Testes executados
- `bun test` → **143 pass / 0 fail** (motor inalterado).
- Smoke headless (tema escuro):
  - gerar → histórico [criado, gerado];
  - versão a partir de um "enviado" → original **preservado** (status intacto,
    `substituidoPor` setado), v2 rascunho mesmo número, lista mostra só a cabeça
    (1 de 2 guardados);
  - duplicar após mudar o preço da tabela (75→90) → novo número, item **repreçado
    para 90**, origem mantém 75, histórico "duplicado · preços atualizados";
  - timeline renderiza. **0 erro de JS** (screenshot da lista com v2 + histórico).

## Arquivos
- `index.html`: campos `versao/versaoDe/substituidoPor/historico` no `orcNovo`;
  `qzLog`, `qzHistHTML`, `qzDataHora`, `qzEditavel`; `orcNovaVersao`,
  `orcDuplicar`, `orcToggleHist`; guarda em `orcAbrir`; logging em `qzGerar` e nas
  aprovações; lista filtra cabeças + badge de versão + histórico inline.
- `docs/orcamentos/F6-RESULTADO-VERSAO-HISTORICO.md` (este relatório).

## Riscos / rollback
- Risco baixo: versões antigas são preservadas (nunca sobrescritas/apagadas
  silenciosamente). Rollback: reverter o commit; orçamentos existentes seguem
  válidos (campos de versão/histórico ficam inócuos).

## Próxima fase
**Fase 7 — Proposta**: gerar a proposta (HTML imprimível → PDF do navegador) com
logo, número, cliente, escopo, preços, condição, validade e observações do
cliente; **inclusos/opcionais**; separando **obs para o cliente × obs internas**;
sem mostrar custo/margem/regras internas. (Aguardando ordem explícita.)
