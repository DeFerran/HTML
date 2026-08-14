# Cadastros — Fase 4: Ligar à venda + Gestão por município

A fase que **conecta** os cadastros de Fazenda/Município às vendas e entrega a
**gestão por município**. Só interface + campos aditivos — nenhum cálculo de
receita/margem/custo existente foi alterado (a receita continua vindo de
`ha × preço/ha`, como sempre).

## Objetivo realizado
1. Cada **venda do cliente** pode apontar uma **fazenda** (filtrada pelo próprio
   cliente) e um **município**; escolher a fazenda **auto-preenche** o município.
2. Nova visão **Gestão por município** na aba Clientes, agrupando receita, área e
   nº de clientes por município — reusando a receita que já existe.

## O que mudou
### Ligação na venda (aba Lançamentos › Clientes)
- Duas colunas novas no editor de clientes: **Fazenda** e **Município**
  (campos aditivos `cliente.fazenda` / `cliente.municipio`, default `''`).
- A **Fazenda** é um dropdown **filtrado pelo cliente da linha** (só as fazendas
  daquele cliente aparecem). Ao escolher, o **Município** é preenchido
  automaticamente a partir do cadastro de Fazendas.
- `edTable` ganhou dois hooks **aditivos e retrocompatíveis**:
  - `col.optsFor(row)` — opções por linha (dropdown dependente);
  - `col.onset(row,val)` — efeito colateral ao escolher (o auto-preenchimento do
    município). Colunas antigas (sem esses campos) seguem idênticas.

### Gestão por município (aba Clientes)
- Novo painel com **KPIs** (municípios com venda · município nº 1 · vendas sem
  município), **gráfico** de receita por município (`cMuniRec`) e **tabela**
  (`tMuni`: município · clientes · área · receita · % da carteira).
- Helper `municipioDaVenda(c)`: usa o município direto da venda ou, se vazio, o
  município herdado da fazenda escolhida. Vendas sem nenhum dos dois entram em
  **"Sem município"** com um aviso de quanto (R$) falta vincular.
- Função `renderGestaoMunicipio()` chamada dentro de `renderCli()`.

## Reaproveitamento / assertividade
- Fazenda e município escolhidos **por lista** (sem digitação livre) → ligação
  sempre válida.
- A carteira que já existe aparece imediatamente no rollup como "Sem município"
  até ser vinculada — com o total em R$ e o caminho para completar. Nada é
  perdido nem inventado.

## Arquivos modificados
- `index.html`: `edTable` (optsFor/onset), `renderCliEditor` (2 colunas + newRow),
  `hydrate` (default de `fazenda`/`municipio` na carteira), painel na view
  Clientes, `municipioDaVenda` + `renderGestaoMunicipio`, chamada em `renderCli`.
- `docs/cadastros/04-FASE4-GESTAO-MUNICIPIO.md` (este relatório).

## Tabelas / migrations / endpoints / tools
- Nenhuma. Campos aditivos em `D.clientes` (preservados no re-import — `clientes`
  já estava na lista de preservação).

## Testes executados
- `bun test` → **127 pass / 0 fail**.
- Smoke headless (Chromium real, tema escuro): com 3 vendas, 2 fazendas e 2
  municípios semeados —
  - editor mostra as colunas Fazenda/Município; a Fazenda de "Edras Soarez" só
    oferece "Fazenda Boa Vista" (filtro por cliente); escolhê-la
    **auto-preencheu Município = Rio Verde**;
  - rollup: Rio Verde R$ 60k (56,6%), Jataí R$ 40k (37,7%), Sem município R$ 6k;
    KPIs, gráfico e tabela corretos; aviso "1 venda sem município". **0 erro de
    JS** (screenshot).

## Erros encontrados / riscos
- Nenhum erro. Detalhe de UX conhecido: ao **digitar** um novo nome de cliente,
  o dropdown de Fazenda daquela linha só reflete o novo nome no próximo redraw
  (troca de um select / adicionar-remover linha). Para a carteira já existente
  (nome preenchido) funciona na hora. Baixo impacto.

## Rollback
Reverter o commit remove as 2 colunas, o painel e as funções; os hooks de
`edTable` voltam ao original. `cliente.fazenda`/`cliente.municipio` ficam inócuos
em `D`. Nenhum número existente muda.

## Próxima fase sugerida
**Fase 5 — Equipamentos/Ferramentas**: `D.equipamentos` (já semeado no hydrate)
com editor espelhando Veículos (responsável = colaborador, centro de custo) e
reativação da exibição de `veiculo.responsavel`. (Aguardando ordem explícita.)
