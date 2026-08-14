# Cadastros — Fase 1: Hub de Cadastros (esqueleto)

Primeira fase da reestruturação dos cadastros. **Só interface + duas adições
aditivas** — nenhum cálculo, banco, rota ou regra de negócio existente foi
alterado.

## Objetivo realizado
Transformar a tela **"Safras & Parâmetros"** na **base única de cadastros** da
plataforma, com abas internas, sem quebrar nada. Reunir num só lugar os
cadastros que hoje viviam espalhados e preencher o maior buraco: **Colaboradores
não tinha tela de edição** (só era derivado da Equipe).

## O que mudou (visível)
- Tela renomeada: **"Cadastros, Safras & Parâmetros"** (barra lateral, aba e H2).
- **Abas internas** (mesmo padrão de pílulas já usado em Metas): *Colaboradores ·
  Veículos · Equipamentos · Clientes · Fazendas · Municípios · Safras ·
  Parâmetros*.
- **Colaboradores** — novo editor completo (`D.colaboradores`: nome, cargo,
  centro de custo, ativo). Os nomes daqui alimentam os seletores de
  **Colaborador / Responsável / Vendedor** de toda a plataforma
  (`nomesColaboradores()`), e já aparecem **reaproveitando** o que existe na
  Equipe (derivação automática, sem nomes fixos no código).
- **Veículos** — o cadastro que estava em *Lançamentos › Despesas* foi
  **realocado** para a aba Veículos do hub (veículo é cadastro, não despesa). O
  editor é o mesmo (`renderVeiculos`), apenas em novo lugar.
- **Equipamentos / Fazendas / Municípios / Clientes** — abas presentes com aviso
  honesto (`Chega na Fase N`), **sem funcionalidade fictícia**. Clientes traz um
  botão que abre o editor atual em *Lançamentos › Clientes* (nada se perdeu).
- **Safras** e **Parâmetros** — conteúdo idêntico ao anterior, agora em abas.

## Arquivos modificados
- `index.html`:
  - CSS `.ctpane`/`.ctpane.on` (mostra/esconde abas do hub).
  - Barra lateral + aba: rótulo → "Cadastros & Parâmetros".
  - `#edVeiculos` removido de *Lançamentos › Despesas* e realocado ao hub.
  - View `#v-config` reconstruída com barra de abas + 8 painéis.
  - `mergeImport`: **`colaboradores` e `equipamentos`** adicionados à lista de
    preservação (sobrevivem ao re-import da planilha).
  - JS novo: `cadTab()` (troca de aba) e `renderColaboradoresEditor()` +
    `novoColabForm/editarColab/salvarColabForm/removerColab`.
  - `renderConfig()` passa a popular os hosts do hub (colaboradores + veículos).
- `docs/cadastros/01-FASE1-HUB.md` (este relatório).

## Tabelas / migrations / endpoints / tools
- Nenhuma tabela de banco, migration, endpoint ou tool criada.
- Dados: `D.colaboradores` e `D.equipamentos` já existiam no `hydrate` (aditivos).
  A única mudança de dados é a **preservação** deles no re-import.

## Conexões (assertividade)
- Colaborador cadastrado aqui → entra em `nomesColaboradores()` → aparece nos
  selects de Colaborador (despesas), Responsável (veículos) e é a base para
  Vendedor. Verificado em teste: "Teste QA" salvo apareceu em
  `nomesColaboradores()`.
- Veículo → o select de Veículo na Nova despesa continua lendo `D.veiculos`
  (verificado: opção "Hilux 01" presente após a realocação).

## Testes executados
- `bun test` → **127 pass / 0 fail**.
- Smoke headless (Chromium real): hub abre, 8 abas presentes, aba padrão
  Colaboradores, editor renderiza; criar colaborador persiste e entra em
  `nomesColaboradores()`; troca de abas (Veículos/Municípios/Safras) funciona;
  Veículos saiu de Lançamentos e está no hub; Lançamentos continua ativo e o
  dropdown de Veículo na despesa segue alimentado. **0 erro de JS.**

## Erros encontrados / riscos
- **Latente (a corrigir na Fase 6):** convivência de **"Anderlirio"** (sem
  acento) e **"Anderlírio"** (com acento) — visível já no cadastro derivado.
- Risco desta fase: baixo. Realocar `#edVeiculos` é seguro porque `renderVeiculos`
  encontra o host por `id` em qualquer lugar do DOM (confirmado em teste).

## Rollback
Reverter o commit: devolve `#edVeiculos` para Lançamentos, remove as abas e o
editor de Colaboradores, e restaura o H2/rótulos. Nenhum dado é perdido
(cadastros continuam em `D`).

## Próxima fase sugerida
**Fase 2 — Municípios**: `D.municipios=[{id,nome,uf,ativo}]` + default no
`hydrate` + preservação no `mergeImport` + editor na aba Municípios. Base pronta
para a gestão por município. (Aguardando ordem explícita para iniciar.)
