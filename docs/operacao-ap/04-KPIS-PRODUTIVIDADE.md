# Operação AP — Fase 4: Produtividade da equipe (KPIs por colaborador/equipe)

Dashboard de produtividade que **reaproveita a Coleta de Pontos** (`D.opColeta`) —
sem novo formulário nem segunda base. Aditivo; nenhum cálculo/rota/dado existente
alterado.

## Objetivo realizado
Tela **Produtividade** (nav "Produtividade" + aba, view `#v-produtividade`) que
responde "quem coletou, quanto e onde", por período, com drill-down por colaborador.

## Fonte de dados (sem duplicar)
Tudo vem dos lançamentos de coleta que já existem: `data`, `equipe`, `cliente`,
`fazenda`, `talhao`, `fator`, `status`, `colaboradores:[{nome,pontos}]`. **Hectares
por pessoa** = `pontos × fator` do lançamento (o fator/grade já é do módulo de Coleta).

## Período
Barra **Hoje · 7 dias · 30 dias · Este mês · Tudo · Personalizado** (datas). Filtra
por intervalo de datas dos lançamentos (motor `OpColetaCalc.filtra`).
- Observação honesta: os lançamentos de coleta **não são carimbados por safra**, então
  o recorte "por safra" não está disponível aqui — usa-se período por data. (Carimbar
  safra na coleta pode entrar numa fase futura, se desejado.)

## O que mostra
- **KPIs**: Pontos · Hectares (estimados) · Pontos/dia (+ ha/dia) · Coletas
  (concluídas/abertas) · Colaboradores ativos — via `OpColetaCalc.resumoColeta`.
- **Pontos por colaborador** (gráfico de barras, rótulos legíveis).
- **Por colaborador** (tabela): dias, pontos, **pontos/dia**, **hectares**, **ha/dia**,
  **% dos pontos**, e botão **histórico** (drill-down).
- **Por equipe** (tabela): colaboradores, dias, pontos, pontos/dia, hectares.
- **Evolução mensal** (gráfico): pontos (barras) + hectares (linha) por mês.

## Drill-down por colaborador (relatório)
Clique em **histórico** → visão do colaborador no período: KPIs (pontos, pontos/dia,
hectares, coletas) + **histórico diário** (data, equipe, cliente, fazenda, talhão,
pontos, hectares, status). É o "relatório diário/por colaborador".

## Produtividade com contexto (não é ranking cru)
Conforme pedido, a tela **não** transforma volume bruto em avaliação: a ordenação é
por pontos, mas exibe **dias, média/dia, hectares e ha/dia** juntos, com aviso
explícito de ler com contexto (malha, profundidade, distância, dificuldade). Sem
medalhas nem "mais pontos = melhor".

## Indicadores ainda não disponíveis (faltam dados de origem)
Horas trabalhadas, pontos/hora, ha/hora, km e amostras/colaborador **não existem** na
coleta atual (não há hora/km; amostras vivem em Envio de Amostras, por remessa). Ficam
para quando/if esses campos forem adicionados — não foram inventados.

## Testes executados
- `bun test` → **167 pass / 0 fail** (6 novos: `porColaborador`, `porEquipe`,
  `serieMensal`, `historicoColab`, `resumoColeta`, ha-null).
- Smoke headless (5 coletas, 4 colaboradores, 2 meses): KPIs corretos (Pontos 213 ·
  Hectares 674 · Pontos/dia 71,0 · 5 coletas · 4 colaboradores); drill-down Agnaldo
  (73 pts · 36,5/dia · 301 ha · 3 coletas); gráficos e evolução mensal renderizam;
  **0 overflow** desktop e 390px; claro e escuro; **0 erro de JS** (screenshots).

## Arquivos
- `index.html`: `OpColetaCalc` +`porColaborador`/`porEquipe`/`serieMensal`/
  `historicoColab`/`resumoColeta`; nav + aba + view `#v-produtividade`; dispatch;
  `renderProdutividade`/`renderProdColab` + helpers de período; gráficos
  `cProdColab`/`cProdMes`.
- `tests/opcoleta.test.ts`: +6 testes.
- `docs/operacao-ap/04-KPIS-PRODUTIVIDADE.md` (este relatório).

## Riscos / rollback
- Risco baixo: só leitura/agregação sobre a Coleta existente. Rollback: reverter o
  commit remove a tela; a Coleta e seus dados seguem intactos.

## Próxima fase
**Fase 5 — Dashboard operacional**: KPIs de hoje/mês + **pipeline por etapa clicável**
(consolida projetos + coleta + lab + entregas). (Aguardando ordem.)
