# Controle Operacional — Importar (CSV) — Resultado

**Data:** 2026-08-14
**Fase:** complemento do Exportar — traz dados de volta do Excel (ida e volta).
Aditivo, seguro (modo **adicionar**, com confirmação; nada é apagado).

## O que foi entregue

- Botão **⬆ Importar** nas 3 telas (Coleta, Amostras, Entregas).
- Lê um **CSV no formato do próprio Exportar** (round-trip): o dono exporta, edita
  no Excel e reimporta. As linhas são **ADICIONADAS** às existentes (nunca
  sobrescreve nem apaga), com **confirmação** mostrando a contagem.
- Mapeamento por **nome de coluna** (tolerante a ordem); colunas derivadas
  (Total, Dias, Situação, Progresso) são ignoradas na importação.
- Conversões: status por rótulo → chave; colaboradores `nome: pontos | …`;
  fator/média aceitam vírgula decimal; listas (fazendas/talhões/etiquetagem)
  separadas por `|`.

## Segurança / invariantes

- **Somente adiciona** (concat) — coerente com o CLAUDE.md (sem DELETE/overwrite).
- Persiste via `commit()` (sincronização existente). Linhas sem a chave
  obrigatória (Data / Data envio / Cliente) são descartadas.

## Arquivos

- `index.html` — `opParseCsv` no bloco `// <op-csv>`; `opReadFile` + os 3
  importadores (`opColImport`/`opAmImport`/`opEnImport`) e triggers de arquivo;
  botões nas views.
- `tests/opcsv.test.ts` — +3 testes (parse com cabeçalho/BOM/linhas vazias,
  campos com aspas/`;`/quebra, **round-trip** `opParseCsv(opToCsv(...))`).

## Testes

- **bun: 110/110** (+3). Parse do `index.html` na baseline.
- **Behavior test (Chromium headless)**: exportar → limpar → importar reconstrói
  os dados fielmente (Coleta: fator/status/colaboradores; Entregas: área + itens
  com média/status). **0 erros de JS**.

**PARADO** conforme a regra de implementação incremental.
