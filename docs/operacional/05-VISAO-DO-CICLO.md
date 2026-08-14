# Controle Operacional — Visão do Ciclo — Resultado

**Data:** 2026-08-14
**Fase:** painel de visão geral do módulo (fiel à página "Visão geral" do PDF).
Aditivo; só reúne os números das 3 telas — nenhuma lógica nova de cálculo.

## O que foi entregue

- Nova aba **Ciclo Operacional** (primeira do grupo "Controle Operacional").
- Mostra o ciclo em funil — **coleta de pontos → envio de amostras → entregas** —
  em 3 cards de etapa (com seta entre eles):
  1. **Coleta**: pontos na safra, dias, lançamentos, média/dia, hectares (se o
     fator estiver definido).
  2. **Amostras**: remessas, aguardando, atrasados, recebidos, tempo médio.
  3. **Entregas**: concluídas/total, em andamento, pendentes, itens pendentes.
- Cada card tem **"Abrir"** → vai direto para a tela correspondente.
- **Reuso total** dos cálculos puros (`OpColetaCalc`/`OpAmostrasCalc`/
  `OpEntregasCalc`) — sem duplicar regra.

## Arquivos

- `index.html` — view `#v-opresumo`; `renderOpResumo()`; CSS `.op-ciclo`/`.op-stage`;
  tab/sidebar/rota.

## Testes

- **bun: 103/103** (sem novos testes — reusa cálculos já cobertos). Parse na baseline.
- **Render headless (Chromium)**: os 3 estágios com números reais e setas de
  fluxo; **0 erros de JS**. Conferido (Coleta 189 pontos; Amostras tempo médio
  8,0d; Entregas 1/2 concluídas).

**PARADO** conforme a regra de implementação incremental.
