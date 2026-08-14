# 01 — Auditoria de UX/UI — Geral

**Data:** 2026-08-14 · **Escopo:** plataforma DF AGRO 360 (`index.html`, ~6.513
linhas, PWA single-file). **Método:** inventário do código real + medição de
densidade e jornadas por render headless (Chromium) + inspeção visual em
desktop e celular, claro/escuro. **Nada foi alterado** — auditoria somente.

> Perfis que orientam tudo: **GESTOR** (entender → decidir; precisa de
> DADO→CONTEXTO→PROBLEMA→IMPACTO→AÇÃO) e **OPERADOR** (lançar rápido, poucos
> cliques, baixa chance de erro).

## Placar (0–100)

| Dimensão | Nota | Leitura de uma linha |
|---|--:|---|
| **Usabilidade geral** | **64** | Base sólida e consistente; peca em hierarquia de gestão e polimento de lançamento. |
| Gestão (gestor) | 62 | Dado sobra, hierarquia falta: sem métrica-herói, sem "melhorou/piorou", sem alerta-primeiro. |
| Operação (operador) | 60 | Auto-save é bom; falta lançamento rápido, teclado numérico no R$, "salvar e criar outro". |
| Lançamentos | 62 | Funciona e salva sozinho; formulários mostram tudo de uma vez, sem divulgação progressiva. |
| Dashboards | 55 | Sobrecarga: Metas 38 KPIs+15 gráficos; números repetidos em 2–4 telas. |
| Gráficos | 60 | 51 gráficos; vários redundantes (ranking de cliente 3×, receita/serviço 3×). |
| Tabelas | 68 | `resp-cards` + `wrapTables` protegem bem; faltam ordenação/paginação. |
| Navegação | 62 | 20 telas reais, mas 34 entradas na sidebar + rótulos ambíguos + duplicações. |
| Desktop | 75 | Bom uso do espaço e consistência; algumas páginas muito longas. |
| Mobile | 66 | Drawer/cards/toque fortes; lacuna de teclado numérico e foco invisível. |
| Consistência | 70 | Design system coeso; quebra em modal(op) × inline(lançamento) e confirmações. |
| Acessibilidade | 52 | Labels e feedback por texto+cor bons; foco de teclado ausente em botões/abas. |

## Diagnóstico executivo (o que mais pesa)

1. **A gestão sabe muito, mas hierarquiza pouco.** A Visão Geral abre com 14
   KPIs de **peso visual idêntico** (nenhum "número-herói"), sem comparação com
   período anterior ("melhoramos ou pioramos?") e sem "o que exige atenção"
   no topo. A tela **Metas** é uma super-view (38 KPIs + 15 gráficos, ~9 telas
   de rolagem) — impossível passar no teste dos 10 segundos.
2. **Redundância de números.** Custo total 2026, receita bruta, comissão,
   margem líquida, hectares e receita/ha reaparecem em 2–4 telas com rótulos
   ligeiramente diferentes → risco de "qual é o certo?".
3. **Lançar exige mais do que deveria.** Não há **lançamento rápido**; o
   formulário de Despesa mostra **13 campos de uma vez** sem "mais detalhes";
   no celular o campo **Valor (R$)** abre teclado **alfabético**; não existe
   **"salvar e criar outro"** para quem lança em série.
4. **Inconsistências de padrão.** Excluir pede confirmação nos formulários de
   card (Despesas/Recorrências/Veículos) mas **não** nas tabelas inline
   (Serviços/Funil/Custos/Equipe/…) — clique único apaga. Editar é **modal** no
   operacional e **inline** em Lançamentos.
5. **Acessibilidade de teclado.** Botões, abas, links e a navegação **não têm
   foco visível** (só inputs têm) — barreira para teclado/leitor de tela.

## Pontos fortes (preservar)

- **Auto-save** consistente com indicador "● Tudo salvo · HH:MM" — o operador
  não perde formulário por esquecer de salvar.
- **Design system coeso**: botões, KPIs (com borda de status verde/âmbar/
  vermelho), cards, tabelas e cores seguem um padrão claro.
- **Mobile bem pensado**: sidebar→drawer com overlay/Esc/fecha-ao-navegar,
  tabelas viram cards (`resp-cards`), rede de segurança `wrapTables()`,
  alvos de toque de 44px nos controles principais, **nenhuma ação só-em-hover**.
- **Cada KPI já traz contexto** (subtítulo: "faturamento contratado · a receber
  em 2027") — a estrutura para DADO→CONTEXTO existe; falta PROBLEMA→AÇÃO.

## Como ler os demais relatórios
`02` jornadas (cliques/fricção) · `03` lançamentos (ranking + Friction Score) ·
`04` dashboards & gráficos (Clarity Score + redundância) · `05` mobile ·
`06` gestor · `07` operador · `08` plano de melhorias (Quick Wins, TOP 20,
matriz impacto×esforço).

**Nada será implementado sem sua aprovação.**
