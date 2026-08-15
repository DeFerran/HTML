# 09 — Testes

Suíte `bun test` — **245 pass / 0 fail** (25 arquivos). Os núcleos são puros e
extraídos por marcadores `// <bloco> … // </bloco>` do `index.html`. Além dos
unitários, cada fase teve verificação de **runtime** (Playwright, origem roteada
`app.local` para localStorage) e **sweep** dos 26 módulos (22/22 sem erro).

## Cobertura por arquivo (novos nesta iniciativa)

| Arquivo | Cobre |
|---|---|
| `lancservice.test.ts` | normalização, validação `valor>0`, fingerprint, passthrough |
| `importstaging.test.ts` | parse TSV/CSV, mapeamento, 5 status, dedupe no arquivo, sugestão de typo, reconciliação Σ=total |
| `xlsxpremium.test.ts` | crc32, colName, xmlEsc, zip válido (PK/EOCD), congelamento/autofiltro/proteção/validação, container com CRC íntegro |
| `replicacao.test.ts` | multiplica (3=3000), destino, valor por destino, 1/10/100, reconciliação |
| `rateio.test.ts` | igual, %40/30/30, 99,99% e 100,01% falham, valor, hectare, Σha=0, arredondamento, zero |
| `coleta.test.ts` | tipo aninhado (colaboradores), status, fator, data obrigatória, fingerprint ordem-insensível, classificação softLista |
| `importhist.test.ts` | pertence (3 origens), particionar (mantém editados), kpis |
| `cenarios.test.ts` | parseData BR/ISO/inválida, data BR→ISO, arquivo vazio, coluna renomeada/removida, data inválida, reconciliação não-mutante |

## Cenários do prompt → onde ficaram

**Importação:** arquivo correto (runtime) · arquivo vazio (`cenarios`) · template
antigo (runtime gate de versão) · coluna removida/renomeada (`cenarios`) · data
inválida (`cenarios`) · valor inválido (`importstaging`/`lancservice`) · cliente
inexistente + sugestão (`importstaging`) · duplicidade no arquivo (`importstaging`)
· registro já existente/reupload (`importstaging` + runtime) · possível
duplicidade (`importstaging`) · clique duplo (guarda `_impBusy`, runtime) · tenant
alheio (N/A single-tenant — ver 08).

**Replicação:** 1/10/100 destinos, valor por destino, campo não copiado, zero,
reconciliação (`replicacao`) · duplo clique (guarda `_repBusy`).

**Rateio:** igual/%/valor/hectare, arredondamento, 100%/99,99%/100,01%, zero
(`rateio`) · duplo clique (guarda `_ratBusy`).

**Reconciliação:** import não altera existentes (`cenarios`) · rateio Σ=original
(`rateio`) · replicação nº destinos = nº criado (`replicacao`) · rollback só
remove intactos (`importhist` + runtime: editado é mantido).

## Rodar

```
bun test                      # suíte completa
bun test tests/rateio.test.ts # um arquivo
```
