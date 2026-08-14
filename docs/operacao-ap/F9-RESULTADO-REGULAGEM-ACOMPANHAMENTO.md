# Operação AP — Fase 9: Regulagem e acompanhamento

Captura das duas etapas finais que ainda não tinham registro, na **ficha do projeto**
(Timeline), fechando o ciclo até a **conclusão** — que depende do acompanhamento, não
da apresentação. Aditivo; nenhum cálculo/rota/dado existente alterado.

## Objetivo realizado
Dois cartões novos no detalhe do projeto: **Regulagem** e **Acompanhamento**, com os
campos pedidos, mais botões que **avançam a etapa e concluem o serviço** (auditado).

## Regulagem
Aparece quando o projeto alcança Apresentação/Regulagem. Campos: **data programada**,
**data realizada**, **responsável**, **equipamento/máquina**, **talhão**,
**produto/insumo**, **observações**, **pendências**. Botão **✓ Regulagem realizada →
Acompanhamento**: grava a data (hoje, se vazia), registra o evento `REGULAGEM_OK`
(com responsável/talhão/equipamento) e avança o projeto para Acompanhamento.

## Acompanhamento
Aparece a partir da Regulagem. Campos: **aplicação realizada?** (Sim/Não),
**necessidade de retorno?** (Sim/Não), **data**, **arquivos utilizados**,
**problemas**, **observações**. Botão **✓ Concluir serviço**.

## Conclusão configurável (não é só a apresentação)
Conforme pedido, o serviço **não** conclui só porque a apresentação aconteceu:
- A conclusão acontece no **Acompanhamento**, via "Concluir serviço", que move o
  projeto para a **etapa de conclusão configurada** por tipo de serviço
  (`pipelineCfg.condicaoConclusaoCodigo`, padrão `CONCLUIDO`) e marca `concluidoEm`.
- O botão avisa explicitamente qual é a condição de conclusão do tipo de serviço.

## Persistência
Os dados ficam em `projeto.etapaDados.{REGULAGEM,ACOMPANHAMENTO}` (mapa aditivo por
projeto, salvo em cada `onchange` via `projSetDado`+`commit`; sem re-render, para não
perder o foco). Já viajam no snapshot e no `mergeImport` (projetos já preservados).
Registros antigos sem `etapaDados` funcionam (default vazio).

## Testes executados
- `bun test` → **169 pass / 0 fail** (motor inalterado).
- Smoke headless (projeto em Regulagem): detalhe mostra os cartões **Regulagem** e
  **Acompanhamento**; preencher equipamento/talhão e **Regulagem realizada** grava a
  data e avança para **Acompanhamento**; preencher **aplicação realizada** + arquivos
  e **Concluir serviço** leva a **CONCLUIDO** com `concluidoEm` e `etapaDados`
  gravados; **0 overflow** desktop e 390px; claro e escuro; **0 erro de JS**
  (screenshots).

## Arquivos
- `index.html`: `projDado`/`projSetDado`/`projAlcancou`/`projCampo`/`projCampoSel`;
  `projRegulagemFeita`/`projConcluir`; `projFasesFinaisHTML` inserido no detalhe do
  projeto (após a Timeline).
- `docs/operacao-ap/F9-RESULTADO-REGULAGEM-ACOMPANHAMENTO.md` (este relatório).

## Riscos / rollback
- Risco baixo: campos aditivos por projeto + avanço de etapa já auditado (`projMover`).
  Rollback: reverter o commit remove os cartões; projetos seguem no estado.

## Próxima fase
**Fase 10 — Alertas / automações + central de prioridades**: alertas (projeto parado,
SLA vencido, lab/interpolação/apresentação/regulagem/acompanhamento pendentes, sem
responsável) e uma central "Precisa da sua atenção" consolidada — fechando o módulo.
(Aguardando ordem.)
