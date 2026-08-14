# Operação AP — Fase 8: Kanban do pipeline

Quadro por etapa com cartões **arrastáveis** — terceira visão da tela **Projetos**
(Projetos · **Kanban** · Por cliente). Aditivo; nenhum cálculo/rota/dado existente
alterado. Reusa `D.projetos` e o motor da Fase 2.

## Objetivo realizado
Visualizar o pipeline como colunas (as etapas do workflow) e **mover** um projeto de
etapa arrastando o cartão — com **confirmação e auditoria**, nunca alterando o status
só visualmente.

## O quadro
- Uma **coluna por etapa** do workflow (com contagem no topo), rolagem horizontal
  dentro do próprio quadro (o documento **não** estoura).
- **Cartões** dos projetos **ativos** (cancelados/concluídos ficam fora do fluxo
  ativo): Cliente, Fazenda · Área, Serviços, **Responsável** da etapa, **SLA**
  (🟢🟡🔴 + dias na etapa), Número e botão **abrir** (vai à ficha/timeline).

## Mover = persistido + auditado (regra crítica atendida)
- Arrastar um cartão para outra coluna dispara uma **confirmação** ("Mover PRJ-… de
  X para Y?"). Só então `projMover` muda a etapa, **registra um evento** (origem
  `kanban`, com data/hora/usuário) e persiste via `commit()`.
- **Nada muda sem registro**: soltar na mesma coluna não faz nada; a lógica de
  conclusão/reabertura do `projMover` continua valendo; leitores (`somente-leitura`)
  não têm as ações de escrita.
- **Mobile**: como arrastar é impreciso em telas pequenas, o cartão tem **abrir** →
  a ficha do projeto move pela etapa (mesma persistência/auditoria).

## Reaproveitamento
Sem base nova: cartões de `D.projetos`, SLA/aging de `PipelineCalc`, `projMover`/
`projLog` da Fase 2, `projAbrir` da Fase 3. CSS novo só do quadro (`.kan-*`),
tema-aware.

## Testes executados
- `bun test` → **169 pass / 0 fail** (motor inalterado).
- Smoke headless (4 projetos, 1 cancelado): Kanban com **10 colunas** e **3 cartões**
  (cancelado excluído); o quadro **rola internamente** sem estourar o documento;
  **mover** PRJ-0002 de COLETA → PROCESSAMENTO registra evento (origem `kanban`,
  etapaPara PROCESSAMENTO) e persiste; **0 overflow** de documento em desktop e 390px;
  claro e escuro; **0 erro de JS** (screenshots).

## Arquivos
- `index.html`: toggle Kanban na tela Projetos; `projKanbanHTML`/`projKanCard` +
  drag/drop (`projDragStart`/`projDragOver`/`projDragLeave`/`projDrop`) e
  `projMoverKanban` (confirmação + `projMover` + `commit`); CSS `.kan-*`/`.kc-*`.
- `docs/operacao-ap/F8-RESULTADO-KANBAN.md` (este relatório).

## Riscos / rollback
- Risco baixo: só apresentação + movimentação já auditada (reusa `projMover`).
  Rollback: reverter o commit remove a visão Kanban; lista/timeline e dados seguem.

## Próxima fase
**Fase 9 — Regulagem e acompanhamento**: registrar a etapa de regulagem (data,
responsável, equipamento, talhão) e o acompanhamento pós-aplicação, fechando o ciclo
até a conclusão. (Aguardando ordem.)
