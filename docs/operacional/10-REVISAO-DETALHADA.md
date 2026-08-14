# Revisão detalhada — Controle Operacional + mobile — Resultado

**Data:** 2026-08-14
**Objetivo:** conferir se tudo o que foi construído nesta rodada (módulo Controle
Operacional, integração com a IA, validações e a experiência mobile de
Lançamentos) está **correto**.

## Método

1. **Integridade da fiação** (script): handlers `onclick` → função existente;
   ids duplicados; cada view operacional com tab + section + sidebar + dispatch;
   blocos puros marcados presentes.
2. **Smoke test amplo** (Chromium headless): renderizar **todas** as telas novas
   e o round-trip de exportação/importação, coletando erros de JS e de console.
3. **Auditoria de invariantes** (grep dirigido): round-trip de status
   (rótulo↔chave), uso de `arquivoMaquina` (status, não data), assinatura de
   `hectares`, código morto.
4. **Unitários** (bun) + **parse** de todos os scripts.

## Resultado da fiação

- `onclick` distintos: **85** — **todos** com função definida (0 órfãos).
- **0 ids duplicados.**
- Views `opresumo`/`opcoleta`/`opamostras`/`opentregas`: tab ✔ · section ✔ ·
  sidebar ✔ · dispatch ✔ (todas).
- Blocos puros `ai-detectors`, `op-coleta-calc`, `op-amostras-calc`,
  `op-entregas-calc`, `op-csv`: presentes e fechados.

## Achados (e correções)

1. **BUG (corrigido) — Visão do Ciclo quebrava silenciosamente.**
   Após o fator de hectares virar **por lançamento**, `OpColetaCalc.hectares`
   passou a receber a **lista** de lançamentos. `renderOpResumo` continuava
   chamando com a assinatura antiga (`totalPontos, fator`) → passava um número
   onde se espera array → `lancs.forEach is not a function`. Como o dispatch
   envolve `renderOpResumo` em try/catch, a aba **Ciclo Operacional** ficava
   **em branco** sem erro visível. Corrigido para `hectares(D.opColeta.lancamentos)`.
   (commit `beba8c4`)
2. **Limpeza — código morto.** `opNum` foi definido na importação mas a conversão
   acabou inlinada; função nunca referenciada. Removida. (commit `7c0713e`)

## Verificado correto (sem mudança)

- **Round-trip status (export→import)** bate exatamente nos rótulos:
  Coleta (Planejada/Em andamento/Finalizada/Não trabalhado), Amostras
  (Colocado/Pendente), Entregas (Concluído/Em andamento/Pendente/—).
- **Exportação usa datas cruas** (`YYYY-MM-DD`) → a importação reconstrói sem
  perda; colunas derivadas (Total/Dias/Situação/Progresso) são ignoradas no import.
- **`arquivoMaquina`** é status em todos os pontos (badge, modal select, export
  label, import label→chave) — nenhum resquício de "data".
- **Migração de estado** preserva dados existentes (`if(!d.opX)`) e normaliza
  ids/arrays; defaults marcados (fator null, prazo null, MIB 20).
- **Detectores** consomem `OpAmostrasCalc`/`OpEntregasCalc` já inicializados,
  com guardas `typeof … !== 'undefined'`.
- **Mobile Lançamentos**: launcher em cards + drill-in (760→**767px**, alinhado
  aos card-forms `.edcards`); cada linha já é card-formulário no celular.

## Testes finais

- **bun: 110/110** (obs, detectores, coleta, amostras, entregas, csv + suíte
  anterior). Parse do `index.html` na baseline (1 falso-positivo do splitter,
  pré-existente).
- **Smoke headless**: `opresumo`, `opcoleta`, `opamostras`, `opentregas`,
  `prioridades`, `saude` e o round-trip export→import → **todos ok, 0 erros de JS**.

## Veredito

Módulo **correto e consistente**. Um bug real (Visão do Ciclo) foi encontrado
justamente pela revisão e corrigido; o restante passou nas verificações
automáticas e visuais. Pendências de negócio (títulos de Entregas; migração
Supabase) seguem registradas para quando você decidir.

**PARADO** conforme a regra de implementação incremental.
