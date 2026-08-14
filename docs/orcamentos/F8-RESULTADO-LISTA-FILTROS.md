# Orçamentos — Fase 8: Lista + "Meus Orçamentos" + filtros

Gestão da carteira de orçamentos: recortes rápidos, filtros e status. Aditivo —
nenhum cálculo/rota existente alterado.

## Objetivo realizado
1. **Tiles "Meus Orçamentos"** clicáveis (Total · Rascunhos · Aguardando ·
   Aprovados · Enviados · Negociação · Aceitos · **Expirando**).
2. **Barra de filtros**: Status · Vendedor · Cliente · Serviço · Período (Hoje/
   Semana/Mês) · Busca.
3. **Tabela rica** (web) + **cards** (mobile, via `resp-cards`).
4. **Status** manejável por linha (marcar Enviado/Negociação/Aceito/Recusado/
   Expirado), com log no histórico.

## Tiles + filtros
- Cada tile mostra a contagem e, ao clicar, filtra por aquele status (o tile
  "Total" limpa). "Expirando" = validade nos próximos 7 dias e ainda em aberto.
- `orcFiltradas()` cruza status + vendedor + cliente + serviço + período + busca;
  a lista mostra **"N de M orçamento(s)"** e um estado vazio com **limpar
  filtros**.
- Períodos por data de emissão: **Hoje** (=hoje), **Esta semana** (≤7 dias),
  **Este mês** (mesmo ano-mês). Datas em UTC, determinísticas.

## Tabela / cards
- Colunas: Número (badge **vN**), Cliente, Fazenda, Área, Serviços, Total,
  **Vendedor**, **Emissão**, **Validade** (⏳ dourado quando expira em breve),
  Status. Ações: abrir/nova versão · proposta · duplicar · histórico · ✕.
- Mobile: `resp-cards` transforma cada linha em cartão rótulo→valor.

## Status
- `orcSetStatus(id,status)` com os estados manuais (enviado · negociação ·
  aceito · recusado · expirado); registra **"status → …"** no histórico.
- Só a versão-cabeça de cada número aparece (herdado da Fase 6); a seção de
  **Aprovações comerciais** (gestor) segue no topo.

## Testes executados
- `bun test` → **143 pass / 0 fail** (motor inalterado).
- Smoke headless (tema escuro, 4 orçamentos em status variados): tiles com as
  contagens corretas; filtro por vendedor "Bruno" → 2; tile **Expirando** →
  o de validade em 3 dias; período **Hoje** → os 2 emitidos hoje; marcar
  ORC-0002 como **Em negociação** atualiza status e loga no histórico. **0 erro
  de JS** (screenshot da lista com tiles, filtros e tabela).

## Arquivos
- `index.html`: CSS de tiles/filtros; `_orcFiltro`, `qzHojeISO/qzNoPeriodo/
  qzExpirando`, `orcHeads/orcFiltradas/orcSetFiltro/orcTileFiltro/orcLimparFiltro`,
  `orcSetStatus`; `renderOrcLista` reescrito (tiles + filtros + tabela rica +
  status).
- `docs/orcamentos/F8-RESULTADO-LISTA-FILTROS.md` (este relatório).

## Riscos / rollback
- Risco baixo: só apresentação/filtragem de leitura + mudança de status manual.
  Rollback: reverter o commit volta à lista simples; dados intactos.

## Próxima fase
**Fase 9 — Dashboard comercial (gestor)**: KPIs (orçado, aceito, conversão %,
ticket médio, área, desconto médio, expirando, aguardando), funil dos orçamentos
e visão por vendedor — integrando ao funil existente, só com dados reais.
(Aguardando ordem explícita.)
