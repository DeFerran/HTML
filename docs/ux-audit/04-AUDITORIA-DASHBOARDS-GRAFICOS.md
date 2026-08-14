# 04 — Auditoria de Dashboards & Gráficos

**Inventário real:** 51 gráficos (Chart.js) e 28 blocos `kpi()`. Densidade
medida por render (viewport útil ~820px).

## Management Clarity Score por dashboard (0–10)
Média de: hierarquia, clareza, ação, comparação, contexto, densidade,
legibilidade, mobile.

| View | KPIs | Gráficos | Altura (~telas) | Clarity | Veredito |
|---|--:|--:|--:|--:|---|
| **geral** (Visão Geral) | 14 | 5 | 3,3 | **6.0** | Melhor candidata a virar tela-decisão, mas hoje sem hierarquia/tendência. |
| **fin** (Financeiro) | 4 | 4 | 2,1 | **7.0** | Enxuta e focada; boa. |
| **cli** (Clientes) | 7 | 4 | 2,0 | **6.5** | Ok; heatmap cross-sell é forte; sem filtro. |
| **serv** (Serviços) | 7 | 2 | 1,4 | **7.0** | Enxuta; ok. |
| **funil** | 5 | 6 | 2,8 | **6.0** | 6 gráficos competem; foco poderia ser "quanto falta p/ meta". |
| **margem** | 10 | 2 | 2,6 | **6.0** | Simulador é bom; 10 KPIs é muito. |
| **metas** | **38** | **15** | **9,4** | **3.0** 🔴 | **Super-view sobrecarregada** — reprova no teste dos 10s. |
| **equipe** | 4 | 5 | 3,2 | **6.5** | Ok. |
| **custos** | 21 | 6 | 4,7 | **4.5** | Densa demais; "custo do mês" some no meio. |
| **op** (Operação) | 4 | 2 | 0,8 | **7.5** | Enxuta e clara. |

**Telas de gestão mais confusas:** `metas` (3.0) e `custos` (4.5).

## Teste dos 10 segundos — Visão Geral (a mais importante)

| Pergunta | Responde? | Por quê |
|---|:--:|---|
| 1. Como estamos? | 🟡 parcial | há margem líquida, mas sem destaque de "herói"; 14 KPIs de peso igual. |
| 2. Melhoramos ou pioramos? | 🔴 não | **não há comparação** com safra/mês anterior nem seta de tendência. |
| 3. Onde está o principal problema? | 🔴 não | nenhum alerta/realce; o gestor lê tudo e conclui. |
| 4. Qual a principal oportunidade? | 🔴 não | idem. |
| 5. O que exige atenção? | 🔴 não | não há faixa de alertas no topo. |
| 6. Onde clicar para investigar? | 🟡 parcial | os KPIs não são clicáveis para drill-down; navega-se pela sidebar. |

**Conclusão:** a Visão Geral hoje é um **placar rico**, não uma **tela de
decisão**. Falta o topo NÍVEL 1 (1 número-herói + variação) → NÍVEL 3 (alertas)
→ e drill-down clicável.

## Hierarquia da informação (Nível 1→5)
Hoje quase tudo vive no **Nível 1 visual** (todos os KPIs e gráficos com o mesmo
tamanho/peso). Faltam camadas:
- **Nível 1** (crítico): deveria ser 1–3 números-herói (margem líquida + variação).
- **Nível 2** (tendência): série vs período anterior (existe em gráfico, não em número).
- **Nível 3** (alertas): **inexistente** como faixa dedicada no topo.
- **Nível 4/5** (análises/detalhe): deveriam estar em drill-down/abas/drawer —
  hoje estão todos abertos na mesma rolagem.

## Redundância (documentar, não remover)

**Mesmo número em 2–4 telas** (rótulos ligeiramente diferentes → "qual é o certo?"):
- **Custo total projetado 2026**: geral + fin + metas + custos.
- **Receita bruta 26/27**: geral, fin, metas, funil, equipe, margem (o número mais reciclado).
- **Comissão 30/05/27**: geral + fin + metas + bloco de comissão (3+ telas).
- **Margem líquida %**: geral + metas.
- **Hectares 26/27** e **Receita/ha**: geral + metas + custos.

**Gráficos redundantes** (mesmo corte, 3× cada):
- Ranking de clientes por receita/contribuição: `cTopCli` (geral) ≈ `cCliRec`
  (metas) ≈ `cMargCli` (margem).
- Receita por serviço: `cTopServ` (geral) ≈ `cServ` (serv) ≈ `cRecServCli` (cli).
- Custo por categoria: `cCat` **e** `cCatPie` na própria fin (mesmo dado, 2×) +
  `cCatPct` (metas).

## Gráficos — teste dos 5 segundos e utilidade

- **Passam** (claros, decisão suportada): cWaterfall (cascata da margem),
  cTimeline (fluxo de caixa), cSit/cEtapa (operação), cFunilCob (cobertura da
  meta), cServPie/cEstrDonut (participação). Tipos adequados.
- **Marcar como problema (5s)**: os que vivem em telas densas (metas/custos) —
  o gráfico é ok, mas o **contexto ao redor** (dezenas de irmãos) impede leitura
  rápida.
- **Candidatos a virar tabela/ranking/KPI** (gráfico não agrega vs alternativa):
  - `cCat` **e** `cCatPie` (fin): manter **um** (a doughnut) — bar+doughnut do
    mesmo dado é duplicação.
  - `cVendedorPart` (equipe): participação % já está implícita no `cVendedor`
    (doughnut); um ranking/tabela bastaria.
  - `cComimp` (metas): comparação base% vs meta% é melhor como 2 números.

## Cards (KPIs) — qualidade
Um card bom responde: O QUE É / VALOR / BOM OU RUIM / VS QUÊ / PRECISO AGIR?
- ✔ **O QUE É + VALOR + contexto**: todos os KPIs têm rótulo, valor e subtítulo.
- ✔ **BOM OU RUIM**: parcial — a borda de status (verde/âmbar/vermelho) existe
  em vários (`.kpi.g/.gold/.r`).
- 🔴 **VS QUÊ**: quase nenhum traz comparação (vs meta/anterior) explícita.
- 🔴 **PRECISO AGIR**: nenhum card é acionável/clicável para drill-down.
- **Excesso**: 14 (geral), 21 (custos), 38 (metas) — acima do que um dashboard
  de decisão comporta. Muitos são "número sem próximo passo".

## Recomendações (a validar — não implementadas)
1. **Fragmentar `metas`** em: (a) Metas de venda (receita/hectares vs meta,
   "quanto falta"), (b) Margem/ha (economia unitária), (c) Comissão — cada uma
   enxuta. Tirar da metas o que é "detalhe" para drill-down.
2. **Visão Geral vira tela-decisão**: topo com margem líquida + variação +
   faixa de 2–3 alertas; KPIs clicáveis para a tela de detalhe.
3. **Desduplicar números**: definir a tela "dona" de cada indicador e, nas
   outras, referenciar (ou remover o card repetido).
4. **fin**: manter só a doughnut de categorias (remover o bar gêmeo).
5. **Poluição**: reduzir gráficos por tela no celular a 1 por linha (já é —
   ver 05) e limitar KPIs de topo a ~6 por dashboard, resto em "ver mais".
