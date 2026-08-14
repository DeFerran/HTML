# Controle Operacional — Tela 2: Envio de Amostras — Resultado

**Data:** 2026-08-14
**Fase:** segunda das 3 telas. Aditiva; mesmo padrão da Tela 1 (estado `D`).

## O que foi entregue

- Nova aba **Envio de Amostras** (grupo "Controle Operacional" + tab + sidebar + rota).
- **Uma linha por remessa**: `Data envio · Fazenda(s) (chips) · Talhões (chips,
  3 + "…+N") · Etiquetagem (chips) · Resp. envio · Volume · Data resultado ·
  Dias · Situação`, com coluna Data fixa e rolagem horizontal.
- **Dias de análise = data resultado − data envio** (recebido) ou **dias em
  aberto = hoje − data envio** (sem resultado) — cálculo civil sem fuso.
- **Situação** derivada (não inventada): `recebido` (tem resultado) ·
  `atrasado` (sem resultado e além do prazo) · `aguardando` (demais).
- **Prazo esperado configurável** (`D.opAmostras.prazoDias`, "a validar"):
  enquanto vazio, **nada** é marcado como atrasado.
- **Cards**: Envios no período, Aguardando, Atrasados, Resultados recebidos,
  **Tempo médio de análise** (média dos dias dos recebidos).
- **Filtros**: data envio (de/até), fazenda, responsável, situação, busca
  (fazenda/talhão/observação).
- **CRUD** por modal (Novo/Editar/Excluir). Fazendas/talhões/etiquetagem entram
  por texto separado por vírgula e viram chips na tabela.
- Legenda com o significado das cores e da coluna Dias.

## Regras "a validar" honradas

- **Prazo esperado de resultado:** configurável na tela (não fixei valor).
- **"Arquivo na Máquina":** deixado de fora até o dono definir o significado
  (data, prazo ou status) — não foi inventado.

## Arquivos

- `index.html` — view `#v-opamostras` + modal; `D.opAmostras` (migração);
  bloco puro `// <op-amostras-calc>`; runtime `renderOpAmostras` + CRUD +
  configuração de prazo; tab/sidebar/rota.
- `tests/opamostras.test.ts` — 8 testes (diff de dias civil, situação, dias da
  remessa, agregados/tempo médio, filtros, mapeamento de situação).

## Testes

- **bun: 93/93** (+8 desta tela). Parse do `index.html` na baseline.
- **Render headless (Chromium)**: cards, tabela com chips e "…+N", situação por
  cor e legenda; **0 erros de JS**. Cálculo conferido (remessa recebida
  03→11/02 = 8 dias → tempo médio 8,0; 2 abertas além do prazo → atrasadas).

## Próxima tela (aguardando ordem)

- **Tela 3 — Controle de Entregas** (matriz/checklist por cliente/fazenda com
  itens Prop. químicas · Mapas · Calcário · Fósforo · Potássio(KCL) · MIB +
  progresso automático por linha). Pontos a confirmar: Média MIB (padrão ou
  calculado?) e títulos das colunas.

**PARADO** conforme a regra de implementação incremental.
