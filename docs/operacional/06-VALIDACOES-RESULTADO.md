# Controle Operacional — Validações (pontos "a validar" do PDF) — Resultado

**Data:** 2026-08-14
**Fase:** transformar os pontos que o PDF marcou como "a validar (não inventados)"
em **parâmetros configuráveis** na própria plataforma — sem fixar número de
negócio. Você ajusta na tela e valida na prática. Aditivo.

## O que foi resolvido

**Respostas de negócio do dono aplicadas** (atualização):
- **Fator** varia por cliente/grade (1, 2, 3, 5, 10…) → passou a ser **por
  lançamento**; Hectares = **Σ(pontos × fator de cada lançamento)**. O campo do
  topo virou **"Fator padrão (ha/ponto)"** (sugestão que pré-preenche novos
  lançamentos).
- **"Arquivo na Máquina"** = colocar o arquivo para rodar operacionalmente no
  cliente → é um **status** (Pendente / Colocado), não uma data.
- **Média MIB** = **dose estipulada por fazenda** (varia) → mantida **editável
  por linha**; o padrão do topo é apenas sugestão.

| # | Ponto do PDF | Resolução (final) | Onde |
|---|---|---|---|
| 1 | **Hectares = pontos × fator** | **Fator por lançamento** (grade do cliente: 1/2/3/5/10, com datalist). Card **Hectares estimados** = Σ(pontos × fator). Campo "Fator padrão" no topo pré-preenche novos lançamentos; vazio = card "—". | `lancamento.fator`, `D.opColeta.hectaresFator` (padrão) |
| 2 | **Prazo de resultado** configurável | Campo **"Prazo esperado (dias)"** na Tela 2. Vazio = nada vira "atrasado". | `D.opAmostras.prazoDias` |
| 3 | **"Arquivo na Máquina"** | **Status** (— / Pendente / Colocado) na remessa (modal + coluna com badge). | `remessa.arquivoMaquina` |
| 4 | **Média MIB** | **Dose por fazenda**, editável por linha; **padrão configurável** (default 20) só como sugestão; linha sem MIB mostra o padrão em itálico. | linha `itens.mib.media`, `D.opEntregas.mibPadrao` |
| 5 | **Títulos das colunas de Entregas** | Mantidos conforme o protótipo. Aguardando só sua confirmação. | — |

Nenhum número de negócio foi inventado: os valores citados no PDF (fator 3, MIB
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
