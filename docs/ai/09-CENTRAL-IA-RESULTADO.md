# Fase 09 — Central de IA administrativa — Resultado

**Data:** 2026-08-13
**Fase:** Central de IA administrativa (Visão Geral, Agentes, Histórico &
Auditoria reais; demais telas "Em implantação"). Sem automações reais, sem
WhatsApp, sem funcionalidade falsa.
**Regra-mãe:** a IA é uma CAMADA. Esta fase é **100% front-end aditivo** no
`index.html`, **somente para administradores**. Backend e banco **inalterados**.

---

## 1. Objetivo realizado

Central administrativa da IA, acessível **apenas a admin**, com:
- **submenus** na sidebar e em abas internas: Visão Geral, Copiloto AP, Agentes,
  Automações, Alertas Inteligentes, Conhecimento, Memória, WhatsApp, Aprovações,
  Histórico & Auditoria, Configurações;
- telas ainda não liberadas exibidas como **"Em implantação"** — **sem
  funcionalidade fictícia**;
- **Visão Geral** e **Histórico & Auditoria** com **dados reais**;
- **Agentes** somente-leitura (system prompt/modelo **não editáveis** pela UI).

## 2. Mapeamento à realidade (importante)

O pedido cita `ai_agent_runs` e `ai_tool_calls`. Na plataforma real esses são o
mesmo `ai_audit_log` (doc 02 §7): `tipo='run'` = execuções do agente;
`tipo='tool_call'` = chamadas de ferramenta. A Central usa a **fonte real**:

| Pedido | Fonte real |
| ------ | ---------- |
| ai_agent_runs | `ai_audit_log` (tipo='run') |
| ai_tool_calls | `ai_audit_log` (tipo='tool_call') |
| ai_conversations / ai_messages | tabelas homônimas |
| Knowledge Base | `ai_knowledge_docs` / `ai_knowledge_chunks` |
| Memory | `ai_memory` |

## 3. Acesso restrito (admin)

- A aba/entrada da Central só aparece para **admin** (`ehAdmin`) — gate em
  `aplicarPermissoes()`; a sidebar espelha (mirrorSidebarPerms) e some para
  não-admin.
- **Defesa em profundidade:** `renderIAHub()` e cada painel checam `ehAdmin` e
  mostram **"Acesso restrito"** se alguém forçar a rota.
- Regra pura testável: `iaAdminAllowed(papel) === (papel==='admin')`.
- **Backstop de dados:** RLS — `ai_audit_log` expõe cross-usuário só via
  `is_admin()`; as demais `ai_*` são por dono (single-tenant hoje ⇒ um usuário).

## 4. Visão Geral — KPIs (dados reais)

| KPI | Cálculo |
| --- | ------- |
| **status** | Operacional / Atenção (erros > 20%) / Sem uso. |
| **execuções** | count `ai_audit_log` tipo='run'. |
| **sucessos** | count run ok=true (+ % de êxito). |
| **erros** | count run ok=false. |
| **tempo médio** | média de `latencia_ms` (amostra dos últimos 500 runs). |
| **tokens** | soma de `tokens` (amostra recente). |
| **custo estimado** | Σ tokens × preço/1M por modelo (blended aprox.) — rotulado **estimativa**; "—" se sem tokens (**"quando disponível"**). |
| **tools mais utilizadas** | top por `tool` em `ai_audit_log` tipo='tool_call'. |

Painéis extras: documentos (indexados), conversas/mensagens, memória
validada/pendente. Cada bloco declara sua **fonte**.

## 5. Histórico & Auditoria (colunas pedidas)

Tabela dos últimos 100 runs: **usuário** (e-mail do próprio / `user_id` curto),
**agente** ("Copiloto DF AGRO"), **pergunta** (título da conversa em
`ai_conversations`), **tools** (ferramentas usadas na conversa, de
`ai_audit_log`), **resultado/status** (sucesso/erro + detalhe), **duração**
(`latencia_ms`), **data** (`criado_em`).

## 6. Agentes (sem alteração perigosa)

Somente-leitura: agente, provedor (Anthropic), modelo ("definido no backend —
não editável aqui"), níveis (READ / SAFE_WRITE), **system prompt 🔒 protegido no
backend (não editável)**, e a lista de ferramentas. **Nenhum campo editável é
oferecido** — atende "não permitir alteração perigosa de system prompt sem
controle".

## 7. Telas "Em implantação"

Automações, Alertas Inteligentes, WhatsApp, Aprovações, Configurações: painel com
badge **Em implantação** + uma linha do que farão. **Sem inputs, sem ações, sem
números inventados.**

## 8. Arquivos

**Modificados**
- `index.html` — aditivo: 1 aba (`iahub`, admin) + 1 `<section>` + seção
  "Inteligência Artificial" na **sidebar** (11 submenus) + 1 bloco de funções
  (`iahub*`, `iaAdminAllowed`) + CSS. 4 linhas de wiring
  (tab-handler, `aplicarPermissoes`, sidebar-click com `data-ia`).
  **Nenhuma view/dado existente alterado; CSP intocada.**

**Criados**
- `docs/ai/09-CENTRAL-IA-RESULTADO.md`

**Backend/BD:** nenhuma mudança.

## 9. Testes executados

### Teste de permissões (Chromium headless / Playwright) — **PASSOU**

Dois cenários controlando o retorno de `meu_papel` (admin vs leitor):

| Verificação | admin | leitor |
| ----------- | ----- | ------ |
| `ehAdmin` | true | false |
| Aba Central visível | **sim** | **não** |
| `renderIAHub()` forçado | mostra a Central (11 submenus) | mostra **"Acesso restrito"** (0 submenus) |
| `iaAdminAllowed(papel)` | true | false |
| Erros de JS | 0 | 0 |

→ Confirma que **usuários comuns não acessam a administração da IA**, mesmo
forçando a rota. A Visão Geral carregou os KPIs (dados stubados) sem erro.

### Sintaxe / regressão

- Sintaxe de todos os scripts inline do `index.html`: **OK**.
- Suite de backend (bun): **34/34** (nada no backend mudou nesta fase).

## 10. Riscos

| Risco | Nível | Observação |
| ----- | ----- | ---------- |
| Não-admin ver administração | BAIXO | Gate de UI + guarda em cada painel + RLS. |
| Números inventados | NENHUM | Telas futuras não exibem dados; KPIs vêm de `ai_*`. |
| Custo "real" confundido com fatura | BAIXO | Rotulado **estimativa** por modelo. |
| Poluir `index.html` | BAIXO | Aditivo, atrás de flag; rollback simples. |

## 11. Rollback

- `desativarPainelIA()` / `df_ia_kb='0'` esconde tudo (Central inclusa).
- Reverter o commit do `index.html` remove a Central por completo.
Nada afeta backend, `painel_estado`, `bi_*` ou `membros`.

## 12. Pendências

- Telas "Em implantação" serão fases próprias (Automações, Alertas, WhatsApp,
  Aprovações, Configurações), cada uma com testes e relatório.
- Multi-usuário: quando houver mais de um usuário, as `ai_*` (exceto audit)
  precisarão de leitura admin cross-usuário para os KPIs somarem todos — hoje é
  single-tenant, então não se aplica.

## 13. Próxima fase sugerida

- **Aprovações (Approval Engine)** — a trava de segurança das ações
  SENSITIVE_WRITE (doc 02 §15), antes de qualquer automação.

**Não iniciar sem ordem explícita do usuário.**

---

_PARADO conforme a regra de implementação incremental._
