# Orçamentos — Fase 4 (Mobile): resultado

Refino da ergonomia do wizard no celular (o vendedor no campo). Só interface — o
motor, os dados e o fluxo da Fase 3 permanecem iguais; nenhum cálculo/rota/regra
existente foi alterado.

## Objetivo realizado
Transformar o wizard responsivo em uma experiência **passo-a-passo foco total** no
celular: uma etapa por tela, botões grandes, **total corrente fixo no rodapé** e
proteção contra envio duplicado.

## O que mudou (só no mobile, via CSS `@media(max-width:899px)` + HTML condicional)
- **Stepper compacto**: as 6 pílulas do desktop dão lugar a um indicador
  **"Passo N de 6" + nome da etapa + barra de progresso** (`.orc-mobstep`), com um
  atalho **"‹ voltar"** para a etapa anterior. As pílulas continuam no desktop.
- **Resumo lateral escondido** no celular (era longo); no lugar entra a **barra
  inferior fixa** (`.orc-bottombar`, `position:sticky;bottom:0`) com o **total
  corrente** ("TOTAL · N serv. · R$ X") e a ação primária **Continuar › / Gerar
  orçamento** — sempre ao alcance do polegar.
- **Cards de serviço em 2 colunas** no celular (toque confortável), botões/chips
  já ≥ 46px (malha, profundidade, condição, área inteira).
- O resumo completo continua aparecendo **no corpo** na etapa Resumo.

## Robustez
- **Anti-duplo-envio**: `qzGerar` protegido por flag `_qzGerando` — clicar duas
  vezes gera **um** orçamento, não dois (verificado).
- Rascunho auto-salvo a cada passo (herdado da Fase 3) já cobre "perder por
  internet ruim / fechar sem querer".
- `inputmode` numérico em Área e Validade (teclado numérico no celular).

## Testes executados
- `bun test` → **138 pass / 0 fail** (motor inalterado).
- Smoke headless (Chromium, 390px, tema escuro): no wizard mobile —
  pílulas ocultas, indicador "Passo 3 de 6 · Serviços" com barra a 50%, resumo
  lateral oculto, barra inferior visível com total R$ 93.750; **sem scroll
  horizontal**; **duplo `qzGerar` → 1 orçamento**. **0 erro de JS** (screenshots
  do wizard e da lista mobile).

## Arquivos
- `index.html`: CSS mobile (`.orc-mobstep`, `.orc-bottombar`, cards 2-col);
  `qzBottomBarHTML`; `qzRefreshSummary` atualiza também o rodapé; `renderOrcWizard`
  injeta indicador + barra inferior; guarda `_qzGerando` em `qzGerar`.
- `docs/orcamentos/F4-RESULTADO-MOBILE.md` (este relatório).

## Riscos / rollback
- Risco mínimo (apresentação mobile). Rollback: reverter o commit volta ao wizard
  responsivo da Fase 3; nada de dado muda.

## Próxima fase
**Fase 5 — Desconto + alçada + preço mínimo + aprovação**: campo de desconto (item
e geral), comparação com preço de tabela (`desvio`), alçada por papel
(`D.comercial.alcadas`), e o status **Aguardando aprovação** quando o desconto
passa da alçada. (Aguardando ordem explícita.)
