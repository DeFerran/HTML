# Fase READ TOOLS — Resultado

**Data:** 2026-08-13
**Fase:** primeiras ferramentas somente-leitura da IA (sobre a FOUNDATION).
**Regra-mãe:** a IA é uma CAMADA sobre a plataforma. Toda leitura passa pela
RLS existente sobre `bi_*`; nenhuma tool escreve em dados de negócio; nenhuma
tool inventa valores. Ver `CLAUDE.md`, `docs/ai/01-AUDITORIA-ATUAL.md`,
`docs/ai/03-MAPA-DE-TOOLS.md`.

---

## 1. Objetivo realizado

Implementar as **primeiras READ TOOLS** e ligá-las ao gateway por um loop de
tool-use **somente-leitura**, para que o modelo obtenha dados **objetivos** das
tabelas reais em vez de inventar. Nenhuma ferramenta altera dados.

---

## 2. Conflito tratado (especificação × banco real)

A lista pedida incluía `get_farm`, `get_field`, `get_soil_analysis` e um
`get_collection_status` ponto-a-ponto. A auditoria (doc 01 §K.5) e o mapa de
tools (doc 03, seção D) já haviam registrado que **não existem** tabelas de
fazenda, talhão, análise de solo nem coleta por ponto nesta plataforma. A
verificação ao vivo (`list_tables`) confirmou: só há os espelhos `bi_*` de
gestão.

**Decisão do usuário:** implementar as 4 sem-dado como **stub honesto** —
ferramentas registradas que **sempre** retornam `disponivel=false` com um motivo
claro, **sem inventar nada** (respeita "nunca inventar valores" do `CLAUDE.md`).
`get_collection_status` é atendida no **nível agregado real**
(`bi_operacao_situacao`/`bi_operacao_etapas`), com aviso explícito de que não há
granularidade por ponto/talhão.

---

## 3. Ferramentas criadas (7)

| Tool | Tipo | Fonte real | Retorno (tipado) |
| ---- | ---- | ---------- | ---------------- |
| `get_client` | dados reais | `bi_clientes` + `bi_visitas` + `bi_cross_sell` | `{nome, grupo, receita, ha, visitas, relatorios, km, servicos_marcados[]}` |
| `get_season` | dados reais | `bi_safras` + `bi_servicos` | `{safra, receita, custo, servicos[]}` (safra = rótulo global) |
| `get_costs` | dados reais | `bi_custos_mensais` + `bi_custo_categoria` + `bi_proj_gastos` | `{total, por_categoria[], por_mes[], real_vs_projetado}` |
| `get_collection_status` | agregado real | `bi_operacao_situacao` + `bi_operacao_etapas` | `{situacoes[], etapas[]}` + aviso "só agregado" |
| `get_farm` | **stub** | — | `{disponivel:false, motivo}` |
| `get_field` | **stub** | — | `{disponivel:false, motivo}` |
| `get_soil_analysis` | **stub** | — | `{disponivel:false, motivo}` |

Todas devolvem a estrutura padrão `ToolResult`
`{ disponivel, encontrado?, motivo?, dados?, aviso? }`.

---

## 4. Como cada tool cumpre os 10 requisitos

| # | Requisito | Como |
| - | --------- | ---- |
| 1 | validar usuário | O gateway faz `auth.getUser()` antes de qualquer tool; o `db` passado às tools já carrega o JWT do usuário. |
| 2 | validar tenant | Escopo por `empresa='DF AGRO'` + `user_id` via RLS das `bi_*`. |
| 3 | validar company | Nesta plataforma **company = tenant** (`empresa`), single-tenant real (doc 01). Não há `company_id` separado; documentado, não inventado. |
| 4 | validar permissão | `is_membro_ativo()` (RBAC existente) barra não-membros antes das tools (403). |
| 5 | validar acesso à entidade | A RLS de cada `bi_*` só expõe linhas do próprio `user_id`; a tool nunca amplia escopo. |
| 6 | usar queries controladas | Consultas **parametrizadas fixas** (PostgREST builder); colunas e tabelas são literais no código. |
| 7 | retornar estrutura tipada | `ToolResult` + `dados` tipados por tool (`tools/types.ts`). |
| 8 | registrar ai_tool_call | Cada execução grava em `ai_audit_log` (`tipo='tool_call'`, `tool`, `nivel='READ'`, `args_hash`, `ok`, `erro`, `latencia_ms`). |
| 9 | tratar ausência de informação | `encontrado=false` (registro não achado) e `disponivel=false` (sem fonte) com `motivo` claro. |
| 10 | nunca executar SQL do modelo | O modelo só escolhe **nome + args do schema** (`additionalProperties:false`); não há caminho para SQL livre. |

> Sobre `company_id` e os IDs relacionais (`farm_id`, `field_id`, `season_id`):
> não existem como colunas no modelo real. Onde a spec os previa, a tool ou usa a
> chave real (nome/rótulo) ou retorna `disponivel=false`. Nada é fabricado.

---

## 5. Arquivos

**Criados**
- `supabase/functions/ai-gateway/tools/types.ts` — contrato das tools (só tipos).
- `supabase/functions/ai-gateway/tools/read_tools.ts` — as 7 tools + registry + `runReadTool`.
- `supabase/functions/ai-gateway/tools/read_tools.test.ts` — testes (bun).
- `docs/ai/05-READ-TOOLS-RESULTADO.md` — este relatório.

**Modificados**
- `supabase/functions/ai-gateway/provider.ts` — blocos de conteúdo + `ToolSpec` (tool-use).
- `supabase/functions/ai-gateway/anthropic.ts` — envio de `tools` e parsing de `tool_use`.
- `supabase/functions/ai-gateway/index.ts` — loop de tool-use READ + log de `tool_call`.
- `supabase/functions/ai-gateway/README.md` — documentação das tools.

**Nenhum arquivo da plataforma existente (`index.html`, etc.) foi tocado.**

## 6. Tabelas / migrations criadas

**Nenhuma.** O logging de `tool_call` reutiliza `ai_audit_log` (já criada e
aprovada na FOUNDATION). O doc 02 não prevê tabelas novas para as READ tools —
portanto nenhuma migração foi criada (regra: "migrations apenas se previstas e
aprovadas em 02").

## 7. Endpoints

Mesma função `ai-gateway` (`POST /functions/v1/ai-gateway`), agora **versão 2**,
`verify_jwt=true`, `ACTIVE`. O contrato externo não mudou; internamente passou a
consultar tools READ quando necessário.

---

## 8. Testes executados

### Unitários (bun) — `tools/read_tools.test.ts` — **13 passaram, 0 falharam**

Rodados com um `Db` **falso injetado** (sem rede), o que prova a lógica de
segurança sem depender do egress do sandbox:

- **Cross-tenant impedido:** com args maliciosos
  (`{nome, user_id:'user-B', empresa:'OUTRA'}`), o teste verifica que **nenhuma**
  query filtrou por `user_id`/`empresa` vindos do modelo e que **nenhum** valor
  malicioso foi usado como filtro. O escopo continua 100% na RLS.
- **Sem SQL do modelo:** todas as tools têm `additionalProperties:false` e
  `nivel='READ'`.
- **Dados inexistentes:** cliente inexistente → `encontrado=false`; safra
  inexistente → `encontrado=false`; custos sem dados → `encontrado=false`. Nenhum
  valor é inventado (`dados` ausente).
- **Stubs honestos:** `get_farm`/`get_field`/`get_soil_analysis` →
  `disponivel=false` **e não tocam o banco** (`fromTables` vazio).
- **Casos felizes tipados:** `get_client`, `get_season`, `get_costs`,
  `get_collection_status` retornam a estrutura esperada; `get_costs` agrega por
  mês e compara real vs projetado; `get_collection_status` traz o aviso
  "AGREGADA".
- **Tool desconhecida** → `disponivel=false` (defesa do dispatcher).

### Build

- Deploy da função (`deploy_edge_function`) compila o bundle Deno server-side
  com os 6 arquivos (incl. `tools/`): **versão 2 ACTIVE, verify_jwt=true** →
  build validado.

### Limites do ambiente (não são defeitos)

- Smoke test HTTP end-to-end continua bloqueado: o proxy do sandbox nega CONNECT
  a `*.supabase.co`. A validação de isolamento foi feita nos testes unitários
  (via `Db` falso) + na RLS já verificada na FOUNDATION.

---

## 9. Erros encontrados

- 1ª tentativa de deploy falhou por `import_map_path` herdado da versão 1
  (apontava para o path antigo). Corrigido passando `import_map_path='deno.json'`
  explicitamente. Sem erros de compilação depois disso.

## 10. Riscos

| Risco | Nível | Observação |
| ----- | ----- | ---------- |
| Modelo tentar "inventar" farm/field/solo | BAIXO | Stubs retornam `disponivel=false` e o system prompt manda dizer que não existe. |
| Vazamento cross-tenant | BAIXO | RLS + tools que nunca aceitam escopo do modelo (teste automatizado cobre). |
| Custo/loop de tools | BAIXO | `MAX_TOOL_ITERS=6`, `max_tokens=1024`, rate limit 30/min. |
| Divergência de números vs painel | BAIXO | Tools leem os mesmos `bi_*` que alimentam o BI; sem recomputar regras. |

## 11. Rollback

- Reverter a função para a versão 1 (FOUNDATION, sem tools) no painel do
  Supabase, **ou** redeployar sem `tools/`.
- As tabelas `ai_*` permanecem; nenhuma migração foi adicionada nesta fase.
- Nenhum efeito sobre `painel_estado`, `bi_*`, `membros`, funções ou frontend.

## 12. Pendências

- Configurar o secret `ANTHROPIC_API_KEY` (passo do dono — descrito na
  FOUNDATION) para exercitar as tools de ponta a ponta.
- Smoke test manual end-to-end pelo dono após o secret.

## 13. Próxima fase sugerida

- **READ tools analíticas / restantes de gestão** (doc 03, seções A/B): `list_clients`,
  `get_service_summary`, `get_cashflow`, `get_funnel`, `get_targets`,
  `get_cross_sell`, `get_operation_status`, `get_team_indicators`,
  `compare_seasons`, `analyze_cost_per_hectare`, `generate_report`. Continuam
  **READ**, sem WRITE/automação/WhatsApp/RAG.
- WRITE (memória/propostas) permanece adiada e **gated** (SAFE_WRITE /
  SENSITIVE_WRITE via Approval Engine) — fase futura, só com ordem explícita.

**Não iniciar sem ordem explícita do usuário.**

---

_PARADO conforme a regra de implementação incremental._
