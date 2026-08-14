# Cadastros — Fase 3: Fazendas

A hierarquia que faltava: **Cliente → Fazenda → Município**. Aditivo — nenhum
cálculo, banco, rota ou regra de negócio existente foi alterado.

## Objetivo realizado
Criar o cadastro de **fazendas** (`D.fazendas`), cada uma vinculada a um
**cliente** e a um **município** por lista (sem digitar), reaproveitando os
clientes que já estão na base e sinalizando quem ainda não tem fazenda.

## Estrutura de dados (aditiva)
`D.fazendas = [{ id, nome, clienteNome, municipioNome, areaHa, ativo }]`
- `id`: estável (`'faz'+uid`), só para editar/remover.
- `nome`: nome da fazenda.
- `clienteNome`: nome do cliente dono (dropdown de `nomesClientes()`).
- `municipioNome`: município (dropdown de `nomesMunicipios()`).
- `areaHa`, `ativo`.

## O que mudou
- `hydrate`: `if(!Array.isArray(d.fazendas)) d.fazendas=[];`.
- `mergeImport`: **`fazendas`** preservado no re-import.
- Aba **Fazendas** deixa de ser placeholder → editor (`#cadFaz`).
- Novo helper `nomesClientes()` (nomes únicos de `D.clientes`, ordenados) — as
  vendas do mesmo cliente aparecem uma vez só.
- JS novo: `renderFazendasEditor()` + `novoFazForm/editarFaz/salvarFazForm/
  removerFaz`; wiring em `cadTab('faz')` e `renderConfig()`.

## Reaproveitamento dos dados existentes
- Painel no topo da aba: **"N de M clientes já na base ainda sem fazenda"** com
  um botão por cliente que **abre o formulário já com o cliente preenchido**.
- O painel encolhe conforme as fazendas são cadastradas; quando todos têm
  fazenda, mostra "Todos os M clientes já têm fazenda ✓".
- Nada é hardcoded: a lista vem de `D.clientes` (preservado no re-import).

## Trava anti-erro (assertividade)
- Cliente e município escolhidos **por dropdown** (sem digitação livre).
- **Nome da fazenda obrigatório** e **cliente obrigatório** (bloqueia salvar sem
  dono).
- **Bloqueio de duplicado**: mesmo cliente não pode ter duas fazendas com o mesmo
  nome (case-insensitive).
- Na tabela, um município que não exista mais no cadastro recebe um marcador
  `?` (prepara a checagem de órfãos da Fase 6). Município é opcional (pode
  completar depois) com aviso quando não há nenhum cadastrado.

## Arquivos modificados
- `index.html` (seed, preserve, pane Fazendas, helper + editor + CRUD, wiring).
- `docs/cadastros/03-FASE3-FAZENDAS.md` (este relatório).

## Tabelas / migrations / endpoints / tools
- Nenhuma. Só `D.fazendas` (aditivo em `D`).

## Testes executados
- `bun test` → **127 pass / 0 fail**.
- Smoke headless (Chromium real, tema escuro): com 3 clientes e 2 municípios
  semeados, o painel lista os 3 clientes sem fazenda; cadastrar "Fazenda Boa
  Vista" (Edras Soarez/Rio Verde/800 ha) persiste; **duplicado** (mesmo cliente +
  mesmo nome) **bloqueado**; salvar **sem cliente bloqueado**; após a 2ª fazenda,
  o painel encolhe para só o cliente restante. **0 erro de JS** (screenshot).

## Erros encontrados / riscos
- Nenhum erro. Risco baixo: cadastro isolado; a ligação com a receita (rollup por
  município) é a Fase 4.

## Rollback
Reverter o commit remove a aba/editor de Fazendas e o helper `nomesClientes`;
`D.fazendas` fica inócuo em `D`. Nenhum dado existente afetado.

## Próxima fase sugerida
**Fase 4 — Ligar à venda + gestão por município**: campos opcionais
`fazenda`/`municipio` na linha de venda do cliente (dropdown; escolher a fazenda
auto-preenche o município) e rollups **por município** reusando a `receita` já
existente. (Aguardando ordem explícita para iniciar.)
