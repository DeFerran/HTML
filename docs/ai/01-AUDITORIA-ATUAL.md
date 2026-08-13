# Fase 0 — Auditoria do Estado Atual

> Investigação **somente-leitura** da plataforma existente (código + banco), para
> fundamentar a camada de IA descrita em `00-MASTER-IA-AP.md`. Nenhum código,
> migration, tabela ou configuração foi alterado nesta fase.
>
> **Data:** 13/08/2026 · **Método:** leitura do repositório + consultas de leitura
> ao Supabase (`list_tables`, `list_migrations`, `list_edge_functions`,
> `pg_catalog`, `storage.buckets`, advisors).

---

## ⚠️ Aviso de conflito entre a especificação mestre e a realidade

O `CLAUDE.md` e o `00-MASTER-IA-AP.md` descrevem uma plataforma **relacional
multi-tenant** com hierarquia `Organização → Empresa → Cliente → Fazenda →
Talhão → Safra → Coleta → Pontos → Amostras → Laboratório → Análises → Mapas`.

**Essa estrutura não existe no sistema atual.** Conforme a regra do próprio
`CLAUDE.md` ("caso a especificação entre em conflito com o código real, o código
e o banco existentes devem ser investigados antes de qualquer mudança"), esta
auditoria documenta **o que de fato existe**. As diferenças estão detalhadas nas
seções E, F e K e são o insumo mais importante para planejar a IA sem inventar
dados nem duplicar estrutura.

---

## A. Arquitetura encontrada

Aplicação **single-page, arquivo único**, sem build e sem framework, servida
como site estático (GitHub Pages) e sincronizada com **Supabase**.

```
┌──────────────────────────────────────────────────────────────┐
│  index.html  (4.404 linhas — HTML + CSS + JS vanilla inline)   │
│  ├─ 12 "views" (.view) trocadas por #tabs (sem router)         │
│  ├─ Estado = 1 objeto JS  D  (documento único)                 │
│  ├─ persistência local: localStorage['dfagro_painel_v1']       │
│  └─ libs por CDN: supabase-js, chart.js, datalabels, xlsx      │
└───────────────┬──────────────────────────────────────────────┘
                │  supabase-js (PKCE, RLS)
                ▼
┌──────────────────────────────────────────────────────────────┐
│  Supabase (projeto HTML · pvftibzzqcbpgdihfcmb · sa-east-1)    │
│  ├─ painel_estado.dados (jsonb)   ← FONTE DA VERDADE           │
│  ├─ 4 gatilhos AFTER/BEFORE em painel_estado                   │
│  │     touch · snapshot(histórico) · bi · bi_lanc              │
│  ├─ 16 tabelas bi_*  ← ESPELHO RELACIONAL (read-only, ETL)     │
│  ├─ painel_historico (versões)                                 │
│  ├─ membros (RBAC) + funções SECURITY DEFINER                  │
│  └─ Auth (e-mail/senha, PKCE) · Storage: NENHUM bucket         │
└──────────────────────────────────────────────────────────────┘
```

**Não há:** backend próprio, servidor de aplicação, API REST customizada, fila,
worker, Edge Function, ou qualquer runtime de servidor. Todo o processamento
roda **no navegador**; o Supabase é o único backend (banco + auth + RLS + ETL
por gatilho).

---

## B. Tecnologias

| Camada | Tecnologia | Observação |
| --- | --- | --- |
| Frontend | HTML + CSS + **JavaScript vanilla** | 1 arquivo, sem módulos ES, 0 `import` |
| Build | **nenhum** | Sem `package.json`, sem Node, sem bundler |
| Framework/Router | **nenhum** | Views = `div.view` + botões `#tabs` |
| Gráficos | Chart.js 4.4.1 + plugin datalabels | via CDN, com SRI |
| Planilhas | SheetJS `xlsx` 0.18.5 | importação de `.xlsx` |
| Backend | **Supabase** | Postgres + Auth + RLS + PostgREST |
| Auth | Supabase e-mail/senha, **PKCE** | chave `sb_publishable_...` (pública por design) |
| Hospedagem | GitHub Pages (estático) | `.nojekyll`, PWA (`sw.js`, manifest) |
| Edge Functions | **nenhuma** | confirmado via `list_edge_functions` |
| Storage | **nenhum bucket** | confirmado via `storage.buckets` |

---

## C. Diagrama lógico (fluxo de dados atual)

```
IMPORTAÇÃO (opcional)                     EDIÇÃO MANUAL (Lançamentos)
  planilha .xlsx                            inputs .edinp → commit()
     │ parseWB()                                 │
     ▼                                           ▼
  mergeImport(D, fresh) ─────────────────► objeto  D  (em memória)
                                              │
                    ┌─────────────────────────┼───────────────────────────┐
                    ▼                          ▼                           ▼
             saveLocal()               renderAll()                  scheduleCloud()
        localStorage (offline)     12 views / charts            cloudSave() → upsert
                                                                     │
                                                                     ▼
                                              painel_estado.dados (jsonb)  ← VERDADE
                                                                     │ (4 gatilhos)
                        ┌────────────────────────────────────────────┼──────────────┐
                        ▼                    ▼                        ▼              ▼
                  tg_painel_touch    tg_painel_snapshot        tg_painel_bi   tg_painel_bi_lanc
                 (atualizado_em)   (painel_historico)      (reconstrói 15 bi_*) (bi_lancamentos)
                                                                     │
                                                                     ▼
                                    16 tabelas bi_* (espelho relacional, read-only p/ o usuário)
```

Leitura na volta: no login, `cloudLoad()` lê `painel_estado.dados` → `hydrate(D)`
→ `renderAll()`. As tabelas `bi_*` **não são lidas pelo app** — existem só para
consulta SQL/BI externa.

---

## D. Tabelas existentes (schema `public`, 18 tabelas — todas com RLS)

| Tabela | Papel | Linhas | Escopo |
| --- | --- | --- | --- |
| **painel_estado** | **Fonte da verdade** (documento `jsonb` por usuário) | 1 | `(user_id, empresa)` |
| painel_historico | Versões/snapshots do estado | 12 | `user_id` |
| membros | **RBAC** (email, papel, abas, ativo) | 1 | por `email` |
| bi_clientes | Espelho: clientes (nome, grupo, receita, ha) | 26 | `user_id` |
| bi_servicos | Espelho: serviços por safra | 9 | `user_id` |
| bi_visitas | Espelho: visitas/relatórios/km por cliente | 38 | `user_id` |
| bi_grupos | Espelho: grupos de serviço + custo direto | 3 | `user_id` |
| bi_funil | Espelho: funil de vendas | 0 | `user_id` |
| bi_safras | Espelho: receita/custo por safra | 4 | `user_id` |
| bi_caixa_mensal | Espelho: fluxo de caixa mensal | 12 | `user_id` |
| bi_metas | Espelho: metas de receita/hectares | 1 | `user_id` |
| bi_custos_mensais | Espelho: custo mensal por categoria | 288 | `user_id` |
| bi_equipe_indicadores | Espelho: indicadores por colaborador | 13 | `user_id` |
| bi_custo_categoria | Espelho: custo anual por categoria (2025/2026) | 48 | `user_id` |
| bi_proj_gastos | Espelho: projeção de gastos mensal | 12 | `user_id` |
| bi_operacao_situacao | Espelho: situação das operações | 5 | `user_id` |
| bi_operacao_etapas | Espelho: etapas das operações | 4 | `user_id` |
| bi_cross_sell | Espelho: matriz cliente × serviço | 324 | `user_id` |
| bi_lancamentos | Espelho: base única de custos por lançamento | 17 | `user_id` |

**Migrations:** 25 (todas aplicadas; ver `list_migrations`). **Edge Functions:**
0. **Storage:** 0 buckets. **Usuários reais:** 1 (`auth.users`). **Empresas
distintas:** 1 (`'DF AGRO'`).

### Funções no banco

- **ETL:** `bi_rebuild`, `bi_lancamentos_rebuild`, `bi_clear`, `bi_num`.
- **RBAC:** `is_admin`, `is_membro_ativo`, `pode_editar`, `meu_papel`,
  `meu_email`, `vincular_meu_usuario`, `membros_guard_last_admin`.
- **Gatilhos:** `tg_painel_bi`, `tg_painel_bi_lanc`, `tg_painel_snapshot`,
  `tg_painel_touch`.

---

## E. Relacionamentos (o que existe vs o que a especificação assume)

### O que EXISTE

- Toda tabela `bi_*`, `painel_estado` e `painel_historico` referencia
  `auth.users(id)` via `user_id` (FK). `membros` referencia `auth.users` via
  `user_id` (nulo até o 1º login).
- **Não há chaves estrangeiras entre as tabelas de negócio.** Elas são planas e
  desnormalizadas; a "junção" entre cliente, serviço, safra e custo é feita por
  **texto** (nome do cliente, nome do serviço, rótulo da safra) dentro do JSON e
  replicada assim nos espelhos. Ex.: `bi_cross_sell.cliente` é o nome do cliente
  como string, não um FK.
- `bi_lancamentos` é a única tabela transacional de granularidade fina (um custo
  por linha, com dimensões: competência, natureza, centro de custo, colaborador,
  categoria, cliente, serviço, veículo).

### O que a especificação mestre assume e **NÃO existe**

| Entidade da spec | Existe? | Realidade |
| --- | --- | --- |
| Organização / Empresa (tenant) | ❌ | `empresa` é um literal `'DF AGRO'` fixo, não uma tabela |
| Cliente | ⚠️ parcial | Existe como registro **plano** (nome, grupo, receita, ha) — sem hierarquia |
| Fazenda | ❌ | Nenhuma tabela, coluna ou campo JSON |
| Talhão | ❌ | Nenhuma tabela, coluna ou campo JSON |
| Safra | ⚠️ parcial | É um **rótulo global** (`24/25`…`27/28`), não uma entidade por talhão |
| Projeto AP | ❌ | Inexistente |
| Coleta / Pontos / Amostras | ❌ | "Coleta" existe só como **status agregado** de operação e categoria de custo |
| Laboratório / Análises de solo | ❌ | Só um número de "custo de laboratório" (188k) — sem resultados de análise |
| Mapas | ❌ | Nenhum dado geoespacial; sem PostGIS, sem Storage |
| Recomendação / Aplicação / Resultados | ❌ | Inexistentes |

---

## F. Fonte da verdade de cada dado

| Dado | Fonte da verdade | Como chega |
| --- | --- | --- |
| Todo o estado do painel | `painel_estado.dados` (jsonb) | `cloudSave` upsert; cache em `localStorage` |
| Clientes, serviços, safras, custos, funil, metas, equipe, operação | **o mesmo JSON `D`** (chaves internas) | editados à mão ou importados de `.xlsx` |
| Espelhos relacionais (`bi_*`) | **derivados** do JSON via ETL | reconstruídos a cada `UPDATE` em `painel_estado` |
| Versões/histórico | `painel_historico` | gatilho `snapshot` (BEFORE UPDATE) + backup manual |
| Papéis/permissões | `membros` (+ funções RBAC) | painel de Administração (admin) |
| Identidade | `auth.users` (Supabase) | login PKCE |

**Regra crítica para a IA:** a fonte da verdade é o **JSON `D`**; os `bi_*` são
**cópias derivadas read-only**. A IA deve **ler dos `bi_*`** (já relacionais,
com RLS) e **nunca escrever** em `painel_estado` diretamente — qualquer escrita
reconstrói o documento inteiro e dispara os 4 gatilhos.

---

## G. Segurança / RLS

- **RLS habilitado nas 18 tabelas.** Isolamento por `user_id` (`auth.uid() =
  user_id`). Confirmado por `list_tables` (rls_enabled=true em todas).
- **RBAC real no banco:** escrita em `painel_estado` exige `pode_editar()`
  (editor/admin); escrita em `membros` exige `is_admin()`; leitura exige
  `is_membro_ativo()`. Aplicado por **política RLS**, não só pela interface.
  Auto-promoção pelo console é bloqueada.
- **Funções ETL** (`bi_rebuild` etc.) têm `EXECUTE` revogado da API (`anon`/
  `authenticated`); só os gatilhos as executam.
- **Chave do front** = `sb_publishable_...` (anon/publishable) — **pública por
  design**, protegida por RLS. Não é um secret vazado.
- **Otimização RLS** já aplicada (migration `rls_initplan_optimize`): `auth.uid()`
  e funções envoltas em `(select ...)`.
- **Advisor de segurança** (atual): 6 avisos "SECURITY DEFINER executável por
  authenticated" (`is_admin`, `pode_editar`, `is_membro_ativo`, `meu_email`,
  `meu_papel`, `vincular_meu_usuario`) — **aceitáveis por design** (necessárias à
  RLS/RBAC e só expõem dados do próprio usuário) + 1 aviso de "Leaked Password
  Protection desativada" (pendência de painel; ver `AUDITORIA.md`).

**Referência completa da auditoria de segurança/dados/cálculos:** `AUDITORIA.md`.

---

## H. Componentes reutilizáveis (o que a IA pode aproveitar)

- **Camada de leitura pronta:** as 16 tabelas `bi_*` são um **modelo relacional,
  por usuário, com RLS** — a superfície ideal para as *READ tools* da IA, sem
  duplicar nada.
- **Cliente Supabase já inicializado** no front (`sb`) com sessão PKCE.
- **RBAC/escopo** já resolvido por funções (`meu_papel`, `is_membro_ativo`).
- **Motor de cálculo** (no `index.html`): funções puras já testadas para margem,
  comissão (`comissaoSobre`), break-even (`contribHa`), DRE, custo/ha — regras de
  negócio que a IA deve **consultar/explicar**, não recalcular por conta própria.
- **Padrão de UI:** `kpi()`, `mk()` (charts), `.view`/`#tabs`, `esc()` (escape) —
  uma nova aba "Inteligência Artificial" seguiria o mesmo padrão, aditivamente.
- **PWA/offline** (`sw.js`) e **tema** já existentes.

---

## I. Pontos frágeis

| # | Ponto frágil | Sev. |
| --- | --- | --- |
| I1 | **Estado é um único documento JSON** reescrito por inteiro a cada save — qualquer escrita concorrente/parcial arrisca sobrescrever tudo | ALTO |
| I2 | **Junções por texto** (nome do cliente/serviço como string) — sem FK, sujeito a divergência de grafia entre módulos | MÉDIO |
| I3 | **`bi_lancamentos` sem FK** para `auth.users` (as demais têm) — inconsistência de modelagem | BAIXO |
| I4 | **Sem backend/runtime próprio** — não há onde rodar orquestrador, fila, worker ou guardar secret de IA | ALTO (p/ IA) |
| I5 | **Tudo em 1 arquivo de 4.404 linhas** — dificulta modularização; toda mudança toca o mesmo arquivo | MÉDIO |
| I6 | **Empresa fixa (`'DF AGRO'`)** — o "multi-tenant" é só `user_id`; não há `company_id`/`tenant_id` real | MÉDIO |

---

## J. Dívida técnica relevante

- **Modelo desnormalizado por design:** ótimo para um painel pessoal, limitante
  para IA agronômica fina (não há grão de talhão/coleta/amostra).
- **Multi-tenant aspiracional:** `CLAUDE.md` exige respeitar `tenant_id`/
  `company_id`, mas eles não existem — hoje o isolamento real é por `user_id`.
- **Sem camada de servidor:** a spec mestre (AI Gateway, Orchestrator, Worker,
  Queues, WhatsApp Gateway, Approval Engine) não tem host atualmente.
- **Acoplamento de UI+lógica+dados** no mesmo arquivo dificulta testes unitários
  isolados (hoje testados via Playwright headless).

---

## K. Onde encaixar a IA sem duplicar estrutura

**Princípio (do `CLAUDE.md`): a IA é uma camada SOBRE a plataforma, lendo a fonte
oficial via ferramentas controladas — nunca uma segunda base.**

1. **READ tools → leem dos `bi_*` (não do JSON, não escrevem).** Mapeamento
   realista das *tools iniciais* da spec:

   | Tool da spec | Backing real hoje | Situação |
   | --- | --- | --- |
   | `get_client` | `bi_clientes` (+ `bi_cross_sell`, `bi_visitas`) | ✅ viável |
   | `get_costs` | `bi_lancamentos`, `bi_custos_mensais`, `bi_custo_categoria`, `bi_proj_gastos` | ✅ viável |
   | `get_season` | `bi_safras`, `bi_servicos` (rótulo global) | ⚠️ parcial (safra não é por talhão) |
   | `get_farm` / `get_field` | — | ❌ **sem dados** (não construir/inventar) |
   | `get_soil_analysis` / `get_maps` / `get_yield_data` | — | ❌ **sem dados** |
   | `get_collection_status` | `bi_operacao_situacao/etapas` (agregado) | ⚠️ só status agregado, sem pontos/amostras |

2. **Backend da IA = novo, mas ADITIVO.** Introduzir **Supabase Edge Functions**
   como AI Gateway/Orchestrator (guardam o `ANTHROPIC_API_KEY` no servidor,
   conforme `CLAUDE.md`), chamando as READ tools que consultam os `bi_*` sob a
   sessão/paapel do usuário. Nada disso altera o app atual.
3. **Tabelas novas da IA = aditivas** (`CREATE TABLE`/`CREATE POLICY`), em
   namespace próprio (`ai_*`): conversas, mensagens, memória, base de
   conhecimento (`pgvector`). Não tocam `painel_estado` nem os `bi_*`.
4. **UI = nova aba aditiva** ("Inteligência Artificial") no `index.html`,
   seguindo o padrão `.view`/`#tabs`, sem mexer nas views existentes.
5. **Decisão de produto necessária antes das tools de AP fina:** as tools de
   fazenda/talhão/coleta/amostra/análise/mapa **não têm dados**. Ou (a) a IA
   opera sobre o modelo atual (cliente/serviço/safra/custos — gestão), ou (b) a
   plataforma primeiro cria o modelo relacional de AP. **Construir essas tools
   hoje violaria a regra "nunca inventar valores".**

---

## L. Riscos (classificados)

| # | Risco | Sev. | Mitigação |
| --- | --- | --- | --- |
| L1 | Construir tools de AP (fazenda/talhão/coleta/amostra/mapa) sobre dados inexistentes → IA "inventa" | **ALTO** | Só implementar tools com backing real (`get_client`, `get_costs`, `get_season`); as demais aguardam modelo de dados |
| L2 | IA escrever em `painel_estado` e corromper o documento único | **ALTO** | Fase inicial **READ-ONLY**; escrita só via SENSITIVE_WRITE com Approval Engine, e nunca no blob diretamente |
| L3 | Secret de IA (`ANTHROPIC_API_KEY`) exposto no front estático | **ALTO** | Obrigatório backend (Edge Function); `CLAUDE.md` proíbe secret no front |
| L4 | Assumir multi-tenant (`company_id`) que não existe → escopo errado | **MÉDIO** | Escopar por `user_id`/`membros` (realidade); tratar multi-tenant como projeto futuro explícito |
| L5 | Divergência de nomes (junção por texto) gerar respostas inconsistentes | **MÉDIO** | Normalizar nomes nas tools; usar `bi_*` como fonte única de leitura |
| L6 | Crescimento do `index.html` monolítico ao adicionar UI de IA | **MÉDIO** | Aba isolada e, se possível, JS de IA em arquivo próprio (aditivo) |
| L7 | Custo/latência de chamadas LLM sem fila | **BAIXO** | Introduzir fila/worker só quando houver automações (fase posterior) |

---

## M. Recomendações

1. **Não** implementar nenhuma tool cujo dado não exista hoje (fazenda, talhão,
   coleta fina, amostra, análise de solo, mapa, produtividade). Respeitar
   "nunca inventar valores".
2. **Fundação da IA primeiro (aditiva):** Edge Function AI Gateway + tabelas
   `ai_*` + 2–3 READ tools reais (`get_client`, `get_costs`, `get_season`) lendo
   dos `bi_*`. Zero alteração no app atual.
3. **READ-ONLY na primeira versão.** Nenhuma escrita da IA em dados de negócio.
   SAFE_WRITE/SENSITIVE_WRITE só depois, com Approval Engine.
4. **Definir com o dono** se a plataforma vai evoluir para o modelo relacional de
   AP (fazenda/talhão/coleta/amostra/análise/mapa). É pré-requisito para o
   "Agente de AP" completo da spec — e uma decisão de produto, não técnica.
5. **Escopar por `user_id`/`membros`** (realidade) e documentar que
   `tenant_id`/`company_id` são trabalho futuro.
6. **Manter os `bi_*` como contrato de leitura da IA** — estáveis, relacionais,
   com RLS; é o encaixe natural sem duplicar estrutura.

---

## N. Arquivos que provavelmente serão afetados (nas próximas fases)

> Nesta Fase 0 **nada foi alterado**. Abaixo, a previsão para as fases seguintes,
> priorizando o caráter **aditivo**.

| Item | Tipo | Natureza |
| --- | --- | --- |
| `supabase/functions/ai-gateway/*` (novo) | Edge Function | **novo** (backend de IA + secret) |
| Migrations `ai_conversations`, `ai_messages`, `ai_memory`, `ai_knowledge` (+ `pgvector`) | SQL aditivo | **novo** (`CREATE TABLE`/`POLICY`) |
| READ tools (`get_client`, `get_costs`, `get_season`) | código da Edge Function | **novo** (consultam `bi_*`) |
| `index.html` — nova aba/`view` "Inteligência Artificial" | frontend | **aditivo** (não altera views existentes) |
| `docs/ai/02-ARQUITETURA-*.md` (próxima fase) | documentação | **novo** |
| `painel_estado`, `bi_*`, `membros`, funções/gatilhos atuais | banco existente | **NÃO alterar** (leitura apenas) |

---

## Conclusão da Fase 0

A plataforma é um **painel de gestão single-tenant (1 usuário, empresa fixa)**,
com estado em **um documento JSON** espelhado em **16 tabelas relacionais `bi_*`
com RLS**, sem backend próprio, sem Storage e sem o modelo relacional de AP
(fazenda/talhão/coleta/amostra/análise/mapa) que a spec mestre pressupõe.

A IA pode ser encaixada **de forma aditiva e READ-ONLY**, lendo dos `bi_*` via um
**backend novo (Edge Functions)** que guarda o secret, com 2–3 tools que **têm
dados reais**. As tools de AP fina dependem de uma **decisão de produto** sobre
evoluir (ou não) o modelo de dados — e não devem ser construídas antes disso,
sob pena de violar a regra "nunca inventar valores".

**Próxima fase sugerida:** `ARQUITETURA` — desenhar a fundação aditiva (Edge
Function AI Gateway, tabelas `ai_*`, contrato das READ tools sobre os `bi_*`,
escopo por `user_id`/`membros`), **sem implementar ainda**.

**PARADA obrigatória.** Nenhuma fase seguinte será iniciada sem ordem explícita.
