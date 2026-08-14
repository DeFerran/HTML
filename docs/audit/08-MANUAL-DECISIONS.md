# 08 — Decisões que necessitam o dono (NECESSITA DECISÃO)

Regra de não inventar: onde o comportamento correto é **negócio** e não pode ser
deduzido do código/planilha sem risco, **não** corrigi. Cada item abaixo tem
opções e o impacto de cada uma. Nada será mexido sem sua ordem explícita.

---

## D-01 (P1) — `recBruta()` usava índice fixo `[2]` ✅ RESOLVIDO (Opção B — por safra)

**Decisão (gestor):** o financeiro deve seguir a **safra em foco**. O dono já
havia pedido isso ("troquei a safra e ainda aparece da 26/27… precisa ser de
acordo com cada safra"), as metas/preços já são por safra, e a plataforma já
tinha a infraestrutura pronta (`safraIdx()` + `baseGate()`, que **zera** as abas
de safras sem base lançada). O índice fixo era o único ponto que não acompanhava.

**Aplicado:** `recBruta()` passou a usar `safraIdx()` (segue `safraAtual()`),
com fallback defensivo para `[2]`. Para a **26/27 (base)** o índice resolve para
2 → **comportamento idêntico ao anterior** (verificado: R$ 1.479.363,40); ao
trocar para outra safra, todo o bloco financeiro (imposto, margem, comissão,
equilíbrio) acompanha — e safras sem base já são zeradas pelo `baseGate`.
Verificado em render headless: 27/28 com base → recBruta 250k, imposto 42,5k;
voltar p/ 26/27 → 1.479.363,40. 0 erros JS.

---

## D-02 (P1) — Base da comissão divergia (linha 2452) ✅ RESOLVIDO (Opção A — sobre a receita)

**Decisão (gestor/especialista):** em consultoria de serviços de AP, a comissão
de vendas incide sobre o **faturamento (receita bruta)**, não sobre a margem —
é o padrão de mercado e é exatamente a regra já declarada no código
(`comBase()=recBruta()`, "laboratório é despesa e não entra na base"). O plano
escalonado do Anderlírio também é sobre **vendas**. A linha 2452 era o único
ponto fora da curva (usava `receita − custo direto`).

**Aplicado:** `renderServGeral` passou a calcular `com = rec * comRate()`,
alinhado a `servMC`, `geralMC` e `comBase`. Efeito: nas linhas com custo direto
a comissão fica um pouco maior e a margem de contribuição exibida cai
levemente — leitura **mais conservadora e consistente**. `renderServGeral`
verificado sem erro em headless.

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

## D-04 (P2) — `bi_metas` realizado defasado (=0) ✅ RESOLVIDO (Opção B — fonte viva)

**Decisão (gestor):** a **fonte da verdade das metas é o app** (`D.metasSafra`,
lido por `metasFoco()` por safra), não o espelho ETL. Auditei os consumidores:
`bi_metas` **não é lido por nenhuma tool da IA nem por nenhum render** (grep em
`index.html` e `supabase/` → zero usos). Ou seja, o espelho defasado **não
alimenta nenhuma decisão viva** — só existiria para um relatório futuro.

**Aplicado:** nada de código (não há consumidor a corrigir). Fica registrado:
os KPIs de meta vêm de `D.metasSafra` (por safra, já migrado nesta plataforma);
`bi_metas` é um espelho não utilizado. **Raiz (opcional):** se um dia a IA/BI for
consumir metas, o ETL deve espelhar `metasSafra` — até lá, não usar `bi_metas`.

---

## D-05 (P2) — Entregas: linha 100% pendente contava 2× ✅ RESOLVIDO (Opção A)

**Decisão (gestor):** categorias **mutuamente exclusivas** — cada linha de
entrega é **concluída** (tudo pronto), **em andamento** (começou: ≥1 item
concluído, mas ainda falta) ou **pendente/não iniciada** (tem entregáveis
aplicáveis, porém **nada** concluído). Uma linha só-pendente **não** é "em
andamento".

**Aplicado (bloco puro `op-entregas-calc`):** `statusLinha` retorna
`nao_iniciada` quando `aplicaveis>0 && concluidos===0` (antes caía em
`andamento`); `agg` agora coloca cada linha em **exatamente um balde** (fim da
dupla contagem andamento+pendente). Alinhado com o filtro da tela (Não
iniciada/Em andamento/Concluída). Testes `opentregas.test.ts` atualizados +
caso novo (invariante de exclusividade). Suíte: 123 passam.

---

## D-06 (P2) — Hectares divergentes por origem ✅ RESOLVIDO (definição, sem mudança de código)

**Decisão (gestor agronômico):** os dois números medem **coisas diferentes** —
não é erro, é definição:

- **Hectares-serviço** (`Σ ha por serviço` ≈ 28.500) = **volume de trabalho
  executado**. O mesmo talhão físico pode receber vários serviços (Fertilidade
  Grid + Coleta + Curva de Nível…), então a soma **excede** a área física de
  propósito. **Esta é a base oficial das métricas por hectare** (receita/ha,
  custo/ha, ponto de equilíbrio, contribuição/ha) — é o denominador que casa com
  a receita e o custo dos serviços prestados. É o que `haTotal()` já usa. ✅
- **Hectares físicos de clientes** (`bi_clientes` ≈ 20.003) = **pegada física**
  da carteira (área do cliente, sem duplicar por serviço). Métrica de contexto
  por cliente (a IA usa em `get_client`).

**Conclusão:** o app **já usa o denominador correto** (ha-serviço) no lugar
certo (economia unitária), e a pegada física fica no contexto por cliente.
Nenhuma mudança de código — a "divergência" era só falta de nome. Registrado:
não somar/comparar as duas bases como se fossem a mesma área.

---

## D-07 (P2) — Rótulos operacionais diziam "na safra" sem filtro ✅ RESOLVIDO

As telas operacionais não filtram por safra. Auditado o Controle Operacional
inteiro: o **único** rótulo enganoso era `"pontos na safra"` na **Visão do Ciclo**
(`renderOpResumo`) — as demais telas já usavam "no período"/"no período filtrado"
(corretos). Trocado para **`"pontos no total"`** (reflete o acumulado, sem
sugerir escopo de safra). Verificado em render headless: o Ciclo mostra
"27 pontos no total", 0 erros JS. Mudança mínima, sem tocar em cálculo.

*Observação:* não foi adicionado filtro por safra às telas operacionais — os
dados (coleta/amostras/entregas) não têm safra associada hoje; se você quiser
segmentá-los por safra no futuro, isso é uma fase de modelagem à parte.

---

## Higiene (P3) — só quando quiser

- Ligar leaked-password protection (Auth).
- Índices nas 11 FKs quentes; remover política duplicada de `membros`; avaliar 9
  índices sem uso.
