# 08 — Decisões que necessitam o dono (NECESSITA DECISÃO)

Regra de não inventar: onde o comportamento correto é **negócio** e não pode ser
deduzido do código/planilha sem risco, **não** corrigi. Cada item abaixo tem
opções e o impacto de cada uma. Nada será mexido sem sua ordem explícita.

---

## D-01 (P1) — `recBruta()` usa índice fixo `[2]` (safra 26/27)

`function recBruta(){return D.safras.receita[2];}` (linha 1763). Todo o bloco
financeiro (imposto, margem, comissão, ponto de equilíbrio, cascata) usa a
receita bruta da **26/27** mesmo quando outra safra está ativa.

- **Opção A (manter):** financeiro é sempre "consolidado 26/27" por definição.
  Simples, mas o seletor de safra não afeta o financeiro (pode confundir).
- **Opção B (por safra):** `recBruta()` segue `safraAtual()`. Coerente com o
  seletor, **mas** exige receita por safra confiável em `D.safras` e revisar
  todos os consumidores → **regressão ampla**. Precisa de bateria de testes.

**Recomendação:** decidir o significado ("financeiro é sempre 26/27" vs "segue a
safra"). Se B, tratar como fase própria com testes de regressão.

---

## D-02 (P1) — Base da comissão diverge (linha 2452)

Regra declarada: comissão sobre **receita bruta** (`comBase()=recBruta()`, lab é
despesa e não entra na base). Mas `renderServGeral` (linha 2452) usa
`max(rec − custoDir, 0) * comRate()` — receita **menos custo direto**.

- **Opção A:** padronizar tudo em **receita bruta** (alinha 2452 às demais).
  Comissão sobe onde há custo direto; margem líquida exibida cai nesse card.
- **Opção B:** a regra real é **sobre a margem** (rec−custoDir) e as outras é que
  estão "otimistas". Aí muda-se `comBase`/`comissaoSobre`.

**Impacto:** afeta números exibidos de comissão e margem. **Não** dá para
escolher sem a regra oficial do contrato de comissão.

**Recomendação:** confirmar no contrato: comissão incide sobre faturamento ou
sobre margem? Depois padronizar em **um** ponto (single source).

---

## D-03 (P1) — `bi_custos_mensais` zerada → IA dizia "custo R$ 0" ✅ RESOLVIDO (Opção B)

288 linhas, `SUM(valor)=0`. `get_costs` (ai-gateway) lia dela para o **total**.

- ~~**Opção A:** reprocessar o ETL do espelho (fora do código do app).~~
- **Opção B (código) — APLICADA:** `get_costs` agora tira o **total** e o
  detalhamento **por categoria** de `bi_custo_categoria` (reconcilia com os
  lançamentos pagos: 2026 = **R$ 908.726,57**). O detalhamento **por mês** só
  aparece quando `bi_custos_mensais` tiver valores; enquanto estiver zerada, a
  tool **omite** o mensal e devolve um **aviso** — nunca reporta "R$ 0 em todo
  mês". Verificado com dados reais (ver 07). **Deploy da edge function pendente.**

**Correção de raiz ainda recomendada (A):** reprocessar o ETL de
`bi_custos_mensais` para reativar o detalhamento mensal na IA.

---

## D-04 (P2) — `bi_metas` realizado defasado (=0)

Meta 1.8M, realizado 0. Fonte viva é `D.metasSafra`.

- **Opção A:** ETL do espelho passa a espelhar `metasSafra`.
- **Opção B:** IA/relatórios de meta lêem o snapshot vivo, não `bi_metas`.

---

## D-05 (P2) — Entregas: linha 100% pendente conta 2×

`statusLinha`/`agg` (~2270): uma linha só-pendente entra em **andamento** e em
**pendente**. Definição de "em andamento" é ambígua.

- **Opção A:** "em andamento" = tem ≥1 item concluído **e** ≥1 pendente.
- **Opção B:** manter, mas deixar claro no rótulo que as categorias se sobrepõem.

---

## D-06 (P2) — Hectares divergentes por origem

`bi_clientes` (~20.003 ha) vs `bi_servicos` (~28.500 ha). Qual é a área
"oficial" para KPIs? Serviços podem contar a mesma área em múltiplos serviços
(soma > área física). **Decisão de negócio.**

---

## D-07 (P2) — Rótulos operacionais dizem "na safra"/"26/27" sem filtro

As telas operacionais não filtram por safra, mas os rótulos sugerem 26/27.
Baixo risco re-rotular ("total" em vez de "na safra"), mas deixei no lote de UX
para você aprovar o texto.

---

## Higiene (P3) — só quando quiser

- Ligar leaked-password protection (Auth).
- Índices nas 11 FKs quentes; remover política duplicada de `membros`; avaliar 9
  índices sem uso.
