# 12 — Fechamento: Tabelas & Gráficos (dimensões < 85 → ≥ 85)

Últimas duas dimensões abaixo de 85/100 no placar de UX. Só interface —
**nenhum cálculo, banco, rota ou regra de negócio foi tocado.** As fontes de
dados e as funções continuam idênticas; mudou apenas *como* o mesmo número é
apresentado.

---

## A) Tabelas — resumo + [Ver detalhes] no celular

### Problema (TOP 20 #17)
As três tabelas **operacionais** — Coleta, Amostras e Entregas — rolavam de lado
no celular (`op-scroll`, `overflow-x:auto`). Ler uma matriz densa com uma mão, no
campo, rolando lateralmente, é desconfortável (auditoria Mobile, UX-P2).

### Solução
Padrão **card por linha** no celular, mantendo a tabela intacta no desktop:
- Após cada `op-scroll` foi adicionada uma lista de cards
  (`#opColCardlist` / `#oaCardlist` / `#oeCardlist`).
- `renderOpColeta` / `renderOpAmostras` / `renderOpEntregas` passaram a montar,
  além da `<table>` já existente, uma lista `.op-lcard` com **resumo**
  (título + 2–3 campos-chave) e botão **[Ver detalhes]** que abre o mesmo modal
  de edição já usado hoje (mesma função, mesmo fluxo — zero mudança de lógica).
- CSS: `.op-cardlist{display:none}` no desktop; em `@media(max-width:767px)` a
  tabela some e a lista de cards aparece, via
  `.op-tbl-wrap:has(.op-cardlist) .op-scroll{display:none}`.
- A tabela de **produtividade** (sem `op-cardlist`) segue como tabela — o
  seletor `:has()` isola só as três operacionais.

### Preservado
- A `<table>` original continua no DOM (fonte da verdade visual no desktop).
- O modal de edição é o mesmo; nenhuma coluna, cálculo ou coleta mudou.
- `resp-cards` e `wrapTables()` (rede de segurança) seguem valendo para as demais.

---

## B) Gráficos — um ranking por conceito (fim da repetição entre telas)

### Problema (TOP 20 #19)
O mesmo ranking aparecia em várias telas: **cliente por receita** e
**receita por serviço** repetidos em Visão Geral **+** a tela dona, além de
**categoria 2×** na financeira. Ver o mesmo ranking no dashboard de decisão e de
novo na tela específica gera o "qual é o número certo?" (auditoria Gestor).

### Solução — cada ranking mora só na sua tela dona
| Ranking | Antes (repetido em) | Depois (tela dona única) |
|---|---|---|
| Custo por categoria (financeiro) | `cCat` (barra) + `cCatPie` (rosca) | só `cCat` — rosca removida *(Fase 3c)* |
| Top clientes por receita | `cTopCli` (Visão Geral) + `cCliRec` (Metas/Margem) | só `cCliRec` |
| Receita por serviço | `cTopServ` (Visão Geral) + `cServ` (Serviços) | só `cServ` (com comparativo 25/26) |

A **Visão Geral** deixou de repetir rankings — virou tela de **decisão** (faixa
herói + cascata da margem + linha do tempo de caixa + sensibilidade). Quem quer
o ranking vai à tela dona, onde ele é mais completo.

### Mantidos de propósito (não são duplicata)
- **`cServPie` (Mix de receita 26/27)** e **`cServ` (comparativo 26/27 vs 25/26)**
  coexistem na **mesma** tela de Serviços: são **leituras complementares**
  (concentração × evolução), não o mesmo gráfico repetido em telas diferentes.
- **`cRecServCli` (Receita lançada por serviço, tela Clientes)** vem de **outra
  fonte** (lançamentos por cliente) e alimenta a **reconciliação**
  (`renderReconcilia`) — tem função de cruzamento, não de repetição.

### Preservado
- Nenhuma função de cálculo de receita/margem/custo foi alterada.
- Só foram removidos os `<canvas>` e as chamadas `mk()` dos gráficos duplicados
  na Visão Geral (código morto substituído por comentário explicativo).

---

## Testes
- `bun test` → **127 pass / 0 fail** (nenhuma lógica de negócio testada mudou).
- Smoke headless (Chromium):
  - Tabelas: no celular (≤767px) as 3 tabelas operacionais mostram cards e a
    tabela some; no desktop a tabela aparece e os cards somem; a tabela de
    produtividade permanece tabela; o card abre o modal de edição.
  - Gráficos: Visão Geral renderiza sem `cTopCli`/`cTopServ` (canvas ausentes),
    `callGeral` intacto, **0 erro de JS**.

## Riscos / rollback
- Risco baixo: mudanças puramente de apresentação, aditivas no DOM.
- Rollback: reverter o commit restaura os canvas/`mk()` removidos e retira as
  listas de card (a `<table>` operacional nunca saiu).

## Resultado no placar
Com Tabelas e Gráficos fechados, todas as dimensões da auditoria de UX passam a
ficar **≥ 85/100**.
