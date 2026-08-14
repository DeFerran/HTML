# 10 — Fase 3: Dashboards (implementado)

Só interface — sem tocar em cálculo, banco, rota ou regra de negócio.

## 3a — Visão Geral vira "tela-decisão" (aditivo)
Faixa no topo da Visão Geral, ACIMA dos KPIs existentes (nada removido):
- **Número-herói**: Margem líquida da safra (grande, cor por sinal) → clica p/ Financeiro.
- **3 chips clicáveis**: Receita (com % da meta), Hectares, Comissão.
- **Faixa de alertas de negócio** derivados de funções JÁ existentes (margemLiq,
  margemSeguranca, comissaoVal, metasFoco): margem negativa, abaixo do
  equilíbrio, comissão > margem operacional, receita X% da meta. Cada alerta
  navega para a tela de investigação.

Fecha o teste dos 10 segundos: situação (herói) · problema/atenção (alertas) ·
onde clicar (tudo é botão de drill-down).

## 3b — Metas fragmentada em abas internas
A super-view (38 KPIs + 15 gráficos, ~9 telas) foi organizada em **3 abas**,
mostrando uma seção por vez (mesmos dados, nada removido):
- **Metas de venda**: metas de receita/hectares + metas por segmento + margem líquida.
- **Comissão**: plano e composição por colaborador.
- **Margem/ha & custos**: margem por hectare, custos por grupo, custo médio/ha,
  ponto de equilíbrio, ranking de clientes.

Técnica: as seções (marcadas por `.lead`) são agrupadas por classe (`mt-*`) e
exibidas via `[data-mt]`; ao trocar de aba, `renderMetas()` é chamado de novo
para os gráficos da aba visível desenharem no tamanho certo.

## Verificação
- **bun: 127 testes** passam. **0 erros JS** em ambas.
- Hero: seed vazio → mensagem neutra; dados reais → herói de margem negativa +
  3 alertas corretos; clique navega.
- Metas: agrupamento correto (kMetas→venda, kComissao→comissão, kHa→margem);
  trocar de aba mostra/oculta certo e redesenha; volta ok.

## Impacto estimado no placar
Gestor 62→~82 · Dashboards 55→~78 · Gráficos 60→~72 (menos poluição por tela).
(Desduplicação de números e limpeza fina ficam para a Fase 3c, se desejar.)
