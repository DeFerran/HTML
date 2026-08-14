# 07 — Correções Aplicadas

Somente correções **seguras** (causa comprovada, solução inequívoca, baixo
risco, testável, rollback simples). Todas **apenas no frontend** (`index.html` +
testes). Banco, RLS e auth **não** foram tocados.

## Resumo

| # | Prior. | Arquivo:local | Antes → Depois | Teste |
|---|--------|---------------|----------------|-------|
| I-01 | P0 🚨 | `index.html` `mergeImport` | lista de preservação não tinha o Controle Operacional nem metas/preços por safra → import da planilha **apagava tudo** → agora preserva `opColeta/opAmostras/opEntregas/metasSafra/precosSafra` | `tests/importmerge.test.ts` (4) + smoke |
| I-02 | P1 🔴 | `index.html` `opEnImport` + novo `opNum()` no bloco `<op-csv>` | `String(area).replace(/[^\d]/g,'')` (destruía decimais) → `opNum()` pt-BR (`1.234,5`→1234.5, vazio→'') | `tests/opcsv.test.ts` (3) |
| I-03 | P1 🚨 | `opEnExportar`, `opAmExportar`, `opEnImport`, `opAmImport` | coluna **Observações** ausente no export e ignorada no import → agora exportada e relida (round-trip fiel) | smoke round-trip |
| I-04 | P2 🟡 | `OpAmostrasCalc.agg` | `tempoMedio` somava dias negativos → exclui `d<0` | `tests/opamostras.test.ts` (1) |
| I-05 | P2 🟡 | `BRL`/`BRLk`/`PCT` (formatadores) | `R$ NaN`/`Infinity%` quando base=0 → NaN/Infinity viram 0 | `tests/formatadores.test.ts` (2) |

## Detalhe

### I-01 — Perda de dados na importação (P0, o mais crítico)
`parseWB()` não produz `opColeta/opAmostras/opEntregas/metasSafra/precosSafra`;
`mergeImport()` não os preservava; `hydrate()` recriava vazios. Resultado:
**importar a planilha GESTÃO_AP apagava todo o Controle Operacional e as edições
de metas/preços por safra.** Correção: incluí-los na lista de preservação (mesma
mecânica dos demais cadastros manuais). Comprovado por unit test (merge+hydrate
mantêm os dados) e por smoke headless (import simulado preserva tudo).

### I-02 — Área corrompida no import de Entregas (P1)
O próprio Exportar grava a área como número cru (`1234.5`); o import fazia
`/[^\d]/g` e virava `12345` (10× errado); área digitada em pt-BR (`1.234,5`)
idem. Novo helper **puro e testado** `opNum()` (mesma convenção do `pnum` do app)
resolve os dois casos e preserva vazio ("a validar").

### I-03 — Observações somem no round-trip (P1)
`obs` era gravado no cadastro mas **nunca exportado**, e o import forçava
`obs:''`. Adicionada a coluna "Observações" no export de Entregas e Amostras e a
leitura no import das duas. Round-trip export→import agora preserva obs.

### I-04 — Tempo médio com dias negativos (P2)
Se a data de resultado ficava antes do envio (erro de digitação), `diffDias` dava
negativo e puxava a média. Agora só entram dias `>= 0`.

### I-05 — Divisão por zero nos formatadores (P2)
Vários KPIs fazem `PCT(x/receita)`. Com receita 0, saía `Infinity%`/`NaN`.
Formatadores agora tratam não-finito como 0 — corrige **todos** os call sites de
uma vez (single source), sem alterar nenhum valor finito.

## Correção de backend (autorizada em separado): D-03

| # | Prior. | Arquivo:local | Antes → Depois | Teste |
|---|--------|---------------|----------------|-------|
| I-08 / D-03 | P1 🔴 | `supabase/functions/ai-gateway/tools/read_tools.ts` `get_costs` | **total** vinha de `bi_custos_mensais` (zerada) → IA reportava **custo R$ 0**. Agora o **total** e o **por categoria** vêm de `bi_custo_categoria` (reconcilia: 2026 = **R$ 908.726,57**); o **por mês** só aparece se o espelho mensal tiver dados, senão é **omitido com aviso** (nunca "R$ 0 em todo mês"). | `read_tools.test.ts` (+3: total pela categoria, espelho zerado→aviso, filtro por categoria) |

**Verificado com dados reais:** `get_costs(2026)` passa a devolver total
R$ 908.726,57, 24 categorias, `por_mes` omitido com aviso (espelho mensal = 0),
real vs projetado 908.726,57 × 1.193.135,52.
**Pendente:** deploy da edge function `ai-gateway` (rede bloqueada neste
ambiente). O código está corrigido, tipado e testado.

## Verificação

- **bun test:** 122 passam (110 + 10 frontend + 3 backend get_costs − ajuste), 0 falhas.
- **Smoke headless (Chromium):** 4 telas operacionais renderizam; round-trip
  obs+área ok; `mergeImport`+`hydrate` preservam operacional/metas/preços;
  **0 erros de JS**.

## Rollback

Tudo num único commit de correção. Reverter = `git revert <hash>` (ou `git
checkout` do `index.html` anterior). Sem migração de banco envolvida → rollback
trivial e sem risco a dados existentes.

## O que **não** foi corrigido (por regra)

`recBruta` índice fixo (I-06), base de comissão da linha 2452 (I-07),
`bi_custos_mensais`/`bi_metas` (I-08/09), andamento×pendente (I-10), hectares
divergentes (I-12) → **necessitam decisão** (08-MANUAL-DECISIONS.md).
