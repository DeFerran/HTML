# Cadastros — Fase 2: Municípios

Nova dimensão de cadastro, base para a **gestão por município**. Aditivo — nenhum
cálculo, banco, rota ou regra de negócio existente foi alterado.

## Objetivo realizado
Criar a base de **municípios** (`D.municipios`) com editor próprio na aba
Municípios do hub. É a dimensão que faltava para, nas próximas fases, ligar
fazenda → município e fazer os rollups por município.

## Estrutura de dados (aditiva)
`D.municipios = [{ id, nome, uf, ativo }]`
- `id`: estável (`'mun'+uid`), usado só para editar/remover dentro do cadastro.
- `nome`: chave de junção (padrão da plataforma — ligação por nome).
- `uf`: seleção entre as 27 UFs (sem digitação livre → sem typo).
- `ativo`: Sim/Não (inativos não aparecem em `nomesMunicipios()`).

## O que mudou
- `hydrate`: `if(!Array.isArray(d.municipios)) d.municipios=[];` (default vazio).
- `mergeImport`: **`municipios`** adicionado à lista de preservação (sobrevive ao
  re-import da planilha).
- Aba **Municípios** deixa de ser placeholder e passa a ter o editor
  (`#cadMuni`).
- Novo helper `nomesMunicipios()` (municípios ativos) — será consumido pelo
  cadastro de Fazendas (Fase 3) e pela gestão por município (Fase 4).
- JS novo: `renderMunicipiosEditor()` + `novoMuniForm/editarMuni/salvarMuniForm/
  removerMuni`; `cadTab('muni')` e `renderConfig()` passam a renderizá-lo.

## Trava anti-erro (assertividade)
- UF por **select** das 27 UFs.
- **Bloqueio de duplicado** por nome+UF (case-insensitive): tentar cadastrar
  "rio verde/GO" quando já existe "Rio Verde/GO" é recusado com aviso.
- Nome é normalizado com `trim()` ao salvar.

## Arquivos modificados
- `index.html` (seed no hydrate, preserve no mergeImport, pane Municípios,
  helper + editor + CRUD, wiring em cadTab/renderConfig).
- `docs/cadastros/02-FASE2-MUNICIPIOS.md` (este relatório).

## Tabelas / migrations / endpoints / tools
- Nenhuma. Só `D.municipios` (aditivo em `D`).

## Testes executados
- `bun test` → **127 pass / 0 fail**.
- Smoke headless (Chromium real): abrir aba Municípios, criar "Rio Verde/GO" e
  "Jataí/GO" (persistem e entram em `nomesMunicipios()`), duplicado
  "rio verde/GO" **bloqueado**, lista ordenada alfabeticamente, troca de abas
  OK. **0 erro de JS.** Verificado em tema escuro (screenshot).

## Erros encontrados / riscos
- Nenhum erro. Risco baixo: dimensão nova, isolada, sem consumidores ainda além
  do próprio cadastro (as ligações entram nas Fases 3–4).

## Rollback
Reverter o commit remove a aba/editor de Municípios e o helper; `D.municipios`
fica órfão em `D` (inócuo). Nenhum dado existente é afetado.

## Próxima fase sugerida
**Fase 3 — Fazendas**: `D.fazendas=[{id,nome,clienteNome,municipioNome,areaHa,
ativo}]` com editor (dropdowns de cliente e de município — sem digitar), listando
automaticamente os clientes já existentes e sinalizando quem ainda não tem
fazenda. (Aguardando ordem explícita para iniciar.)
