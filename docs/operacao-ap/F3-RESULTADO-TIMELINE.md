# Operação AP — Fase 3: Timeline por projeto + visão do cliente

Primeira UI do pipeline: uma tela **Projetos** que lista os projetos, mostra a
**linha do tempo** de cada um (datas, responsáveis, tempos e atrasos derivados dos
eventos) e uma visão **por cliente**. Aditivo — nenhum cálculo/rota/dado existente
alterado; usa o modelo e o motor da Fase 2.

## Objetivo realizado
- **Tela Projetos** (nav "Projetos (Pipeline)" + aba "Projetos", view `#v-projetos`).
- **Linha do tempo por projeto**: cada etapa do workflow com estado (✓ concluída ·
  ● atual · ○ futura), **data de entrada**, **responsável** e **tempo** (aging na
  etapa atual), tudo **derivado dos eventos** (nada redundante).
- **Visão completa do cliente**: alternância **Projetos ⇄ Por cliente** — por cliente,
  cada projeto com etapa atual, % concluído, responsável, **próxima etapa** e SLA.

## Lista de projetos
- **KPIs**: ativos (+concluídos), atrasados (SLA), backlog (pedido/planejamento),
  sem responsável na etapa — via `PipelineCalc.agg`.
- **Filtros**: status · cliente · etapa · busca. Tabela (cards no mobile via
  `resp-cards`): Número, Cliente, Fazenda, Serviços, **Etapa atual** (badge),
  **Progresso** (barra %), Responsável, **SLA** (🟢🟡🔴 + dias), **Lead time**.
- Estado vazio explica que projetos nascem ao **converter um orçamento aceito**.

## Detalhe do projeto
- **Cabeçalho**: cliente, fazenda, município, área, vendedor, safra, serviços, status.
- **Resumo**: etapa atual, progresso %, **SLA da etapa** (dias/prazo + atraso),
  **lead time** (pedido→conclusão/agora), **próxima etapa**.
- **Linha do tempo** (as 10 etapas do workflow).
- **Tempo entre etapas** (durações consecutivas dos marcos).
- **Histórico de eventos** (cronológico reverso: tipo, de→para, responsável, obs,
  data/hora, usuário, origem).

## Movimentação — controlada e auditada
Conforme a regra do projeto ("toda mudança persistida e auditada; nada crítico muda
sem validação"):
- **✓ Avançar** para a próxima etapa · **mover** para qualquer etapa (select) ·
  **salvar responsável** da etapa · **cancelar/reabrir** projeto.
- Toda ação pede **confirmação**, chama `projMover`/`projLog` (registra evento com
  data/hora/usuário) e persiste via `commit()`. Não há arraste que altere status
  sem registro. Leitores (`somente-leitura`) não veem os botões (CSS existente).
- Chegar na etapa de conclusão marca `concluido`+`concluidoEm`; sair dela (reabertura)
  volta a `ativo`.

## Reaproveitamento (sem duplicar)
Cliente/fazenda/serviços vêm do próprio projeto (originado do orçamento); tempos,
aging, SLA e lead time vêm de `PipelineCalc`; badges/KPIs/`resp-cards`/filtros
reusam classes existentes. Novas classes CSS `.pl-*` (timeline/cards) tema-aware.

## Testes executados
- `bun test` → **161 pass / 0 fail** (motor inalterado; sem novo bloco puro).
- Smoke headless (2 projetos com eventos em etapas distintas): lista com KPIs e SLA
  corretos; detalhe com 10 etapas (3 concluídas, 1 atual, 3 tempos entre etapas);
  **avançar** LABORATORIO→PROCESSAMENTO registra evento; visão **por cliente**;
  **0 overflow** em desktop e 390px; tema claro e escuro; **0 erro de JS**
  (screenshots lista/detalhe/por-cliente).

## Arquivos
- `index.html`: nav + aba + view `#v-projetos`; dispatch; `renderProjetosView`/
  `renderProjLista`/`projListaHTML`/`projClienteHTML`/`renderProjetoDetalhe`/
  `projEventosHTML` + helpers (`projProgresso`, `projSla`, `projLead`,
  `projProxEtapa`, `projRespEtapa`…) + ações (`projAvancar`, `projMoverUI`,
  `projSetResp`, `projCancelar`, `projReabrir`); CSS `.pl-*`.
- `docs/operacao-ap/F3-RESULTADO-TIMELINE.md` (este relatório).

## Riscos / rollback
- Risco baixo: view de leitura + ações auditadas sobre `D.projetos` (Fase 2). Não
  toca cálculos/rotas/dados existentes. Rollback: reverter o commit remove a tela;
  os projetos seguem no estado.

## Pendências / próxima fase
- **Fase 4 — Produção diária por colaborador**: evoluir `opColeta` para pontos/ha por
  dia/semana/mês/safra, por colaborador e por equipe, com drill-down (aguardando ordem).
