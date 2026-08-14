# 06 — Auditoria do perfil GESTOR

O gestor precisa de: DADO → CONTEXTO → PROBLEMA → IMPACTO → AÇÃO, sem procurar.

## Respostas diretas

| O gestor consegue entender rapidamente… | Hoje | Comentário |
|---|:--:|---|
| **Situação?** ("como estamos") | 🟡 | há margem líquida, mas diluída entre 14 KPIs de peso igual; sem número-herói. |
| **Problemas?** | 🔴 | não há faixa de alertas nem realce do que está pior. |
| **Desvios?** | 🟡 | metas mostram "quanto falta", mas escondidas numa super-view de 9 telas. |
| **Resultados?** | ✔ | margem, receita, custo, comissão estão todos lá (na verdade, repetidos). |
| **Prioridades?** | 🔴 | nada ordena "o que olhar primeiro"; tudo tem o mesmo peso visual. |
| **Próximas ações?** | 🔴 | KPIs não são clicáveis; não há "investigar isto". |

## Onde a plataforma serve bem o gestor
- **Riqueza de análise**: 51 gráficos cobrindo margem, caixa, clientes, funil,
  custos, equipe. Nenhum ângulo falta.
- **Contexto por card**: cada KPI traz um subtítulo explicando o número.
- **Cascata de margem** (cWaterfall) e **fluxo de caixa** (cTimeline) são
  excelentes para o "porquê" do resultado.
- **Seletor de safra** dá a leitura por safra (e safras sem base já zeram com
  estado vazio limpo).

## Onde falha para o gestor (DADO→CONTEXTO→PROBLEMA→IMPACTO→AÇÃO)
A plataforma entrega **DADO** e **CONTEXTO** com folga, mas para em seguida:
1. **PROBLEMA não é destacado.** Nenhuma tela diz "isto está pior". O gestor faz
   o diagnóstico manualmente lendo dezenas de números.
2. **IMPACTO/tendência ausente.** Não há "vs safra anterior" / "vs mês anterior"
   em número — a comparação existe só como barras de gráfico. Sem "melhoramos ou
   pioramos?".
3. **AÇÃO não existe.** KPIs não levam a lugar nenhum (não clicáveis); não há
   "investigar", "ver lançamentos disso", "abrir cliente".
4. **Sobrecarga em Metas e Custos** (38 e 21 KPIs) — o excesso esconde o
   essencial. O oposto de "mostrar primeiro o que ajuda a decidir".
5. **Redundância confunde** — o mesmo custo/receita/comissão em 2–4 telas com
   rótulos diferentes gera "qual é o número certo?".

## Existe camada de alertas?
Sim, mas **para a IA**, não para o dashboard do gestor: há "Prioridades da IA" e
"Alertas Inteligentes" na Central de IA (gated, muitos "em implantação"). No
**dashboard principal** (Visão Geral) **não há** faixa de alertas de negócio
(ex.: "margem abaixo do equilíbrio", "cliente X caiu 30%", "custo Y estourou o
orçamento"). O motor de detecção existe no backend (detectores da IA); falta
**superfície no dashboard**.

## Recomendações para o gestor (a validar — não implementar)
1. **Visão Geral = tela de decisão** (não placar): topo com **1 número-herói**
   (margem líquida da safra) + **variação** vs safra/período anterior + **faixa
   de 2–4 alertas** de negócio (do próprio motor de detectores) com link
   "investigar".
2. **KPIs clicáveis** → drill-down para a tela/detalhe correspondente (AÇÃO).
3. **Hierarquia visual**: 1–3 números-herói grandes; o resto (dezenas de KPIs)
   recolhido em "ver detalhes"/abas.
4. **Desafogar Metas/Custos**: fragmentar; deixar no topo só "quanto falta p/
   meta" e "margem do mês vs anterior".
5. **Comparação como número**: cada KPI-chave com "▲/▼ vs anterior".

**Nota Gestor: 62/100** — analítica e completa, porém exige que o gestor faça o
trabalho de hierarquizar e diagnosticar que a interface deveria fazer por ele.
