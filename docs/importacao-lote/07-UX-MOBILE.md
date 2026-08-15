# 07 — UX Mobile

> A base já era responsiva (reuso de `imp-overlay`/`resp-cards`/`orc-steps`).
> Auditoria em 390px: **zero overflow** horizontal, tabelas viram cards, botões
> tappáveis, stepper cabe. A Fase 9 aplicou refinos via media query `≤640px`
> (desktop intacto).

## Refinos aplicados

- **Formulários em uma coluna** (`.imp-modal .lpf{min-width:100%}`) — verificado
  12/12 campos full-width no wizard.
- **KPIs 2 por linha** (`.imp-tile`).
- **Ação primária confortável ao toque** (48px) e chips de passo 44px.
- Overlay ocupa melhor a tela (sheet); menos padding.

## Padrão mobile

- Cards/resumo em vez de grids largos.
- Fluxo vertical, passo-a-passo (wizard).
- Resumo antes de confirmar (revisão obrigatória).
- Tabelas de preview/histórico rolam em área própria — o botão de ação continua
  visível.

## Excel no celular

Baixar modelo / selecionar arquivo / enviar continuam disponíveis, mas o mobile
prioriza **lançamento manual rápido**, **replicação** e **criação em lote/rateio**.
A edição pesada de XLSX é experiência de desktop/notebook.
