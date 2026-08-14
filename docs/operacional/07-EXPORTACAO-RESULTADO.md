# Controle Operacional — Exportar (CSV) — Resultado

**Data:** 2026-08-14
**Fase:** implementa o botão **"Exportar"** que aparece nas 3 telas do protótipo.
Aditivo; front-end; nenhuma dependência externa.

## O que foi entregue

- Botão **⬇ Exportar** nas 3 telas (Coleta, Amostras, Entregas).
- Exporta **o que está na tela** (respeita os filtros ativos) para **CSV**
  (separador `;` — padrão do Excel pt-BR — e BOM UTF-8 para acentos). Abre direto
  no Excel/planilhas, coerente com a origem em Excel.
- Colunas por tela:
  - **Coleta**: Data, Equipe, Cliente, Fazenda, Talhão, Fator, Colaboradores/Pontos,
    Total, Status, Observações.
  - **Amostras**: Data envio, Fazendas, Talhões, Etiquetagem, Resp. envio, Volume,
    Arquivo na máquina (status), Data resultado, Dias, Situação.
  - **Entregas**: Cliente, Fazenda, Área, e cada entregável (média + status),
    Progresso %.
- Download via Blob (mesmo padrão do "Baixar painel" já existente no app).

## Arquivos

- `index.html` — bloco puro `// <op-csv>` (`opToCsv`); `opDownload` + os 3
  exportadores (`opColetaExportar`/`opAmExportar`/`opEnExportar`); botões nas views.
- `tests/opcsv.test.ts` — 4 testes (separador/CRLF, escape de aspas/`;`/quebra,
  nulos→vazio, matriz vazia).

## Testes

- **bun: 107/107** (+4). Parse do `index.html` na baseline.
- **Behavior test (Chromium headless)**: as 3 exportações geram o CSV correto
  (conferido o conteúdo — chips "nome: pontos", status "Colocado"/"Resultado
  recebido", matriz de entregas com Progresso 80%). **0 erros de JS**.

**PARADO** conforme a regra de implementação incremental.
