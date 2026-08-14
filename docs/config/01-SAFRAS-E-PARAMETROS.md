# Configurações — Safras & Parâmetros

**Data:** 2026-08-14
**Objetivo:** dar um **lugar** para criar/organizar informações estruturais que
antes eram fixas no código — começando por **safras** (o dono não tinha onde
criar uma safra nova) e reunindo os **parâmetros globais** num só ponto.

## O que foi entregue

Nova seção **"Safras & Parâmetros"** (sidebar → Gestão; e nas abas clássicas),
view `#v-config`, com dois painéis:

### 1. Safras (cadastro dinâmico)
- Lista as safras com: meta de receita, nº de itens no funil, nº de preços, qual
  é a **base** e ação de **remover**.
- **+ Adicionar safra** (valida `AA/AA`, ex.: 28/29) e **↦ Próxima** (sugere a
  próxima via `safraMais`).
- **Definir base** (rádio): a safra base é a que o topo reflete.
- **Remover** (com confirmação; bloqueia remover a base ou a última safra;
  avisa se houver dados lançados).
- Uma safra nova **entra no seletor do topo** e **nasce vazia** — `baseGate`
  já mostra o estado "nada lançado"; `recBruta()` da safra nova é 0 (não vaza).

### 2. Parâmetros globais (num só lugar)
Editam os campos que já viviam espalhados em `D`: Imposto sobre NF (%), Comissão
(%), MIB padrão, Fator ha/ponto (padrão), Prazo de amostras (dias). Salvam
automaticamente e ressincronizam a plataforma (imposto também atualiza o
seletor de imposto do Financeiro).

## Como funciona (técnico, aditivo e de baixo risco)

- **Lista de safras dinâmica:** `FUNIL_SAFRAS` e `SAFRA_BASE` deixaram de ser
  `const` e viraram `let` **declarados antes de `hydrate`** (a 1ª chamada de
  hydrate ocorre antes da posição antiga → evita TDZ). `hydrate` inicializa
  `D.safrasList` (deriva das metas existentes; padrão `['26/27','27/28']`) e
  `D.safraBaseKey`, normaliza (formato `AA/AA`, únicos) e **sincroniza** os dois
  globais. As ~15 chamadas existentes de `FUNIL_SAFRAS`/`SAFRA_BASE` não mudaram.
- **Normalização por safra:** os laços de `metasSafra`/`precosSafra` no hydrate
  passaram a iterar `D.safrasList` (antes fixo em `['26/27','27/28']`).
- **Criar safra:** adiciona a `D.safrasList`, cria `metasSafra`/`precosSafra`
  vazios e estende `D.safras.labels/receita/custoCompetencia` (receita 0) para
  `safraIdx()`/`recBruta()` reconhecerem a safra nova.
- **Handlers:** `renderConfig`, `cfgAddSafra`, `cfgRemSafra`, `cfgSetBase`,
  `cfgSetParam`, `cfgSugereSafra` — todos com `commit()` + re-render.

## Testes
- **bun: 127 passam** (novo `tests/safras.test.ts` cobre `safraMais` + validação
  `AA/AA`).
- **Smoke headless (Chromium):** carga sem erro (a troca const→let não quebrou o
  boot); abrir a view; criar 28/29 (entra em `safrasList`, `FUNIL_SAFRAS`,
  metas, preços, `safras.labels` e nas pills do topo); `recBruta` da 28/29 = 0
  (sem vazamento); definir base 27/28 e voltar; parâmetros (imposto 15%→taxRate,
  comissão 8%, MIB 25, prazo 20); remover 28/29; **persistência**: roundtrip por
  `hydrate` preserva `safrasList`, base e parâmetros. **0 erros JS.**

## Próximo passo sugerido
Se quiser, dá para reaproveitar essa seção "Configurações" como casa de outros
cadastros estruturais no futuro (ex.: catálogo de serviços/grupos, centros de
custo padrão). Fica para quando você pedir.

**PARADO** conforme a regra de implementação incremental.
