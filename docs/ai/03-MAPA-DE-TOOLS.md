# Fase 1 — Mapa de Ferramentas da IA

> Contrato das ferramentas ("tools") do Agente AP, **ancorado nos dados reais**
> (tabelas `bi_*` da auditoria). Projeto apenas — nada implementado.
>
> **Regras invioláveis:**
> - Toda tool é uma **consulta parametrizada fixa** aos espelhos `bi_*` — nunca
>   "SQL livre" produzido pela IA (proibição do `CLAUDE.md`).
> - Leitura sempre sob o **JWT do usuário** → a **RLS** (`user_id = auth.uid()` +
>   `is_membro_ativo()`) é a barreira de escopo. A tool nunca lê de outro usuário.
> - Fonte de leitura = `bi_*` (nunca `painel_estado`, nunca o blob JSON).
> - Uma tool cujo dado **não existe** hoje **não é implementada** (regra "nunca
>   inventar valores").

## Legenda de permissão
- **READ** — só consulta. Liberada para leitor/editor/admin (membro ativo).
- **SAFE_WRITE** — ação interna reversível (`ai_*`). editor/admin.
- **SENSITIVE_WRITE** — exige aprovação humana (Approval Engine). Nunca automática.

---

## A. READ tools da v1 (têm dados reais — implementar primeiro)

### get_client
- **Objetivo:** dados de um cliente da carteira (receita, hectares, grupo,
  cross-sell, visitas).
- **Parâmetros:** `{ nome: string }` (ou `cliente_id` futuro).
- **Origem dos dados:** `bi_clientes` (+ `bi_cross_sell`, `bi_visitas`).
- **Permissão:** READ.
- **Retorno:** `{ nome, grupo, receita, ha, servicos_marcados[], visitas, km }`.
- **READ/WRITE:** READ.

### list_clients
- **Objetivo:** listar/rankear clientes (por receita, hectares, grupo).
- **Parâmetros:** `{ ordenar_por?: 'receita'|'ha', grupo?: string, limite?: int }`.
- **Origem:** `bi_clientes`.
- **Permissão:** READ.
- **Retorno:** lista de `{ nome, grupo, receita, ha }`.
- **READ/WRITE:** READ.

### get_costs
- **Objetivo:** custos por período/categoria/centro de custo/colaborador.
- **Parâmetros:** `{ ano?: int, categoria?: string, competencia?: string }`.
- **Origem:** `bi_lancamentos` (grão fino) + `bi_custos_mensais` +
  `bi_custo_categoria` + `bi_proj_gastos` (agregados).
- **Permissão:** READ.
- **Retorno:** `{ total, por_categoria[], por_mes[], real_vs_projetado }`.
- **READ/WRITE:** READ.

### get_season (get_safra)
- **Objetivo:** visão de uma safra (receita, custo, serviços). ⚠️ safra é um
  **rótulo global** (24/25…27/28), não por talhão.
- **Parâmetros:** `{ safra: string }` (ex.: `'26/27'`).
- **Origem:** `bi_safras` + `bi_servicos`.
- **Permissão:** READ.
- **Retorno:** `{ safra, receita, custo, servicos[] }`.
- **READ/WRITE:** READ.

### get_service_summary
- **Objetivo:** desempenho por serviço (ha, receita, clientes, R$/ha) na safra.
- **Parâmetros:** `{ safra?: string }`.
- **Origem:** `bi_servicos`.
- **Permissão:** READ.
- **Retorno:** lista de `{ nome, ha, receita, clientes, preco_ha }`.
- **READ/WRITE:** READ.

### get_cashflow
- **Objetivo:** fluxo de caixa mensal (receita/custo/margem).
- **Parâmetros:** `{ }` (ano corrente).
- **Origem:** `bi_caixa_mensal`.
- **Permissão:** READ.
- **Retorno:** 12 meses de `{ mes, receita, custo, margem }`.
- **READ/WRITE:** READ.

### get_funnel
- **Objetivo:** funil de vendas / projeção por safra.
- **Parâmetros:** `{ safra?: string, estagio?: string }`.
- **Origem:** `bi_funil`.
- **Permissão:** READ.
- **Retorno:** oportunidades `{ cliente, servico, estagio, area, valor }`.
- **READ/WRITE:** READ.

### get_targets (get_metas)
- **Objetivo:** metas de receita/hectares vs realizado.
- **Parâmetros:** `{ }`.
- **Origem:** `bi_metas`.
- **Permissão:** READ.
- **Retorno:** `{ receita_meta, receita_real, hectares_meta, hectares_real }`.
- **READ/WRITE:** READ.

### get_cross_sell
- **Objetivo:** matriz cliente × serviço; identificar subatendidos.
- **Parâmetros:** `{ apenas_subatendidos?: bool }`.
- **Origem:** `bi_cross_sell`.
- **Permissão:** READ.
- **Retorno:** `{ cliente, servicos_marcados, total }`.
- **READ/WRITE:** READ.

### get_operation_status
- **Objetivo:** situação/etapas das operações (agregado). ⚠️ **sem pontos/
  amostras** — apenas contagem por situação/etapa.
- **Parâmetros:** `{ }`.
- **Origem:** `bi_operacao_situacao`, `bi_operacao_etapas`.
- **Permissão:** READ.
- **Retorno:** `{ situacao[], etapas[] }`.
- **READ/WRITE:** READ (parcial — cobre "collection_status" da spec só no nível
  agregado).

### get_team_indicators
- **Objetivo:** indicadores por colaborador (metas/realizado).
- **Parâmetros:** `{ colaborador?: string }`.
- **Origem:** `bi_equipe_indicadores`.
- **Permissão:** READ.
- **Retorno:** `{ colaborador, indicador, meta, real }`.
- **READ/WRITE:** READ.

---

## B. READ tools analíticas (v1.5 — combinam os `bi_*`)

### compare_seasons
- **Objetivo:** comparar safras (receita, custo, serviços) e explicar variações.
- **Origem:** `bi_safras` + `bi_servicos`. **Permissão:** READ.

### analyze_cost_per_hectare
- **Objetivo:** custo/ha por grupo/serviço; usa as **regras já validadas** do
  motor (comissão sobre receita bruta, break-even com imposto+comissão — ver
  `AUDITORIA.md`), **sem recalcular por conta própria**.
- **Origem:** `bi_custos_mensais`/`bi_lancamentos` + `bi_servicos`.
- **Permissão:** READ.

### generate_report
- **Objetivo:** compor um relatório textual a partir das READ tools acima.
- **Origem:** as tools anteriores. **Permissão:** READ (compõe; **persistir** o
  relatório = SAFE_WRITE, fase posterior).

---

## C. WRITE tools (fases posteriores — gated)

### save_memory_fact
- **Objetivo:** gravar um fato/preferência que o usuário confirmou.
- **Origem/destino:** `ai_memory`. **Permissão:** **SAFE_WRITE** (editor/admin).
- **READ/WRITE:** WRITE (reversível; nunca "vira fato oficial" sozinho).

### propose_action (ex.: reajuste de preço, contato)
- **Objetivo:** **propor** uma ação — cria um pedido em `ai_approvals`. **Não
  executa nada.**
- **Destino:** `ai_approvals`. **Permissão:** **SENSITIVE_WRITE** → exige
  aprovação de admin antes de qualquer efeito.
- **READ/WRITE:** WRITE (só o pedido; a execução é humana/aprovada).

> **Nenhuma tool escreve em `painel_estado`, `bi_*` ou `membros`.** Qualquer
> alteração de dados de negócio permanece manual no app, ou passa por Approval
> Engine numa fase futura com um caminho de escrita seguro e não-destrutivo.

---

## D. Tools da especificação SEM dados hoje — **NÃO IMPLEMENTAR**

Estas aparecem no `00-MASTER` mas **não têm backing** no modelo atual. Implementá-las
violaria "nunca inventar valores". Ficam **bloqueadas** até (e se) a plataforma
ganhar o modelo relacional de AP fina — decisão de produto (ver `01-AUDITORIA` §K.5).

| Tool da spec | Por que bloqueada |
| --- | --- |
| `get_farm` / `get_field` | Não existem tabelas de fazenda/talhão. |
| `get_soil_analysis` / `get_soil_history` | Não há resultados de análise de solo. |
| `get_maps` | Nenhum dado geoespacial; sem PostGIS, sem Storage. |
| `get_yield_data` | Não há dados de produtividade/colheita. |
| `analyze_fertility` / `analyze_variability` | Dependem de grid/amostra por talhão. |
| `analyze_collection_efficiency` | Coleta existe só como status agregado, não por ponto/amostra. |
| `get_collection_status` (fino) | Coberto **só** no nível agregado por `get_operation_status`. |

---

## Resumo de cobertura

- **Implementáveis já (dados reais):** ~11 READ tools (seção A) + 3 analíticas (B).
  Cobrem gestão: clientes, serviços, safras (rótulo), custos, caixa, funil, metas,
  cross-sell, equipe, operação (agregado).
- **Fase posterior (gated):** memória (SAFE_WRITE) e propostas (SENSITIVE_WRITE via
  Approval Engine).
- **Bloqueadas (sem dados):** todas as tools de AP fina (fazenda/talhão/coleta/
  amostra/análise/mapa/produtividade).

**PARADA.** Este é o contrato de projeto. Nenhuma tool foi implementada.
