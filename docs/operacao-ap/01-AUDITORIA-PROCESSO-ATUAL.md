# Operação AP — Fase 1: Auditoria do processo atual (sem alterar código)

Diagnóstico do que a plataforma **já tem** para controlar o processo ponta a ponta
de Agricultura de Precisão, o que **falta**, e o que pode ser **reaproveitado** —
antes de qualquer implementação. Nenhum código foi alterado nesta fase.

Base analisada: `index.html` (~7.725 linhas), estado global único `D`, persistência
`localStorage` + snapshot Supabase `painel_estado` (`user_id` + `empresa` fixa
"DF AGRO"), RBAC por tabela `membros` (admin/editor/leitor), motores de cálculo
puros e testáveis (`OpColetaCalc`, `OpAmostrasCalc`, `OpEntregasCalc`, `QuoteCalc`).

---

## 1. Mapa do processo desejado × o que existe hoje

| # | Etapa desejada | Existe? | Onde / como | Datas capturadas |
|---|---|---|---|---|
| 01 | **Pedido / serviço contratado** | ✅ Maduro | `D.quotes` (Orçamentos) | `emitidoEm`, `criadoEm`, `convertidoEm` |
| 02 | **Planejamento** | ⚠️ Implícito | status `planejada` na coleta; sem etapa própria | — |
| 03 | **Aguardando coleta** | ⚠️ Parcial | coleta `status='planejada'` | **sem** data programada |
| 04 | **Coleta em andamento** | ✅ | `D.opColeta.lancamentos` (`status='andamento'`) | `data` (1 dia, sem hora) |
| 05 | **Coleta concluída** | ⚠️ Parcial | `status='finalizada'` | `data`, **sem** início/fim |
| 06 | **Aguardando laboratório** | ✅ | `D.opAmostras.remessas` | `dataEnvio` |
| 07 | **Em análise laboratorial** | ⚠️ Parcial | situação `aguardando` (derivada) | **sem** data de recebimento no lab |
| 08 | **Resultado recebido** | ✅ | situação `recebido` | `dataResultado` |
| 09 | **Aguardando processamento** | ❌ | não existe | — |
| 10 | **Interpolação / processamento** | ❌ | não existe | — |
| 11 | **Mapas / diagnóstico / recomendação** | ⚠️ Parcial | `D.opEntregas` (checklist de itens: mapas, prop. químicas, calcário, P, K, MIB) | **NENHUMA data** |
| 12 | **Aguardando apresentação** | ❌ | não existe | — |
| 13 | **Apresentado ao cliente** | ❌ | não existe | — |
| 14 | **Aguardando regulagem** | ❌ | não existe | — |
| 15 | **Regulagem realizada** | ❌ | não existe | — |
| 16 | **Acompanhamento** | ❌ | não existe | — |
| 17 | **Concluído** | ❌ | não há conclusão formal do serviço (quote "convertido" ≠ serviço concluído) | — |

**Cobertura real hoje:** Pedido → Coleta → Amostras/Lab → Entregas (checklist).
Faltam, como etapas de primeira classe: planejamento, processamento/interpolação,
apresentação, regulagem, acompanhamento e conclusão.

---

## 2. Respostas diretas às 17 perguntas da Fase 0

1. **Pontos por colaborador por dia?** ⚠️ **Dados sim, visão não.** Cada lançamento
   de coleta tem `data` + `colaboradores:[{nome,pontos}]`. A agregação
   (`OpColetaCalc.agg`) já dá **pontos, dias e média por colaborador** no período
   filtrado — mas não há série "por dia" nem quebra por colaborador.
2. **Dia / semana / mês / safra?** ⚠️ **Parcial.** Coleta e Amostras têm filtro
   **De/Até**; Coleta agrupa por **mês**. **Não há** atalhos hoje/semana/safra, e a
   safra global **não afeta** os módulos operacionais. Entregas não tem filtro de data.
3. **Hectares por colaborador/equipe?** ❌ **Não.** Hectares só no total
   (Σ pontos × fator do lançamento). Sem rateio por pessoa nem por equipe.
4. **Timestamps de cada etapa?** ⚠️ **Muito incompleto** — ver tabela §1. Temos:
   pedido criado, amostras enviadas, resultado recebido, e (parcial) dia da coleta.
   **Faltam:** coleta programada, início/fim da coleta, recebimento no lab,
   interpolação, relatório pronto, apresentação, regulagem, acompanhamento, conclusão.
5. **Tempo entre etapas?** ❌ **Quase não.** Só dá para calcular
   `dataResultado − dataEnvio` (lab) e pedido → conversão. O resto falta timestamp.
6. **Identificar gargalos?** ❌ **Não** (sem etapas/tempos). Há só um detector de
   "amostras atrasadas" da IA.
7. **Responsável por etapa?** ⚠️ **Quase não.** Só `respEnvio` (amostras) e
   `vendedor` (orçamento). Sem responsável de planejamento/interpolação/apresentação/
   regulagem.
8. **Serviços atrasados?** ⚠️ **Só amostras** (`prazoDias` → situação `atrasado`).
9. **Produtividade individual?** ✅ **Parcial** — pontos/dias/média por colaborador
   (coleta). Faltam ha, horas, semana/safra.
10. **Produtividade por equipe?** ❌ **Não** (o campo `equipe` só filtra).
11. **Produtividade por cliente/fazenda?** ⚠️ **Parcial** (dá para filtrar coleta,
    mas `fazenda` é texto livre → agregação não confiável; sem visão consolidada).
12. **Processo completo de um cliente?** ❌ **Não.** Os módulos são isolados;
    não há tela que una pedido→coleta→lab→entrega de um cliente.
13. **Histórico/auditoria de mudança de status?** ⚠️ **Só orçamentos**
    (`q.historico` via `qzLog`: `{em, quem, acao, detalhe}`). Coleta/Amostras/Entregas
    sobrescrevem com `Object.assign`, **sem** histórico.
14. **Metas/SLA por etapa?** ⚠️ **Quase não** — só `prazoDias` (amostras). Sem SLA
    configurável por etapa.
15. **Alertas?** ⚠️ **Fraco** — detector IA de amostras atrasadas + relatório de
    pendências. Sem central de alertas.
16. **Dashboard gerencial?** ⚠️ **Parcial** — "Ciclo Operacional" (`renderOpResumo`)
    consolida os 3 módulos em leitura; há dashboards financeiro/comercial. Sem
    pipeline/gargalos/aging operacional.
17. **Mobile para campo?** ❌ **Não.** Só dashboard responsivo (drawer, `resp-cards`).
    Sem tela de operador (minhas atividades, iniciar/finalizar coleta, botões grandes).

---

## 3. O que já existe e é sólido (REAPROVEITAR — não duplicar)

- **Pedido** = `D.quotes` (maduro): 10 status, versionamento, aprovação por alçada,
  `emitidoEm`/`criadoEm`/`convertidoEm`, e **histórico/auditoria por orçamento**
  (`qzLog` → `{em,quem,acao,detalhe}`). **Este é o padrão de event-log a reutilizar.**
- **Handoff** = `orcConverter(id)`: já cria coleta + amostras + entregas + funil a
  partir do orçamento aceito. É o **ponto de origem do "projeto"**.
- **Coleta** = `D.opColeta.lancamentos` + `OpColetaCalc` (produção diária por
  colaborador, pontos, dias, média, hectares por fator). **É a base de produtividade —
  não criar segundo formulário de pontos.**
- **Laboratório** = `D.opAmostras.remessas` + `OpAmostrasCalc` (envio, resultado,
  prazo, aging, tempo médio de análise). **Reutilizar as datas do lab.**
- **Entregáveis** = `D.opEntregas.linhas` + `OpEntregasCalc` (checklist mapas/
  análises/recomendações, progresso %). **Base para a etapa Mapas/Recomendação.**
- **Cadastros**: clientes, **fazendas (com id)**, **municípios (com id)**,
  colaboradores (com id), veículos, equipamentos, serviços. **Não criar segunda base.**
- **Infra**: `commit()`/persistência/snapshot, RBAC `membros`, `edTable`/`edForm`,
  gráficos `mk()`, KPIs, `resp-cards`, drawer, funil ponderado, config comercial.

---

## 4. O que falta / é frágil (LACUNAS a construir, aditivo)

- **Entidade "projeto/serviço"** que atravesse as etapas. Hoje o vínculo é uma
  **tag de texto** (`obs:'Orçamento ORC-…'`) — sem `projetoId`/FK ligando coleta,
  amostra e entrega entre si nem ao orçamento.
- **Log de eventos operacional** (event sourcing leve) — só orçamentos têm histórico.
- **Timestamps por etapa** — a maioria das datas não é capturada (conversão nasce
  com `data:''`, `dataEnvio:''`, `dataResultado:''`).
- **Etapas ausentes**: planejamento, interpolação/processamento, apresentação,
  regulagem, acompanhamento, conclusão.
- **SLA configurável por etapa** + **aging** (dias parado) + **gargalos** + status
  🟢🟡🔴 — só existe prazo em amostras.
- **Timeline por projeto** e **visão "processo completo do cliente"**.
- **Produtividade evoluída**: por dia/semana/mês/safra, ha/dia, **por equipe**,
  drill-down, contextualização (malha/profundidade/dificuldade), retrabalho.
- **Dashboard operacional** (KPIs de hoje/mês, pipeline clicável), **Kanban**
  (persistido + auditado), **central de prioridades/alertas**.
- **Mobile operador de campo** (minhas atividades, iniciar/registrar/finalizar,
  captura automática de usuário/data/hora).
- **Talhão** como entidade (hoje é string livre em coleta/amostras) — opcional,
  fase posterior.
- **Idempotência real** na conversão (hoje só confirmação manual).

---

## 5. Modelo recomendado (conceitual — aditivo, sobre a base existente)

**Princípio:** o pipeline **consolida** dados que já existem; não recria clientes,
fazendas, coletas, lab, custos. Entidades novas guardam **referências** (por id ou
nome, no padrão atual), não cópias.

- **`D.projetos`** — projeto/serviço de AP (1 por serviço contratado):
  `{ id, numero, quoteId, clienteNome, fazendaId|fazenda, municipio, servicos[],
     vendedor, safra, areaHa, tipoWorkflowId, etapaAtual, responsaveis:{etapa→nome},
     refs:{ coletaIds[], remessaIds[], entregaId, funilRef }, criadoEm, concluidoEm }`.
  Criado por `orcConverter` (estende o handoff atual) **e** manualmente para serviços
  fora de orçamento. Registros operacionais **avulsos** (sem projeto) continuam válidos.
- **`projeto.eventos[]`** — event sourcing leve, no padrão `qzLog`:
  `{ em, quem, tipo, etapaDe, etapaPara, responsavel, obs, origem }`, com tipos como
  `PEDIDO_CRIADO, PLANEJADO, COLETA_INICIADA, COLETA_CONCLUIDA, LAB_ENVIADO,
   LAB_RESULTADO, INTERP_INICIADA, INTERP_CONCLUIDA, MAPAS_PRONTOS, APRESENTADO,
   REGULAGEM_OK, ACOMP_OK, CONCLUIDO`. Timeline, tempos e aging são **derivados** dos
   eventos (nunca campos redundantes).
- **`D.pipelineCfg`** — **workflow configurável por tipo de serviço**:
  `tipos:[{ id, nome, etapas:[{ codigo, nome, slaDias, responsavelPadrao, checklist[],
   condicaoConclusao }] }]`. SLA e etapas **cadastráveis** (nada hardcoded), pois
  serviços diferentes têm etapas diferentes.
- **Automação por evento real**: quando uma `remessa` vinculada ganha `dataResultado`,
  o projeto avança sozinho para "Aguardando processamento" (gera evento). Evita
  depender de mudança manual de status.
- **Carimbar `projetoId`** nos registros de coleta/amostras/entregas criados na
  conversão → vínculo por id daí em diante, **retrocompatível** (registros antigos sem
  `projetoId` seguem funcionando como avulsos).

Nomes de campos são conceituais e serão adaptados ao padrão atual do `D` na Fase 2.

---

## 6. Riscos e mitigações

- **Vínculo por string frágil** (fazenda/talhão em texto livre na coleta) → ligar
  projeto↔coleta por nome é instável. **Mitigação:** estampar `projetoId` nos
  registros na origem (conversão/criação); casar registros antigos por
  cliente+fazenda como *melhor esforço*, sem forçar.
- **Quebrar módulos existentes / 143 testes** → **só aditivo**: novos campos/arrays,
  novas views; motores puros atuais intactos. Novos testes por etapa.
- **Crescimento do snapshot** (`painel_estado`) com eventos → eventos leves; sem
  duplicar dados que já vivem nos módulos.
- **Kanban que muda status só visualmente** → toda mudança **persistida + auditada**
  (evento), com validação; arrastar não altera etapa crítica sem confirmação.
- **Migração de dados históricos** → não reescrever; projetos nascem "para frente";
  registros operacionais atuais aparecem como avulsos até serem vinculados.
- **Multi-tenant** permanece por `user_id` + `empresa` (constante) — manter o padrão.

---

## 7. Plano de fases (aditivo, uma de cada vez — parar entre elas)

1. **Auditoria** (esta) — sem código. ✅
2. **Modelo + workflow + eventos**: `D.projetos`, `projeto.eventos[]` (padrão `qzLog`),
   `D.pipelineCfg` (etapas/SLA por tipo de serviço); `orcConverter` passa a criar 1
   projeto + carimbar `projetoId`; migração aditiva; **testes** (sem UI ainda).
3. **Timeline por projeto** + **visão completa do cliente/fazenda** (datas,
   responsáveis, tempos e atrasos derivados dos eventos).
4. **Produção diária por colaborador** (evolui `opColeta`): dia/semana/mês/safra,
   ha/dia, por equipe, drill-down — sem novo formulário de pontos.
5. **Dashboard operacional**: KPIs (hoje/mês) + **pipeline por etapa clicável**.
6. **SLA + gargalos + aging**: config de SLA por etapa, status 🟢🟡🔴, tempo médio
   por etapa (mês × mês), painel de gargalos.
7. **Mobile operador**: "minhas atividades", iniciar/registrar/finalizar com poucos
   cliques, captura automática de usuário/data/hora.
8. **Kanban / pipeline** (persistido + auditado).
9. **Regulagem e acompanhamento** (novas etapas com registro).
10. **Alertas / automações** + **central de prioridades**.

Preparar a estrutura para a IA (futura) responder "o que está atrasado?", "maior
gargalo?", "quem coletou mais essa semana?" — sem lógica fictícia nesta fase.

---

## Conclusão da Fase 1

A plataforma tem uma **base operacional real e reaproveitável** (pedido, coleta,
laboratório, entregas, cadastros, RBAC, persistência e o padrão de auditoria dos
orçamentos), mas **não** tem a espinha que une tudo: a **entidade projeto**, o **log
de eventos com timestamps por etapa**, as **etapas finais** (processamento →
conclusão), **SLA/gargalos/aging**, **timeline**, **dashboard operacional** e o
**mobile do operador**. O caminho é **consolidar** o que existe com uma camada
aditiva de pipeline — sem duplicar nenhuma base.

**Aguardando aprovação para iniciar a Fase 2.**
