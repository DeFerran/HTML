# 08 — Plano de Melhorias (proposta — nada implementado)

Roadmap priorizado. **Nada será feito sem sua aprovação.** Cada item respeita as
regras: não altera cálculos, banco, rotas nem regras de negócio — são mudanças
de **interface/experiência**.

## Quick Wins (pequeno esforço, grande impacto)
1. **`inputmode="decimal"` nos campos R$** da área financeira/Despesas/Metas —
   teclado numérico no celular (paridade com os editores em tabela). *(BAIXO)*
2. **Confirmação (ou "desfazer") ao excluir** nas tabelas inline. *(BAIXO)*
3. **Data = hoje por padrão** na Nova despesa; **Status = "Pago"**, **Forma =
   última usada**. *(BAIXO)*
4. **Foco de teclado visível** (`:focus-visible`) em botões, abas, `.snav`,
   pílulas. *(BAIXO)* — acessibilidade.
5. **Toast "✓ salvo"** por registro + manter o indicador de salvo no drill-in
   mobile. *(BAIXO)*
6. **Marcar campos obrigatórios** (asterisco/《obrigatório》) e validar Valor
   inline (não só `alert`). *(BAIXO)*
7. **fin: remover o gráfico de categorias duplicado** (manter só a doughnut).
   *(BAIXO)*

## Fase 1 — Lançamentos críticos (operador)
- **Nova despesa progressiva**: 4 campos principais (Data · Descrição · Valor ·
  Categoria) + **"+ Mais detalhes"** para os 8 secundários. *(MÉDIO)*
- **"Salvar e criar outro"** nos formulários de card (Despesa, Recorrência,
  Coleta, Amostra, Entrega). *(MÉDIO)*
- **FAB "+ Lançar"** (Despesa/Coleta/Entrega/Observação) no contexto da safra.
  *(MÉDIO)*
- **Lembrar últimos valores** (Centro/Forma/Status) entre lançamentos. *(MÉDIO)*

## Fase 2 — Mobile
- **Salvar sticky** no rodapé em formulários longos no celular. *(MÉDIO)*
- **Despesas no celular**: entrar direto no lançamento (não empilhar 5 cards);
  Recorrências/Veículos/Orçamentos como abas internas. *(MÉDIO)*
- **Tabelas operacionais**: padrão **resumo + [Ver detalhes]** (card por linha)
  no celular em vez de scroll lateral. *(ALTO)*
- **Alvos de toque**: checkbox e "✕"/"remover" ≥ 40px. *(BAIXO)*

## Fase 3 — Dashboards (gestor)
- **Visão Geral = tela de decisão**: número-herói (margem líquida) + variação vs
  anterior + **faixa de alertas** de negócio (do motor de detectores) + KPIs
  clicáveis para drill-down. *(ALTO)*
- **Fragmentar Metas** (super-view) em Metas de venda / Margem-ha / Comissão.
  *(ALTO)*
- **Desafogar Custos** (21→~6 KPIs de topo; resto em "ver mais"). *(MÉDIO)*
- **Desduplicar indicadores** (definir tela "dona" de cada número). *(MÉDIO)*
- **Comparação como número** (▲/▼ vs safra/mês anterior) nos KPIs-chave. *(MÉDIO)*

## Fase 4 — Navegação
- **Enxugar a sidebar**: hoje 34 entradas para 20 telas. Colapsar o bloco de IA
  (a sidebar espelha a Central IA), remover deep-links redundantes, resolver
  rótulos ambíguos ("Visão Geral" em 2 lugares; aba "Financeiro/Margem" vs
  `<h2>` "Financeiro/Caixa"). *(MÉDIO)*
- **Ação primária clara por tela** (já existe no operacional; padronizar). *(BAIXO)*
- **Busca global** (cliente/serviço/colaborador/lançamento) — avaliar; hoje
  inexistente. *(ALTO)*

## Fase 5 — Polimento / acessibilidade
- `aria-live`/`role="alert"` nas mensagens; `aria-expanded` no drawer/filtros;
  `aria-current` na navegação. *(BAIXO–MÉDIO)*
- Consistência de padrão de edição (modal × inline) — decidir um padrão. *(MÉDIO)*
- Skeleton/loading em telas que dependem de sync. *(MÉDIO)*

---

## TOP 20 problemas de UX

| # | Problema | Perfil | Impacto | Tela | Prio | Esforço |
|---|---|---|---|---|---|---|
| 1 | Visão Geral não passa no teste dos 10s (sem herói/tendência/alerta) | Gestor | Alto | geral | UX-P1 | ALTO |
| 2 | Campos R$ sem teclado numérico no celular | Operador | Alto | Despesas/Metas | UX-P1 | BAIXO |
| 3 | Sem "salvar e criar outro" | Operador | Alto | todos os forms | UX-P1 | MÉDIO |
| 4 | Metas: super-view (38 KPIs+15 gráficos) | Gestor | Alto | metas | UX-P1 | ALTO |
| 5 | Sem lançamento rápido (FAB "+ Lançar") | Operador | Alto | global | UX-P1 | MÉDIO |
| 6 | Exclusão inline sem confirmação (clique único apaga) | Operador | Alto | tabelas Lançamentos | UX-P1 | BAIXO |
| 7 | Nova despesa com 13 campos sem "mais detalhes" | Operador | Alto | Despesas | UX-P1 | MÉDIO |
| 8 | Números duplicados em 2–4 telas ("qual é o certo?") | Gestor | Médio-Alto | geral/fin/metas/custos | UX-P1 | MÉDIO |
| 9 | Foco de teclado invisível em botões/abas/links | Ambos | Médio-Alto | global | UX-P1 | BAIXO |
| 10 | Sem faixa de alertas de negócio no dashboard | Gestor | Alto | geral | UX-P1 | MÉDIO |
| 11 | KPIs não clicáveis (sem drill-down/AÇÃO) | Gestor | Médio | dashboards | UX-P2 | MÉDIO |
| 12 | Custos densa (21 KPIs) — "custo do mês" some | Gestor | Médio | custos | UX-P2 | MÉDIO |
| 13 | Sem comprovante/anexo na despesa | Operador | Médio | Despesas | UX-P2 | ALTO |
| 14 | Data não vem "hoje"; sem defaults/memória | Operador | Médio | Despesas | UX-P2 | BAIXO |
| 15 | Sidebar inflada (34 entradas p/ 20 telas) + rótulos ambíguos | Ambos | Médio | navegação | UX-P2 | MÉDIO |
| 16 | Indicador de "salvo" some no drill-in mobile | Operador | Médio | Lançamentos mobile | UX-P2 | BAIXO |
| 17 | Tabelas operacionais rolam de lado no celular | Operador | Médio | opcoleta/amostras/entregas | UX-P2 | ALTO |
| 18 | Obrigatórios sem marcação; validação fraca | Operador | Médio | forms | UX-P2 | BAIXO |
| 19 | Gráficos redundantes (cliente 3×, serviço 3×, categoria 2× na fin) | Gestor | Baixo-Médio | geral/serv/metas/margem/fin | UX-P3 | MÉDIO |
| 20 | Sem `aria-live`/`aria-expanded`/`aria-current` | Ambos | Baixo-Médio | global | UX-P3 | BAIXO |

## Matriz Impacto × Esforço

**ALTO impacto / BAIXO esforço → FAZER PRIMEIRO**
- #2 teclado numérico R$ · #6 confirmação de exclusão · #9 foco visível ·
  #14 defaults (data hoje) · #16 indicador salvo mobile · #18 obrigatórios.

**ALTO impacto / ALTO esforço → PLANEJAR**
- #1 Visão Geral tela-decisão · #4 fragmentar Metas · #5 FAB lançar (médio) ·
  #10 alertas no dashboard (médio) · #17 tabelas op mobile.

**BAIXO impacto / BAIXO esforço → OPORTUNIDADE**
- #20 aria · #7 fin gráfico duplicado · rótulos de navegação.

**BAIXO impacto / ALTO esforço → NÃO PRIORIZAR AGORA**
- #13 comprovante/anexo (útil, mas exige armazenamento — avaliar depois) ·
  busca global (só se houver ganho real).

## Ordem sugerida de execução
1. **Lote Quick Wins** (#2, #6, #9, #14, #16, #18, #3-parcial) — 1 fase pequena,
   grande alívio para o operador e acessibilidade.
2. **Nova despesa progressiva + salvar-e-novo + FAB** (Fase 1).
3. **Visão Geral tela-decisão + fragmentar Metas** (Fase 3).
4. **Mobile: salvar sticky + tabelas op resumo/detalhe** (Fase 2).
5. **Navegação + polimento** (Fases 4–5).

Cada fase seria implementada isoladamente, testada e submetida à sua aprovação —
conforme a regra de implementação incremental.
