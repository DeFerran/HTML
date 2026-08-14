# Operação AP — Testes

Cobertura de testes do módulo operacional de AP. Rodar: `bun test`.

## Estado atual
**171 pass / 0 fail** (17 arquivos). Além da suíte existente (orçamentos, coleta,
etc.), o pipeline tem cobertura pura e determinística.

## `tests/pipeline.test.ts` — motor `PipelineCalc` (bloco puro `// <pipeline-calc>`)
- **Datas/dias**: `diasEntre` em dias de calendário; datas iguais = 0; inválida = null.
- **Marcos**: 1ª entrada em cada etapa; etapa pulada é ignorada; evento duplicado
  mantém a 1ª; eventos fora de ordem são ordenados por `em`.
- **Tempos**: `tempoEntreMarcos` (pedido→coleta, coleta→lab, …); `temposEntreEtapas`
  (durações consecutivas); `leadTime` (pedido→conclusão e em aberto).
- **Aging/SLA**: `diasNaEtapa`; `slaStatus` verde/amarelo/vermelho/sem; SLA vencido.
- **Agregação**: `agg` (por etapa, WIP, backlog, concluídos, cancelados, atrasados,
  sem responsável); cancelado fora de WIP/etapa.
- **Gargalos/tempo médio**: `gargalos` (fila, tempo médio/máx, atrasados, sem resp);
  `duracoesEtapa`+`mediaPorEtapa` com filtro por mês de saída.
- **Alertas**: `alertas` gera/prioriza (atrasado/parado/sem-resp/aguardando), ignora
  cancelado, ordena por prioridade; lista vazia quando nada pendente.
- **Casos de borda pedidos**: datas iguais, etapa pulada, evento duplicado, projeto
  cancelado, reabertura, sem responsável, SLA vencido.

## `tests/opcoleta.test.ts` — `OpColetaCalc` (produção/produtividade)
- `totalDia`, `agg` (total/dias/média + produtividade por colaborador), `filtra`,
  `gruposPorMes`, `mesLabel`, `statusInfo`, `hectares`.
- Fase 4: `porColaborador` (pontos/dias/ha/médias), `porEquipe`, `serieMensal`,
  `historicoColab`, `resumoColeta`; ha null sem fator.

## Verificação headless (smoke) por fase
Cada fase foi validada com Playwright + Chromium (bibliotecas de gráfico reais),
medindo **erros de JS** e **overflow horizontal** em desktop e 390px, tema claro e
escuro — todas com **0 erro** e **0 overflow**:
- F2 conversão cria projeto vinculado + idempotência + `projMover`.
- F3 lista/timeline/por-cliente + avançar etapa.
- F4 produtividade (números conferidos) + drill-down.
- F5 painel (KPIs + pipeline clicável).
- F6 gargalos + tempo médio mês×mês + edição de SLA.
- F7 Modo Campo (iniciar→pontos→problema→finalizar + pontes de pipeline).
- F8 Kanban (10 colunas, mover auditado, sem overflow de documento).
- F9 regulagem→acompanhamento→concluído.
- F10 central de prioridades (chips/lista/filtro) + automação lab→interpolação.

## Cross-tenant / multi-tenant
O estado `D` é por usuário (`painel_estado` com `user_id` + `empresa` "DF AGRO") com
RBAC por `membros` (admin/editor/leitor). O pipeline não altera esse modelo; herda o
mesmo isolamento por usuário e as permissões existentes (leitores não veem ações de
escrita).
