# Lançamentos — experiência mobile (launcher de cards + drill-in) — Resultado

**Data:** 2026-08-14
**Fase:** deixar a central **Lançamentos** prática no celular, inspirado no app
de referência enviado pelo dono (grade de botões grandes + navegação em camadas).
Aditivo; **desktop sem regressão**.

## O que foi entregue

- As 12 seções de Lançamentos (Clientes, Despesas, Serviços, Funil, Preços,
  Custos, Metas, Equipe, Laboratório, Coleta, Estrutura, Operação) ganharam
  **ícone** (SVG do app).
- **Desktop:** as "pills" continuam iguais, agora com ícone (mais legível). Zero
  mudança de comportamento.
- **Celular (≤760px):** vira um **launcher em cards grandes** (grade 3 colunas,
  ~96px de altura, toque fácil) no **topo** da tela — o texto longo é ocultado.
- **Drill-in:** tocar num card abre **só aquela seção**, com uma barra sticky
  **"‹ Voltar · <Seção>"** no topo; a grade e a barra de ações somem para dar
  **foco total** ao preenchimento. Voltar retorna à grade.
- Ao entrar em Lançamentos no celular, começa **sempre na grade**.

## Como funciona (técnico)

- HTML: cada pill agora é `ícone + rótulo`; nova barra `.ed-back`.
- CSS (escopado em `#v-edit`, só no `@media ≤760px`): grid de cards, ordenação
  (grade primeiro), e estados `.sec-open` (drill-in). Nada afeta o desktop.
- JS: o clique no card entra em `sec-open` e escreve o nome na barra Voltar;
  `edCloseSec()` volta à grade; ao abrir a aba Lançamentos, reseta para a grade.
  A lógica de troca de seção existente foi **preservada** (só estendida).

## Arquivos

- `index.html` — pills com ícones + `.ed-back`; CSS do launcher/drill-in;
  handler de clique estendido + `edCloseSec()`; reset ao abrir a aba.

## Testes

- **bun: 110/110**. Parse do `index.html` na baseline.
- **Render headless (Chromium, 390px mobile)**: grade de cards no topo; tocar
  abre a seção com "Voltar · Clientes e vendas" e o botão grande "+ Adicionar
  linha"; **desktop (1200px)** mantém as pills com ícone. **0 erros de JS**.

## Próximo passo sugerido (imagem 3 — lista em cards)

Dentro de cada seção, as linhas ainda são tabela. Próxima melhoria: no celular,
transformar as linhas em **cards** (como a lista "Lançamentos" do app de
referência) para editar cada registro em tela cheia. Fica para a próxima ordem.

**PARADO** conforme a regra de implementação incremental.
