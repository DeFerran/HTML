# Operação AP — Fase 2: Workflow + eventos (fundação do pipeline)

Camada **aditiva** que dá ao processo de AP uma espinha: cada serviço vira um
**projeto** que percorre etapas configuráveis, e toda mudança vira **evento** com
data/hora/usuário. Nada existente foi alterado nos cálculos/rotas/dados; a UI vem
nas próximas fases.

## Workflow configurável por tipo de serviço (`D.pipelineCfg`)
- `pipelineCfg.tipos[]` — cada **tipo de serviço** tem sua lista de etapas. Semente
  padrão `wf_ap` "Agricultura de Precisão (padrão)" com 10 etapas:
  `PEDIDO → PLANEJAMENTO → COLETA → LABORATORIO → PROCESSAMENTO → MAPAS →
   APRESENTACAO → REGULAGEM → ACOMPANHAMENTO → CONCLUIDO`.
- Cada etapa: `{codigo, nome, slaDias, responsavelPadrao, checklist[]}`. **SLA não é
  hardcoded** — é um campo cadastrável por etapa (sementes sensatas: planejamento 3d,
  coleta 7d, lab 7d, processamento 3d, mapas 3d, apresentação 5d, regulagem 7d,
  acompanhamento 15d). `condicaoConclusaoCodigo` define qual etapa **encerra** o
  serviço (padrão `CONCLUIDO`) — serviços diferentes poderão concluir em etapas
  diferentes.
- `tipoPadraoId` aponta o workflow default. Tudo editável (a UI de edição virá numa
  fase futura; a estrutura já aceita novos tipos/etapas).

## Projeto (`D.projetos`) — 1 por serviço, consolida o que já existe
Criado na **conversão do orçamento** (estende `orcConverter`) — não duplica base:
guarda **referências** aos registros operacionais que já existiam.
```
{ id, numero:'PRJ-AAAA-NNNN', quoteId, clienteNome, fazenda, municipio, servicos[],
  vendedor, safra, areaHa, tipoWorkflowId, etapaAtual, status:'ativo|concluido|cancelado',
  responsaveis:{ <etapa>: nome }, refs:{ coletaIds[], remessaIds[], entregaId, funil },
  eventos:[…], criadoEm, concluidoEm }
```
- `orcConverter` agora cria **1 projeto** (idempotente: se o orçamento já tem projeto,
  não cria outro) e **carimba `projetoId`** nos lançamentos de coleta/amostras/entregas
  que ele gera — o vínculo passa a ser **por id**, não mais só pela `obs` textual.
  Registros antigos (sem `projetoId`) seguem válidos como avulsos.
- O projeto nasce em `PEDIDO` (evento `PEDIDO_CRIADO` datado com a **emissão do
  orçamento** — backfill) e avança para `PLANEJAMENTO` na conversão.

## Log de eventos (event sourcing leve) — `projeto.eventos[]`
Mesmo padrão do histórico de orçamentos (`qzLog`). Cada evento:
```
{ em, quem, tipo, etapaDe, etapaPara, responsavel, obs, origem }
```
- `em` (ISO), `quem` (email logado ou 'local'), `tipo` (ex.: `PEDIDO_CRIADO`,
  `ETAPA`, futuramente `LAB_ENVIADO`, `LAB_RESULTADO`…), `etapaDe`/`etapaPara`,
  `responsavel`, `obs`, `origem` (orcamento/manual/sistema/automação).
- **Timeline, tempos, lead time e aging são DERIVADOS dos eventos** — nunca campos
  redundantes que possam divergir.

### Helpers de runtime
- `projLog(p,ev)` — registra um evento (carimba em/quem automaticamente).
- `projMover(p,etapa,{responsavel,obs,origem,em})` — muda a etapa registrando o
  evento; ao chegar na etapa de conclusão marca `status='concluido'` + `concluidoEm`;
  ao sair dela (reabertura) volta a `ativo` e limpa `concluidoEm`.
- `pipeTipo/pipeEtapas/pipeEtapaNome/pipeSlaMap/pipeCondConclusao` — leitura da config.
- `projDoQuote/projPorId/projNumero` — utilidades.

## Motor puro `PipelineCalc` (testável, sem D/DOM)
Deriva dos eventos: `marcos` (1ª entrada em cada etapa), `temposEntreEtapas`,
`tempoEntreMarcos(de,para)`, `leadTime` (pedido→conclusão), `diasNaEtapa` (aging),
`slaStatus` (🟢 ≤80% · 🟡 ≤100% · 🔴 >100% · "sem" prazo) e `agg` (contagem por
etapa, WIP, backlog, concluídos/cancelados, atrasados, sem responsável). Unidade =
**dias de calendário** (igual aos exemplos do gestor).

## O que ainda NÃO tem (próximas fases)
UI de timeline, dashboard, kanban, mobile, SLA/gargalos visuais, automação por evento
real (ex.: `dataResultado` preenchida → avança etapa) e a tela de edição do workflow.
Esta fase entrega só a **fundação de dados + motor + testes**.
