# Controle Operacional — Validações (pontos "a validar" do PDF) — Resultado

**Data:** 2026-08-14
**Fase:** transformar os pontos que o PDF marcou como "a validar (não inventados)"
em **parâmetros configuráveis** na própria plataforma — sem fixar número de
negócio. Você ajusta na tela e valida na prática. Aditivo.

## O que foi resolvido

| # | Ponto do PDF | Resolução | Onde |
|---|---|---|---|
| 1 | **Hectares = pontos × fator** (fator não existe na planilha, só citado) | Campo **"Hectares por ponto (fator)"** configurável no topo da Tela 1. Vazio = card fica "—" (desligado). Ao preencher, o card **Hectares estimados** passa a calcular `total de pontos × fator`. | `D.opColeta.hectaresFator` |
| 2 | **Prazo esperado de resultado** deve ser configurável | Já resolvido: campo **"Prazo esperado (dias)"** na Tela 2. Enquanto vazio, nada vira "atrasado". | `D.opAmostras.prazoDias` |
| 3 | **"Arquivo na Máquina"** (significado não claro) | Adicionado como **campo opcional de data** na remessa (modal + coluna "Arq. máquina"), rotulado **"(a validar)"**. Interpretação assumida: etapa intermediária entre envio e resultado — se for status/prazo, é trivial trocar. | `remessa.arquivoMaquina` |
| 4 | **Média MIB = 20** (calculado ou padrão?) | Tratado como **padrão configurável** (default 20) no topo da Tela 3, **sobrescrevível por linha**. Linha sem MIB mostra o padrão em itálico ("padrão — a validar"). | `D.opEntregas.mibPadrao` |
| 5 | **Títulos das colunas de Entregas** | Mantidos conforme o protótipo (Cliente/Fazenda/Área + entregáveis, incl. "MIB"). Sem mudança — aguardando só sua confirmação. | — |

Nenhum número de negócio foi inventado: os defaults citados no PDF (fator 3, MIB
20) aparecem apenas como **sugestão/placeholder**; o valor efetivo é o que você
digitar. Todos persistem via `commit()` (sincronização existente).

## Arquivos

- `index.html` — Tela 1: campo de fator + `opColetaSetFator`. Tela 2: campo
  "Arquivo na máquina" (modal, coluna, save/edit). Tela 3: `D.opEntregas.mibPadrao`
  (migração) + campo de padrão + fallback do MIB na matriz + `opEnSetMibPadrao`.

## Testes

- **bun: 103/103** (lógica pura inalterada — as validações são de UI/parâmetro).
  Parse do `index.html` na baseline.
- **Behavior test (Chromium headless)**: fator 3 → card mostra 300 (100 pts × 3);
  "arquivo na máquina" salva e aparece na coluna; MIB padrão 20→25 reflete na
  matriz. **0 erros de JS**.

## O que ainda depende de você (decisão de negócio)

- Confirmar o **fator de hectares** real (hoje configurável; PDF citou 3).
- Dizer o que é **"Arquivo na Máquina"** (data / prazo / status) para tipá-lo certo.
- Confirmar se **Média MIB** é padrão fixo ou calculado por alguma regra (hoje
  padrão editável + override por linha cobre os dois casos comuns).
- Confirmar os **títulos das colunas** de Entregas.

Enquanto isso, tudo já funciona com os parâmetros configuráveis e os ganchos
prontos para a regra final.

**PARADO** conforme a regra de implementação incremental.
