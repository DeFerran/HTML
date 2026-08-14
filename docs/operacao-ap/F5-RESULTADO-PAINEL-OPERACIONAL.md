# Operação AP — Fase 5: Painel Operacional (gestor)

Tela que responde "**o que está acontecendo hoje?**" num lugar só — consolidando
projetos (pipeline), coleta (pontos hoje/mês) e SLA. Aditivo; só leitura/agregação,
nenhum cálculo/rota/dado existente alterado.

## Objetivo realizado
**Painel Operacional** (nav + aba, view `#v-painelop`) com KPIs do dia/mês, o
**pipeline por etapa clicável** e a lista "**Precisa da sua atenção**".

## KPIs (hoje/mês)
Projetos ativos (+ em atraso) · Área ativa (ha em projetos ativos) · **Pontos hoje**
(+ ha) · **Pontos no mês** · No laboratório · Aguardando processamento · Aguardando
apresentação · Aguardando regulagem · **Concluídos no mês** · Etapas atrasadas (SLA).
- Pontos hoje/mês vêm da **Coleta** (`OpColetaCalc` filtrando por data); as contagens
  por etapa e atrasos vêm do **pipeline** (`PipelineCalc.agg`). Reaproveita tudo.

## Pipeline por etapa clicável
Uma faixa com as etapas do workflow e a **contagem de projetos ativos** em cada uma
(estilo funil operacional). Etapas com projeto em atraso ficam **destacadas (🔴 N
atrasado)**. **Clicar** numa etapa abre a tela **Projetos** já filtrada por aquela
etapa (reusa a lista da Fase 3) — "ao clicar, mostrar os projetos naquela etapa".

## Precisa da sua atenção
Lista dos projetos com **SLA estourado** (etapa acima do prazo), ordenados pelo maior
atraso: projeto, cliente, etapa, responsável, atraso (dias/prazo · +Nd) e **abrir**
(vai direto ao projeto). É a semente da central de prioridades (a completa vem na
Fase 10 — alertas/automações).

## Reaproveitamento (sem duplicar)
Nenhuma base nova: pipeline de `D.projetos` (Fase 2), pontos de `D.opColeta`,
SLA/aging de `PipelineCalc`, KPIs com `kpi()`, tabelas `resp-cards`, navegação e
filtro reusando a tela Projetos. CSS novo só para os cartões do pipeline (`.pop-*`),
tema-aware.

## Testes executados
- `bun test` → **167 pass / 0 fail** (motor inalterado).
- Smoke headless (4 projetos em etapas distintas — 1 atrasado no lab — + 2 coletas de
  hoje): KPIs corretos (ativos 3 · área 2.550 ha · pontos hoje/mês 85 · lab 1 ·
  processamento 1 · apresentação 1 · concluído no mês 1 · atrasadas 1); pipeline
  com LABORATÓRIO **🔴 1 atrasado**; **clicar** na etapa abre Projetos filtrado
  (1 linha); atenção lista o projeto atrasado; **0 overflow** desktop e 390px; claro
  e escuro; **0 erro de JS** (screenshots).

## Arquivos
- `index.html`: nav + aba + view `#v-painelop`; dispatch; `renderPainelOp` +
  `painelIrEtapa`/`painelAbrirProj`/`painelHojeISO`/`painelMesIniISO`; CSS `.pop-*`.
- `docs/operacao-ap/F5-RESULTADO-PAINEL-OPERACIONAL.md` (este relatório).

## Riscos / rollback
- Risco baixo: leitura/agregação + navegação. Rollback: reverter o commit remove a
  tela; dados intactos.

## Próxima fase
**Fase 6 — SLA + gargalos + aging**: configuração de SLA por etapa (editor), painel
de **gargalos** (etapa com maior fila/tempo/atraso) e **tempo médio por etapa**
(mês × mês). (Aguardando ordem.)
