# 13 — Rótulos de valor nos gráficos (legibilidade no tema escuro)

## Problema (relatado com prints do celular, tema escuro)
Vários gráficos tinham o **rótulo de valor** (R$ / % / número na ponta da barra)
numa cor **fixa escura** — bom no tema claro, quase invisível no tema escuro.
Ex.: "Receita por serviço", "Custo por categoria" (rótulos cinza-escuros sobre
painel escuro). E os rankings "por cliente" usavam a mesma cor da barra (verde),
de baixo contraste. Pedido: **deixar os números legíveis em todos os gráficos.**

## Causa
Os rótulos usavam literais de cor escuros no código do gráfico:
- `color:'#1b2a1f'` (tinta escura) em 12 gráficos;
- `'#9A6B00'` (âmbar escuro) em 2 gráficos;
- `C.moss`/`C.red` (cor da barra) nos rankings "por cliente".

O tema escuro **já tinha** um token de tinta claro (`_labInk` = `#E8F0EA`), mas
esses gráficos não o usavam — ficavam presos na tinta clara-tema.

## Solução — tinta de rótulo sempre tema-consciente
Troca de **token**, não de valor: no tema claro os valores são idênticos aos de
antes (portanto **o tema claro fica pixel a pixel igual**); no escuro passam a
usar a versão clara/brilhante.

| Antes | Depois | Claro | Escuro |
|---|---|---|---|
| `color:'#1b2a1f'` (12×) | `color:()=>_labInk` | `#1b2a1f` (igual) | `#E8F0EA` (claro) |
| `'#9A6B00'` (2×) | `_labAmber` (novo token) | `#9A6B00` (igual) | `#FBBF24` (brilhante) |
| `C.moss`/`C.red` (rankings por cliente) | `()=>_labInk` | tinta escura | tinta clara |

Detalhes:
- Novo token `_labAmber` na paleta (`C_LIGHT.labAmber`/`C_DARK.labAmber`), setado
  em `applyTheme` junto de `_labInk`.
- Rankings "Contribuição por cliente" (`cMargCli`) e "Margem de contribuição por
  cliente" (`cCliLucro`) passam a usar `_labInk` — o **sinal** já é dado pela cor
  da **barra** (verde/vermelho); o rótulo só precisa ser legível (igual ao que
  "Margem % por cliente" já fazia).
- Rótulos que já eram tema-conscientes (`_labInk`, cores `C.*` brilhantes,
  branco nas roscas) não mudaram.

## Verificação
- `bun test` → **127 pass / 0 fail**.
- Render headless com Chart.js real, tema **escuro**, dados semeados: os rótulos
  de "Receita por serviço" aparecem em branco-claro, legíveis (antes: cinza
  escuro quase invisível).
- Varredura 9 telas × 2 temas (claro/escuro): **0 erro de JS**.

## Escopo / risco
- Só apresentação (cor de texto de rótulo). Nenhum cálculo, dado, eixo ou série
  alterado. Tema claro inalterado por construção.
- Rollback: reverter o commit restaura as cores literais anteriores.
