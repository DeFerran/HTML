# Orçamentos — Fase 9: Painel comercial (gestor)

Visão gerencial da carteira de orçamentos — só com dados reais. Aditivo — nenhum
cálculo/funil/rota existente alterado.

## Objetivo realizado
Um **Painel comercial** (alternância Lista ⇄ Painel na view Orçamentos) com KPIs,
o funil dos orçamentos e a visão por vendedor.

## KPIs (de `orcHeads()` — só versões-cabeça)
- **Orçamentos** (na carteira; nota de quantos aguardando aprovação).
- **Valor orçado** + **área orçada**.
- **Aceitos** (qtd, valor e área).
- **Conversão %** = aceitos ÷ propostas em jogo (enviado/negociação/aceito/
  recusado/expirado).
- **Ticket médio** (valor orçado ÷ nº com valor).
- **Desconto médio** (média do desconto efetivo vs tabela).
- **Vencendo** (validade ≤ 7 dias, em aberto).
- **Margem projetada** — **só para o gestor** (soma da margem de contribuição dos
  aceitos + % sobre a receita); vendedor não vê.

## Funil dos orçamentos
- Gráfico de **valor por estágio** (Rascunho · Aguardando · Enviado · Negociação ·
  Aceito), com contagem no tooltip.
- **Integra, não duplica**: o painel deixa explícito que os **aceitos alimentam o
  funil de vendas na conversão (Fase 10)** — não é um segundo funil de vendas.

## Por vendedor
- Tabela: Vendedor · Orçados · Valor orçado · Aceitos (qtd + valor) · **Conversão**
  · **Ticket** · **Desconto médio**, ordenada por valor orçado.

## Testes executados
- `bun test` → **143 pass / 0 fail** (motor inalterado).
- Smoke headless (6 orçamentos em status variados, Chart.js real): KPIs corretos
  (Orçamentos 6 · Orçado R$241k · Aceitos 2 · **Conversão 40%** · Ticket R$40k ·
  Desconto 6,6% · Margem R$59k/49,3%); funil renderiza; por-vendedor
  (De Ferran 50% conv · Bruno 33,3%). **0 erro de JS** (screenshot do painel).

## Arquivos
- `index.html`: `_orcVista`/`orcSetVista`/`orcVistaBar`; `renderOrcamentosView`
  despacha para `renderOrcPainel`; `renderOrcPainel` (KPIs + `cOrcFunil` + tabela
  `tOrcVend`); barra Lista/Painel no topo da Lista.
- `docs/orcamentos/F9-RESULTADO-DASHBOARD.md` (este relatório).

## Riscos / rollback
- Risco baixo: só leitura/agrupamento; margem gated por papel. Rollback: reverter
  o commit remove o painel (a lista segue). Nenhum dado muda.

## Próxima fase
**Fase 10 — Conversão orçamento → projeto/operacional**: ao **aceitar**, criar/
atualizar UMA oportunidade "Fechado" no funil existente (sem duplicar) e
**pré-preencher** os módulos operacionais (Coleta/Amostras/Entregas) com
cliente/fazenda/área/serviços/malha — o "vendedor vende X, operação recebe o
mesmo X". Encerra o ciclo Orçamento → Aprovação → Venda → Projeto AP → Coleta →
Lab → Entrega. (Aguardando ordem explícita.)
