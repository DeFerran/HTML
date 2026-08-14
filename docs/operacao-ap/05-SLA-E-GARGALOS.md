# Operação AP — Fase 6: SLA + gargalos + aging

Onde os projetos travam, quanto tempo levam por etapa e o que estourou o prazo — mais
o **editor de SLA por etapa** (nada fixo no código). Aditivo; só leitura/agregação +
edição da config de workflow. Nenhum cálculo/rota/dado existente alterado.

## Objetivo realizado
Tela **Gargalos & SLA** (nav + aba, view `#v-gargalos`) com: KPIs de gargalo,
painel de gargalos por etapa, tempo médio por etapa (mês × mês) e o **cadastro de
SLA/responsável padrão por etapa**.

## KPIs
Maior fila (etapa + nº) · Maior tempo médio (etapa + dias) · Etapas atrasadas (SLA
estourado) · **Projetos parados** (aging > 2× SLA, mínimo 14 dias) · Sem responsável.

## Gargalos por etapa
Tabela (só etapas com projetos ativos, maior fila/tempo primeiro): **Fila** ·
**Tempo médio** na etapa · **Máx (aging)** · **SLA** · **Atrasados** (destaque
vermelho) · **Sem responsável**. Responde "qual etapa tem a maior fila / o maior
tempo / o maior atraso".

## Tempo médio por etapa (mês × mês)
Dias de permanência em cada etapa (de transições concluídas), com colunas **Geral**,
**mês atual**, **mês anterior** e **Δ** (▲ piorou/vermelho, ▼ melhorou/verde). Deriva
tudo dos eventos (`duracoesEtapa` + `mediaPorEtapa`), bucketizado pelo mês em que o
projeto **saiu** da etapa.

## Aging
Coluna **Máx (aging)** por etapa + KPI **Projetos parados** identificam projetos
esquecidos (muito tempo na mesma etapa). O aging por projeto já aparece na Timeline
(Fase 3) e no Painel (Fase 5).

## Configurar SLA por etapa (cadastrável — não hardcodado)
Editor com todas as etapas do workflow: **nome**, **SLA (dias)** e **responsável
padrão**. Alterações gravam em `D.pipelineCfg` (via `pipeSetSla`/`pipeSetEtapaNome`/
`pipeSetRespPadrao` + `commit`) e passam a valer para os cálculos de atraso/gargalo.
0 dias = etapa sem prazo. (Semente vinha da Fase 2; agora é editável na tela.)

## Motor puro (testado)
`PipelineCalc` ganhou: `gargalos` (fila/tempo médio/máx/atrasados/sem resp por etapa),
`duracoesEtapa` (permanência concluída por etapa, com mês de saída) e `mediaPorEtapa`
(média por etapa, com filtro de mês) — todos determinísticos e testáveis.

## Testes executados
- `bun test` → **169 pass / 0 fail** (2 novos: `gargalos`; `duracoesEtapa`+
  `mediaPorEtapa` com filtro de mês).
- Smoke headless (4 projetos; 2 no lab, 1 na coleta, 1 histórico com transições
  Jul→Ago): KPIs corretos (maior fila 2 · maior tempo 20d · 2 atrasadas · 1 parado ·
  2 sem resp); gargalos por etapa; tempo médio com Agosto/26 × Julho/26 (Coleta 22d em
  Ago); **editar SLA** do Laboratório e **responsável padrão** da Coleta persiste;
  **0 overflow** desktop e 390px; claro e escuro; **0 erro de JS** (screenshots).

## Arquivos
- `index.html`: `PipelineCalc` +`gargalos`/`duracoesEtapa`/`mediaPorEtapa`; nav +
  aba + view `#v-gargalos`; dispatch; `renderGargalos` + `pipeSetSla`/
  `pipeSetEtapaNome`/`pipeSetRespPadrao` + `garYM`/`garMesLabel`/`garDec`.
- `tests/pipeline.test.ts`: +2 testes.
- `docs/operacao-ap/05-SLA-E-GARGALOS.md` (este relatório).

## Riscos / rollback
- Risco baixo: leitura/agregação + edição da config de workflow (aditiva). Rollback:
  reverter o commit remove a tela; a `pipelineCfg` e os projetos seguem no estado.

## Próxima fase
**Fase 7 — Mobile operador**: "minhas atividades", iniciar/registrar/finalizar coleta
com poucos cliques e captura automática de usuário/data. (Aguardando ordem.)
