# 03 — Modelos Excel premium

> Gerados por `XlsxPremium` (bloco `<xlsx-premium>`) — OOXML + zip próprio,
> **sem biblioteca nova** (o SheetJS comunitário não escreve estilo/dropdown/
> congelamento). `modeloSpec(tipo)` monta o modelo a partir do schema do tipo.

## Por que gerar OOXML à mão

O `xlsx` (SheetJS) já carregado **lê** planilhas, mas a build comunitária **não
grava** cor de célula, validação (dropdown) nem congelamento. Para entregar o
modelo premium sem adicionar dependência (CLAUDE.md; e sem agravar o SEC-017),
`XlsxPremium` escreve os XML do pacote e um zip STORE com CRC32.

## Estrutura (4 abas)

| Aba | Conteúdo |
|---|---|
| `01_INSTRUÇÕES` | Título, tipo, empresa (DF AGRO), data, **`template_version`**, passos, legenda OBRIGATÓRIO/OPCIONAL/AUTOMÁTICO |
| `02_LANÇAMENTOS` | Cabeçalho do schema (obrigatórios marcados), 200 linhas estilizadas destravadas, coluna de sistema `import_row_key` (oculta/protegida), congelamento + autofiltro + **dropdowns** |
| `03_REFERÊNCIAS` | Snapshot dos cadastros reais + **intervalos nomeados** (fonte dos dropdowns) |
| `04_EXEMPLO` | Linhas ilustrativas |

## Recursos premium suportados

- Identidade **verde DF AGRO** (`#0A6A30`), cabeçalho, bandas alternadas.
- Formatos: **moeda** (`"R$" #,##0.00`) e **data** (`dd/mm/yyyy`).
- **Congelamento** do cabeçalho, **autofiltro**, **proteção** (sistema travado,
  entrada destravada — proteção do Excel é conveniência, não segurança).
- **Validação/dropdown** por intervalo nomeado (cadastros) ou lista inline
  (constantes: naturezas, formas, status). `showErrorMessage=0` → dropdown suave
  (não bloqueia digitação livre — o backend é a autoridade).

## Genérico por tipo

`modeloSpec(tipo)` deriva referências e validações do `campos` do tipo:
`FONTE_INLINE` (constantes → lista inline) vs registros (→ intervalo nomeado),
`FONTE_LABEL`/`FONTE_RANGE`. Adicionar tipo ao registro gera o modelo sem código
novo. `baixarModelo(tipo)` faz o download (`Modelo - <Tipo>s - DF AGRO.xlsx`).

## Validação de que abre no Excel

Cross-validado com o **SheetJS real**: o arquivo gerado é relido sem erro
(4 abas, nomes com acento, autofiltro, intervalos nomeados, **round-trip ok**) e
todo CRC do zip confere (ver `tests/xlsxpremium.test.ts`).

## Versão do template

`TEMPLATE_VERSAO[tipo]` (ex.: `despesa-v1`, `coleta-v1`). Na importação, se a
versão do arquivo diferir da atual, a plataforma mostra "modelo desatualizado"
com **Baixar modelo atual** + **Conferir assim mesmo** — não importa
silenciosamente estrutura incompatível.
