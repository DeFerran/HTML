# Cadastros — Fase 6: Assertividade (trava anti-erro)

A fase que fecha a "conexão assertiva" de ponta a ponta. Só interface + uma
normalização de grafia — nenhum cálculo, banco, rota ou regra de negócio
existente foi alterado.

## Objetivo realizado
1. **Painel de integridade** (órfãos): mostra, no topo do hub, todo nome usado
   nas telas que **não existe** nos cadastros.
2. **Cascata de renome**: renomear um item de cadastro atualiza automaticamente
   todas as referências por nome.
3. **Normalização "Anderlirio" → "Anderlírio"**: o mesmo colaborador não vira
   mais dois nomes diferentes nos gráficos.

## 1. Painel de integridade (`renderIntegridade`)
- Aparece acima das abas do hub. Varre a plataforma e agrupa as ligações
  quebradas por tipo:
  - Vendedor (vendas) fora do cadastro de Colaboradores;
  - Colaborador / Centro de custo / Categoria / Serviço / Cliente / Veículo
    (despesas) fora do cadastro;
  - Responsável (veículo/equipamento) fora do cadastro;
  - Município / Fazenda (vendas) fora do cadastro;
  - Fazenda → cliente/município inexistente.
- Só sinaliza valores **não vazios** que não batem (ex.: `vendedor='A definir'`
  não conta). Quando está tudo certo, mostra "✓ Cadastros íntegros".
- Cada item vira um chip `valor · N×` (quantas vezes aparece), com um botão
  **ver detalhes / ocultar** e um guia de como resolver.
- **Read-only**: apenas diagnostica, não altera nada sozinho.

## 2. Cascata de renome
- Ao **editar** o nome de um item de cadastro, as referências por nome são
  atualizadas automaticamente e um toast informa quantas (`✓ … · N referência(s)
  atualizada(s)`).
- Implementada para:
  - **Colaborador** → despesas (`lancamento.colaborador`), vendas
    (`cliente.vendedor`), veículos (`responsavel`), equipamentos (`responsavel`),
    funil (`vendedor`) e coleta operacional (`opColeta…colaboradores[].nome`).
  - **Município** → `cliente.municipio` e `fazenda.municipioNome`.
  - **Fazenda** → `cliente.fazenda` (das vendas daquele cliente).

## 3. Normalização "Anderlirio" → "Anderlírio"
- Migração idempotente no `hydrate`: corrige a grafia em vendas, funil,
  colaboradores, equipe, veículos, equipamentos e despesas.
- Literais atualizados: seed da Equipe, dropdowns de Vendedor (clientes e funil),
  ordem/cores do gráfico de receita por vendedor.
- **Sem impacto em cálculo**: a comissão já casava por regex (`/anderl/i`); a
  correção só evita que o gráfico de vendedor trate acentuado e não-acentuado
  como duas pessoas. Identificadores de código (`comRatesAnderlirio`) foram
  mantidos.

## Arquivos modificados
- `index.html`: host `#cadIntegridade` no hub; `nomesServicos()`,
  `_cascadeColaborador/_cascadeMunicipio/_cascadeFazenda`, `renderIntegridade` +
  `toggleInteg`; hooks de cascata em `salvarColabForm/salvarMuniForm/
  salvarFazForm`; migração Anderlírio + literais; chamada em `renderConfig`.
- `docs/cadastros/06-FASE6-ASSERTIVIDADE.md` (este relatório).

## Tabelas / migrations / endpoints / tools
- Nenhuma. Só lógica de interface + normalização de grafia em `D`.

## Testes executados
- `bun test` → **127 pass / 0 fail**.
- Smoke headless (Chromium real, tema escuro):
  - Normalização: `hydrate` converte `Anderlirio`→`Anderlírio` em vendas, equipe
    e veículos;
  - Integridade: detecta 5 tipos de órfão (vendedor Fantasma, colaborador
    Ninguém, serviço ZZZ, centro Centro Zumbi, município Nárnia);
  - Cascata: renomear "Bruno"→"Bruno Silva" propaga para `veiculo.responsavel`.
  - **0 erro de JS** (screenshot do painel).

## Erros encontrados / riscos
- Nenhum erro. Risco baixo: painel é read-only; a cascata só roda em edição
  explícita de nome; a normalização é idempotente e sem efeito em cálculo.

## Pendência assumida (Fase 6b, opcional)
- Trocar o campo de **fazenda** nos módulos operacionais (Coleta/Amostras/
  Entregas) de texto livre para **datalist** sugerindo as fazendas cadastradas —
  ficou de fora para manter esta fase pequena. Fica como próxima melhoria
  pequena, se desejar.

## Rollback
Reverter o commit remove o painel de integridade, os hooks de cascata e a
normalização (dados já normalizados permanecem — a migração é inócua ao rodar de
novo). Nenhum número existente muda.

## Conclusão do ciclo de cadastros
Fases 1–6 entregues: hub único, colaboradores, veículos (com responsável),
equipamentos, municípios, fazendas (cliente→fazenda→município), ligação na venda,
gestão por município e a trava de assertividade (dropdowns + cascata + painel de
órfãos). A base de cadastros está estruturada e conectada de ponta a ponta.
