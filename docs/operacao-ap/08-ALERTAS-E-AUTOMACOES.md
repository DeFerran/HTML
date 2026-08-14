# Operação AP — Fase 10: Alertas + automações + central de prioridades

Fecha o módulo. Uma **central "Precisa da sua atenção"** priorizada no Painel
Operacional + a primeira **automação por evento real** (resultado do laboratório →
interpolação). Aditivo; nenhum cálculo/rota/dado existente alterado.

## Central de prioridades (Painel Operacional)
A seção "Precisa da sua atenção" foi ampliada com o motor `PipelineCalc.alertas`:
- **Chips agrupados por severidade e quantidade**: 🔴 Atrasado (SLA) · 🔴 Parado ·
  🟡 Aguardando processamento · 🟡 Aguardando apresentação · 🟡 Aguardando regulagem ·
  🟡 Acompanhamento vencido · 🟡 Sem responsável — mais um **Todos**. Clicar num chip
  **filtra** a lista.
- **Lista priorizada** (mais crítico primeiro; deduplicada por projeto quando "Todos"):
  projeto, cliente, etapa, situação (🔴/🟡), tempo (dias/SLA) e **abrir**.

## Alertas cobertos
- **Projeto parado** (aging > 2× SLA, mín. 14d) · **SLA vencido** (etapa acima do
  prazo) · **sem responsável** na etapa · **aguardando** processamento/apresentação/
  regulagem · **acompanhamento vencido**. Coleta/laboratório atrasados aparecem como
  "atrasado (SLA)" da etapa correspondente.

## Automação por evento real
- **Resultado do laboratório recebido → Interpolação.** Ao salvar uma remessa (Envio
  de Amostras) com **data de resultado** preenchida, se ela estiver vinculada a um
  projeto (`projetoId`), o projeto **avança sozinho** de Laboratório para
  **Interpolação / processamento**, com evento `origem: automacao` — "sem depender de
  alguém mudar o status manualmente quando o sistema já conhece o evento".
- Só avança **para frente** (nunca regride) e uma vez (idempotente: só quando a data
  de resultado passa de vazia para preenchida). As demais pontes já existiam: **Modo
  Campo** avança para Coleta ao iniciar e para Laboratório ao finalizar (Fase 7).

## Motor puro (testado)
`PipelineCalc.alertas(projetos,{slaPorEtapa,nowISO})` → lista priorizada de
`{tipo,nivel,projetoId,etapa,dias,sla,prio}`, ignorando cancelados/concluídos.

## Testes executados
- `bun test` → **171 pass / 0 fail** (2 novos: `alertas` gera/prioriza/ignora
  cancelado; lista vazia quando nada pendente).
- Smoke headless (3 projetos: 1 atrasado no lab sem resp, 1 em apresentação, 1 em
  regulagem; + 1 remessa vinculada): central com chips **Todos 5 · 🔴 Atrasado 1 ·
  🔴 Parado 1 · 🟡 Aguardando regulagem 1 · 🟡 Aguardando apresentação 1 · 🟡 Sem
  responsável 1**; lista priorizada (3, atrasado primeiro); filtro por chip funciona;
  **automação**: preencher data de resultado da remessa → projeto **Laboratório →
  Interpolação** (evento `automacao`); **0 overflow** desktop e 390px; claro e escuro;
  **0 erro de JS** (screenshots).

## Arquivos
- `index.html`: `PipelineCalc.alertas`; `painelCentralHTML`/`painelSetAlerta` +
  `ALERTA_LBL` (substitui a antiga seção de atenção do Painel);
  `opAmAutomacaoResultado` (hook em `opAmSalvar`); CSS `.alz-*`.
- `tests/pipeline.test.ts`: +2 testes.
- `docs/operacao-ap/08-ALERTAS-E-AUTOMACOES.md` (este relatório).

## Riscos / rollback
- Risco baixo: leitura/agrupamento + uma automação que só avança etapa (auditada).
  Rollback: reverter o commit volta à seção de atenção simples e remove a automação;
  dados intactos.
