# 09 — Fase 1: Quick Wins (implementado)

Primeira fase do plano (relatório 08). Só interface — sem tocar em cálculo,
banco, rota ou regra de negócio.

## Aplicado

| # | Melhoria | Onde | Efeito |
|---|---|---|---|
| 1 | `inputmode="decimal"` nos campos R$/%/num | `edForm` (Metas) + Valor da Nova despesa | teclado numérico no celular (paridade com editores em tabela) |
| 2 | Confirmação ao excluir | `edTable` genérico + categoria mensal, indicador/colaborador (Equipe), coletor, grupo (Estrutura) | fim do "clique único apaga" |
| 3 | Data = hoje por padrão | Nova despesa | menos digitação |
| 4 | Lembrar último Centro/Forma/Status | Nova despesa | lançamentos em série mais rápidos |
| 5 | "Salvar e criar outro" | Nova despesa | reabre o form já com defaults |
| 6 | Marcar obrigatório + validação inline | Valor da despesa | erro no campo + toast (não só `alert`) |
| 7 | Toast "✓ salvo" por registro | despesa + coleta/amostra/entrega | feedback claro por lançamento |
| 8 | Foco de teclado visível (`:focus-visible`) | botões, abas, `.snav`, pílulas, links | acessibilidade por teclado |

## Verificação
- **bun: 127 testes** passam.
- **Smoke headless:** Data=hoje ✓, `inputmode=decimal` ✓, "Salvar e criar outro"
  reabre o form e lembra o Centro ✓, toast visível ✓, exclusão inline agora
  chama `confirm()` ✓, 0 erros JS.

## Impacto estimado no placar
Operador 60→~70 · Lançamentos 62→~72 · Acessibilidade 52→~66 · Mobile 66→~72 ·
Consistência 70→~74. (As dimensões de dashboard/gestor/navegação sobem nas
próximas fases.)

## Próximas fases (aguardando execução)
- **Fase 2 — Mobile:** salvar sticky em form longo; Despesas entra direto no
  lançamento; tabelas operacionais em resumo+detalhes; alvos de toque ≥40px.
- **Fase 3 — Dashboards:** Visão Geral vira tela-decisão (herói+tendência+
  alertas+drill-down); fragmentar Metas; desafogar Custos; desduplicar números.
- **Fase 4 — Navegação:** enxugar sidebar; rótulos; busca global (avaliar).
- **Fase 5 — Polimento/A11y:** `aria-live`/`aria-expanded`/`aria-current`.
