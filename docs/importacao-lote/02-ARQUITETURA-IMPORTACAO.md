# 02 — Arquitetura da Central de Lançamentos

> Como as três formas de entrada (manual · Excel/CSV · replicação/rateio) usam a
> MESMA fonte da verdade e as MESMAS regras. Implementação client-side, coerente
> com a plataforma (blob JSON em `painel_estado` — ver `01-AUDITORIA-ATUAL.md §0`).

## Princípio central (realizado)

```
manual ─┐
excel  ─┼─► LancService (validar · normalizar · fingerprint) ─► LancStore ─► D.<array> ─► commit()
replicar┘         (núcleo puro, testável)          (único ponto de escrita, auditoria)
rateio ─┘
```

Não há segunda base, nem lógica de cálculo paralela: toda entrada converge para
`LancStore.salvar(rec, tipo)`, que aplica `LancService` e grava no array do tipo.

## Componentes (blocos marcados em `index.html`, extraídos nos testes)

| Bloco | Papel | Puro? |
|---|---|---|
| `<lanc-service>` `LancService` | Registro de TIPOS + `normalizar`/`validar`/`fingerprint`/`parseData` por tipo | ✅ |
| `LancStore` | Único ponto de escrita em `D`; id + auditoria (`criadoEm/criadoPor/source`); `_lancArr` resolve caminho aninhado | ❌ (usa `D`) |
| `<import-staging>` `ImportStaging` | Parse tabular, mapeamento de colunas, classificação 🟢🔵🟡🔴🟠, dedupe | ✅ |
| `<xlsx-premium>` `XlsxPremium` | Gerador OOXML + zip próprio (modelo Excel) | ✅ |
| `<replicacao>` `Replicacao` | Plano de replicação (N lançamentos) | ✅ |
| `<rateio>` `Rateio` | Distribuição de um custo (Σ = original) | ✅ |
| `<import-hist>` `ImportHist` | KPIs + partição segura do rollback | ✅ |

## Registro de tipos (`LancService.TIPOS`)

Adicionar um tipo é declarativo: `array` (caminho, aceita aninhado como
`opColeta.lancamentos`), `label`, `campos` (schema que dirige formulário, Excel,
import e preview), `preview` (colunas do preview), e as funções puras
`normalizar/validar/fingerprint`. Hoje: `despesa` (`D.lancamentos`) e `coleta`
(`D.opColeta.lancamentos`, com o campo aninhado `colaboradores`).

## Fluxo de importação (staging → preview → append-only)

```
arquivo/colar ─► parseTabular/XLSX.read ─► mapearColunas(schema)
   ─► classificar(recs, {existentes, validos}) [EM MEMÓRIA — nada oficial ainda]
   ─► PREVIEW (🟢🔵🟡🔴🟠 + filtros)  ─► [IMPORTAR SOMENTE NOVAS]
   ─► LancStore.salvar por linha (source=excel_import, importRowKey, importBatchId)
   ─► D.importHistory (auditoria do lote)
```

Staging é **em memória** (`_impState`); o histórico persiste em `D.importHistory`.
Nenhuma tabela SQL nova (respeita a arquitetura de blob e o CLAUDE.md).

## Auditoria por registro

Todo registro criado sabe como entrou: `source` (`manual`/`excel_import`/
`replicacao`/`rateio`), `importBatchId`/`replicationGroupId`/`rateioGroupId`,
`replicatedFromId`, `criadoEm`, `criadoPor`. Isso alimenta o histórico e o rollback.
