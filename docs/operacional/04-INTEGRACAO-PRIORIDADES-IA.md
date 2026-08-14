# Controle Operacional → Prioridades da IA — Integração

**Data:** 2026-08-14
**Fase:** liga o dado operacional REAL (agora existente) à 1ª camada de IA proativa.
Aditiva; nenhum detector antigo foi removido.

## Contexto

Quando os detectores proativos foram criados, a plataforma **não tinha** dado
operacional individual (coleta/amostra/entrega), então alguns foram ancorados em
proxies (ciclo por safra, etapas). Agora que o **Controle Operacional** existe
(`D.opColeta`, `D.opAmostras`, `D.opEntregas`), as Prioridades passam a usar o
dado real.

## O que foi feito

Dois novos detectores **READ-only** no motor `AIDetectors` (bloco puro):

- **Amostras atrasadas** (`amostras_atrasadas`, aviso) — remessas com situação
  `atrasado` na Tela 2. **Só dispara quando há prazo definido** (`D.opAmostras.prazoDias`),
  coerente com a regra "a validar" — sem prazo, nada é inferido.
- **Entregas pendentes** (`entregas_pendentes`, info) — linhas da matriz (Tela 3)
  não concluídas, com % de progresso e nº de itens pendentes.

`buildDetectStateFromD()` passou a computar esses sinais via `OpAmostrasCalc` e
`OpEntregasCalc` (reuso do cálculo puro das telas) e injetá-los no `state`. Os
detectores continuam puros (recebem o `state`, não tocam `D`).

Cada insight mantém os 6 campos (o que aconteceu, por quê, dados, impacto,
confiança, próxima ação). A IA **não executa ação externa** — só sugere.

## Arquivos

- `index.html` — `AIDetectors`: +`detectAmostrasAtrasadas`, +`detectEntregasPendentes`
  no `runAll`; `buildDetectStateFromD` computa `amostras.atrasadas` e
  `entregas.pendentes`.
- `tests/detectors.test.ts` — +2 testes.

## Testes

- **bun: 103/103** (+2). Parse do `index.html` na baseline.
- **Render headless**: Prioridades da IA mostra "Amostras atrasadas no laboratório"
  (dias em aberto + responsável) e "Entregas pendentes" (cliente + % + pendentes),
  ordenadas por severidade; **0 erros de JS**.

## Aprendizado do processo (para as validações futuras)

O ciclo operacional é: **coleta de pontos → envio de amostras → resultado do
laboratório → entrega (matriz de correção)**. Isso esclarece os pontos a validar:

- **Hectares = pontos × fator** (Tela 1): liga produtividade de coleta à área.
- **Prazo de resultado** (Tela 2): define quando uma amostra vira "atrasada" —
  já é o gatilho do detector `amostras_atrasadas`.
- **"Arquivo na Máquina"** (Tela 2): provável etapa entre envio e resultado.
- **Média MIB / regra de atrasado** (Tela 3): fecham o ciclo da entrega.

Quando o dono validar esses parâmetros, os detectores e cards já têm os ganchos
prontos para refletir as regras finais.

**PARADO** conforme a regra de implementação incremental.
