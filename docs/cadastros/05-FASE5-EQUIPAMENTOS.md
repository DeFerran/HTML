# Cadastros — Fase 5: Equipamentos & Ferramentas

Último cadastro que faltava, mais a reativação de um vínculo que já existia mas
estava morto. Aditivo — nenhum cálculo, banco, rota ou regra de negócio existente
foi alterado.

## Objetivo realizado
1. Editor de **Equipamentos & ferramentas** (`D.equipamentos`) na aba
   Equipamentos, com **responsável** (colaborador) e **centro de custo** por
   lista dos cadastros.
2. **Reativação** da coluna **Responsável** no cadastro de Veículos — o campo
   `veiculo.responsavel` já existia mas não aparecia em lugar nenhum.

## Estrutura de dados (aditiva)
`D.equipamentos = [{ id, nome, tipo, responsavel, centroCusto, situacao, ativo }]`
- `tipo`: Equipamento · Ferramenta · Coletor · Máquina/Implemento · Outro.
- `responsavel`: colaborador (dropdown de `nomesColaboradores()`).
- `centroCusto`: dropdown de `nomesCentros()`.
- `situacao`: Em uso · Em manutenção · Parado · Emprestado · Baixado.
- `ativo`: Sim/Não.
(`D.equipamentos` já era semeado no `hydrate` e já era preservado no
`mergeImport` desde a Fase 1.)

## O que mudou
- Aba **Equipamentos** deixa de ser placeholder → editor (`#cadEquip`).
- JS novo: `renderEquipamentosEditor()` + `novoEquipForm/editarEquip/
  salvarEquipForm/removerEquip`; wiring em `cadTab('equip')` e `renderConfig()`.
- `renderVeiculos`: nova coluna **Responsável** na tabela (reusa
  `veiculo.responsavel`, que já era editável no formulário).

## Trava anti-erro (assertividade)
- Responsável e centro de custo **por dropdown** (sem digitação livre).
- Na tabela, um responsável que não exista mais no cadastro de Colaboradores
  recebe o marcador `?` (mesma checagem visual das fazendas — prepara o painel
  de órfãos da Fase 6). Idem para o responsável do veículo.

## Arquivos modificados
- `index.html`: pane Equipamentos, editor + CRUD, wiring, coluna Responsável em
  `renderVeiculos`.
- `docs/cadastros/05-FASE5-EQUIPAMENTOS.md` (este relatório).

## Tabelas / migrations / endpoints / tools
- Nenhuma. `D.equipamentos` (aditivo, já existente em `D`).

## Testes executados
- `bun test` → **127 pass / 0 fail**.
- Smoke headless (Chromium real, tema escuro): criar "Trado holandês 01"
  (Ferramenta/Bruno/Coleta) e "Penetrômetro" (Equipamento/De Ferran) — persistem;
  a tabela de Veículos passa a exibir a coluna **Responsável** com "Bruno" no
  Hilux 01. **0 erro de JS** (screenshot).

## Erros encontrados / riscos
- Nenhum erro. Risco baixo: cadastro isolado; o vínculo com despesas (custo por
  equipamento, análogo ao custo/km dos veículos) não foi incluído de propósito
  para manter a fase pequena — pode entrar como melhoria futura.

## Rollback
Reverter o commit remove a aba/editor de Equipamentos e a coluna Responsável dos
veículos; `D.equipamentos` fica inócuo em `D`. Nenhum dado existente afetado.

## Próxima fase sugerida
**Fase 6 — Trava anti-erro (assertividade)**: renome com **cascata** para as
referências por nome, **painel de órfãos** (nomes usados em lançamentos/vendas
que não existem no cadastro), dropdown de fazenda nos módulos operacionais (hoje
texto livre) e correção do **"Anderlirio"/"Anderlírio"**. (Aguardando ordem
explícita para iniciar.)
