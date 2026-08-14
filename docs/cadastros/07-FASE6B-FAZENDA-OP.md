# Cadastros — Fase 6b: Fazenda sugerida nos módulos operacionais

Fecha a pendência da Fase 6. Só interface — nenhum cálculo, banco, rota ou regra
de negócio existente foi alterado.

## Objetivo realizado
Nos módulos operacionais (Coleta de Pontos, Envio de Amostras, Controle de
Entregas), o campo **Fazenda** agora sugere as **fazendas cadastradas** (aba
Cadastros › Fazendas), além das que já foram digitadas — reduzindo divergência de
grafia sem travar o operador.

## O que mudou
- Novos helpers:
  - `nomesFazendas()` — nomes únicos do cadastro `D.fazendas`;
  - `opFazSugestoes(usadas)` — união (cadastro ∪ já usadas no módulo), sem
    duplicar, ordenada.
- **Coleta** (`mFazenda` / `opFazendasList`) e **Amostras** (`maFaz` /
  `oaFazendasList`): já tinham `datalist`; a população passou a incluir as
  fazendas cadastradas.
- **Entregas** (`meFazenda`): ganhou `list="opEnFazendasList"` + novo
  `<datalist>`, populado em `renderOpEntregas`.

## Por que datalist (e não select fechado)
Os módulos operacionais às vezes registram uma fazenda ainda **não cadastrada**
(campo, correria). O `datalist` **sugere** os nomes certos do cadastro, mas não
**bloqueia** a digitação — mantém a rapidez do operador e ainda puxa a grafia
correta. Divergências que sobrarem aparecem no **painel de integridade** (Fase 6).

## Arquivos modificados
- `index.html`: helpers `nomesFazendas`/`opFazSugestoes`; população dos datalists
  de Coleta e Amostras; `list=` + `<datalist>` + população em Entregas.
- `docs/cadastros/07-FASE6B-FAZENDA-OP.md` (este relatório).

## Testes executados
- `bun test` → **127 pass / 0 fail**.
- Smoke headless (Chromium real): com 2 fazendas cadastradas e 1 fazenda usada em
  cada módulo, os três datalists passam a listar cadastro ∪ usadas (Coleta:
  +Sítio Velho; Amostras: +Gleba 3; Entregas: +Retiro) e `meFazenda` recebe o
  `list`. **0 erro de JS.**

## Riscos / rollback
- Risco mínimo (só sugestões de input). Rollback: reverter o commit remove os
  datalists enriquecidos; nada de dado muda.

## Estado do ciclo de cadastros
Fases 1–6b concluídas. A base de cadastros está estruturada e conectada de ponta
a ponta, com as sugestões chegando também aos módulos operacionais.
