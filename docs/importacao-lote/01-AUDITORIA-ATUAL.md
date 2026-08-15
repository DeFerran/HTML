# 01 — Auditoria da arquitetura atual de Lançamentos

> FASE 0 do "Prompt — Central de Lançamentos em Lote + Excel Premium + Replicação".
> **Nada foi alterado no código do app.** Este documento descreve o que EXISTE hoje,
> com citações `index.html:linha`, e serve de base para o desenho proposto.

---

## 0. Descoberta central (define todo o resto)

A plataforma **não tem tabelas relacionais por lançamento**. Toda a base de dados é
**um único objeto JavaScript `D`** persistido como **um blob JSON**:

- Cliente escreve o `D` inteiro em `painel_estado` (uma linha por `user_id + empresa`):
  `sb.from('painel_estado').upsert({user_id, empresa:'DF AGRO', dados:D}, {onConflict:'user_id,empresa'})` — `index.html:7311`.
- Também persistido em `localStorage` (`SKEY`) — `index.html:1920`.
- `commit()` = `schedulePersist()` (debounce → local + nuvem) + `scheduleDash()` — `index.html:4211`.

**Consequências que moldam este projeto:**
1. Não existe "INSERT por linha", nem RLS por linha, nem dedupe em SQL. Cada "tabela" é
   um **array dentro de `D`** (`D.lancamentos`, `D.opColeta.lancamentos`, …).
2. O "serviço central de lançamentos" pedido no prompt **será um módulo JS client-side**
   (ex.: `LancService`) que todas as entradas (manual/Excel/replicação) chamam — não um
   endpoint. A "autoridade do backend" aqui = esse módulo + a RLS de `painel_estado`
   (que garante que cada usuário só grava o próprio snapshot).
3. `import_batches`/`import_rows` como **tabelas** contrariariam o modelo (CLAUDE.md: "não
   criar segunda base"). O staging será **em memória**; o histórico de importações será um
   **array persistido dentro de `D`** (ex.: `D.importHistory`).

Isto **não enfraquece** os requisitos do prompt (append-only, staging→preview→confirmar,
dedupe em 3 camadas, replicação vs rateio, auditoria). Só muda ONDE eles vivem: no módulo
central JS e em `D`, não em SQL.

---

## 1. Como o lançamento manual funciona hoje?

Fluxo (aba **Lançamentos** = `v-edit`, `index.html:1469`):

- Form em `_despForm` (objeto em edição; `null` = fechado) — `index.html:5261`.
- `novoLancForm()` cria um rascunho com data=hoje e **reaproveita** Centro/Forma/Status do
  último lançamento (`_ultLanc`) para lançar em série com menos digitação — `index.html:5285`.
- `salvarLancForm()` valida, normaliza, gera `id` e faz `push`/replace em `D.lancamentos`,
  depois `commit()` — `index.html:5275`.
- `salvarLancFormNovo()` salva e já abre outro — `index.html:5284`.
- Render do form + tabela: `renderDespesas()` — `index.html:5292`.

**Campos do lançamento de despesa** (widget real, `index.html:5314-5326`):

| Campo | Widget | Fonte | Obrigatório |
|---|---|---|---|
| Data | `<input type=date>` | — | não (deriva competência) |
| Descrição | texto | — | não |
| **Valor (R$)** | decimal | — | **sim (>0)** |
| Natureza | select | `NATUREZAS` (const) | não |
| Centro de custo | select | `D.centrosCusto` | não |
| Categoria | select | `D.categorias` | não (dirige Natureza) |
| Colaborador | select | `D.colaboradores` | não |
| Cliente | select | `D.clientes` | não |
| Serviço | select | `D.servicos` | não |
| Veículo | select | `D.veiculos` | não |
| Forma pgto | select | `FORMAS_PGTO` (const) | não |
| Status | select | `STATUS_LANC` (const) | não |
| Observação | texto | — | não |

Todos os relacionamentos são **por nome** (string), escolhidos em **dropdown** — não há FK
por ID. Isso é ótimo para o Excel (os mesmos dropdowns viram listas de validação), mas
**exige revalidação por nome** na importação.

---

## 2. Qual é a fonte oficial?

- **Despesas/custos:** `D.lancamentos` (array). É a base única do financeiro — dela saem
  DRE, fluxo de caixa, custos, metas realizado (`realizadoOrc`, `index.html:5439`). Semente
  garante o array em `index.html:1832`.
- Não há "segunda base": os relatórios **derivam** de `D.lancamentos` em tempo de render
  (funções puras/filtros), não gravam cópia. Padrão a preservar.

### Tipos REAIS de lançamento encontrados (não presumidos)

| Tipo | Array fonte | Entrada | Import existente |
|---|---|---|---|
| **Despesas / custos** | `D.lancamentos` | form manual (`renderDespesas`) | — (só migração 1×) |
| **Coleta de pontos** | `D.opColeta.lancamentos` | modal (`opColetaSalvar` `:2613`) | **CSV append-only** `:2639` |
| **Envio de amostras** | `D.opAmostras.remessas` | modal | **CSV append-only** `:2648` |
| **Controle de entregas** | `D.opEntregas.linhas` | matriz/checklist | **CSV append-only** |
| **Funil de vendas** | `D.funil` | form | — |
| **Orçamentos comerciais** | `D.quotes` | wizard `qz*` | — |
| **Recorrências** (gera despesas) | `D.recorrencias` | form | idempotência por chave |
| **Metas orçadas** (orçado×realizado) | `D.orcamentos` | form | — |

Observações:
- **Não há "Receitas" como ledger próprio.** Receita é derivada (carteira/serviços/funil/
  quotes). O prompt cita "Receitas" como exemplo conceitual — aqui o candidato natural a
  import em lote é **Despesas** e **Coleta** (que já tem CSV).
- **"Talhão" não é um cadastro**: é **texto livre** em coleta/amostras (`talhao`), não há
  `D.talhoes`. Relevante para dropdowns/validação.

---

## 3. Quais cálculos acontecem ao salvar?

Ao salvar uma despesa (`salvarLancForm`, `:5275-5282`):
- `valor` → número; se `data` e sem `competencia` → `competencia = data.slice(0,7)`;
- push/replace em `D.lancamentos`; `commit()`.
- **Nenhum cálculo financeiro pesado no save.** O cálculo é **no render** (DRE, custos,
  metas) via derivações puras sobre `D.lancamentos`. Ou seja: a "regra de negócio ao salvar"
  é só normalização (competência, natureza a partir da categoria via `natDaCategoria`,
  `:5358`). **O import deve aplicar exatamente essa mesma normalização** (é barato e central).
- **Recorrências** (`gerarRecorrencias`, `:5378`) materializam despesas mensais com
  `origem='recorrencia'`, **idempotentes por `recorrenteId|competencia`** (Object.assign na
  existente; remove órfãs). É o melhor exemplo de idempotência já no código — reaproveitável.

---

## 4. Quais validações existem?

- Despesa: **`valor > 0`** (única trava dura, `:5276`). Competência autopreenchida.
  Categoria dirige Natureza. Sem validação de FK (cliente/fazenda/etc. saem de dropdown, mas
  não há checagem no save — o dropdown é a única "garantia").
- Coleta: **`data` obrigatória** (`:2616`, `:2644`).
- Não há validação de duplicidade, nem de existência de nome em import CSV.

---

## 5. Existe prevenção contra duplicidade?

- **Não** para despesas nem coleta (append puro; `id` novo sempre).
- **Idempotência só nas recorrências** (chave `recorrenteId|competencia`).
- IDs: `uidLanc() = 'l'+Date.now(36)+random` (`:5254`); coleta `'opc'+…`; amostras `'opa'+…`.
  Baseados em tempo+random → **não idempotentes por conteúdo**. **Duplo clique/reupload
  geram duplicatas.** (Gap a resolver com `import_row_key` + fingerprint.)

---

## 6. Existe importação hoje?

Sim, e é o **melhor ponto de partida** (append-only, com confirmação):
- CSV de Coleta: `opColImport` (`:2639`), Amostras `opAmImport` (`:2648`), Entregas `opEnImport`.
- Padrão: `opReadFile` → `opParseCsv` → mapeia colunas do próprio Exportar → `confirm(
  'Serão ADICIONADOS aos existentes (nada é apagado)')` → `concat` → `commit()`.
- **Já cumpre "append only / nada é apagado"** — mas **sem** dedupe, preview, staging,
  classificação de linhas ou XLSX.
- **XLSX (SheetJS) já está carregado** e é usado para (a) importar snapshot completo
  (`XLSX.read`, `:4162`; helper `aoa`, `:4062`) e (b) **exportar um relatório multi-aba**
  (`XLSX.utils.book_new/aoa_to_sheet/writeFile`, `:7108-7142`). **Ler e gerar XLSX premium é
  viável sem lib nova.**
- Export CSV: `opDownload` + `opToCsv` (`:2622`, `:2479`).

---

## 7. Existe batch/bulk operation?

- **Não** como recurso de usuário. O mais próximo é `migrarCustos()` (importa o consolidado
  2026 uma única vez, com guarda `lancMigrado()`, `:5265`) e `gerarRecorrencias()`.
- Não há replicação, rateio, criação em lote, nem seleção múltipla de destinos.

---

## 8. Existe auditoria?

- Por registro de despesa: `criadoEm`, `criadoPor` (email do `sbUser`), `atualizadoEm`,
  `origem` (`'migracao'|'recorrencia'|`manual). Sem `historico[]` por lançamento
  (orçamentos têm `historico`; despesas não).
- Não há `source=EXCEL_IMPORT`, nem `import_batch_id`, nem `replication_group_id`.
- `ai_audit_log` (Supabase) existe, mas é para ações de IA — não cobre lançamentos.

---

## 9. Existe soft delete?

- Parcial: despesa com **`status='Cancelado'`** é **filtrada** de quase todos os cálculos
  (`.filter(l=>(l.status||'')!=='Cancelado')`, ex.: `:4916`, `:5439`, `:5495`). Funciona como
  soft-delete para o financeiro, mas `removerLanc` (`:5291`) faz **hard delete** (remove do
  array). Coleta: só hard delete (`:2620`).
- Não há tombstone universal nem "desfazer".

---

## 10. Como tenant/company são protegidos?

- **Single-tenant** (confirmado com você): `empresa` é a constante `'DF AGRO'` em todo lugar
  (`:7311`, `:7295`). Isolamento real = **RLS de `painel_estado` por `user_id`**.
- Como todo o `D` é um blob do próprio usuário, **importar/replicar só escreve no snapshot
  do próprio usuário**. O princípio "nunca confiar em tenant_id do XLSX" traduz-se aqui em:
  **ignorar qualquer coluna de tenant/ID do arquivo** e sempre usar o contexto autenticado
  (que já é implícito — o `D` é do usuário logado).

---

## 11. Campos obrigatórios por tipo

- **Despesa:** `valor > 0`. (Data opcional → competência derivada.)
- **Coleta:** `data`. (Colaboradores/pontos opcionais.)
- **Amostras:** `dataEnvio` (`:2650`).
- Os demais campos são opcionais no save atual.

---

## 12. Campos com relacionamentos

Por **nome** (não ID), resolvidos por dropdown a partir dos cadastros em `D`:

| Campo | Registro (`D.…`) | Helper |
|---|---|---|
| Cliente | `clientes` | `nomesClientes()` `:5663` |
| Fazenda | `fazendas` (tem `clienteNome`, `municipioNome`, `areaHa`) | `nomesFazendas()` `:5774` |
| Colaborador | `colaboradores` (ou `equipe.colaboradores`) | `nomesColaboradores()` `:5256` |
| Centro de custo | `centrosCusto` (ativo≠false) | `nomesCentros()` `:5257` |
| Categoria | `categorias` (ativo≠false) | `nomesCategorias()` `:5258` |
| Serviço | `servicos` | `nomesServicos()` `:5772` |
| Veículo | `veiculos` | — |
| Safra | `safrasList` / `safras.labels` | `:3921`, `:1988` |
| Natureza | `NATUREZAS` (const) | `:5251` |
| Forma pgto | `FORMAS_PGTO` (const) | `:5252` |
| Status | `STATUS_LANC` (const) | `:5325` |
| **Talhão** | **não existe cadastro** — texto livre | — |

---

## 13. Funcionalidades reaproveitáveis (não reinventar)

- **XLSX (SheetJS)** já carregado: `XLSX.read`/`utils.aoa_to_sheet`/`book_append_sheet`/
  `writeFile` — base para modelos premium e parser (`:4062`, `:7108`).
- **Import CSV append-only + confirmação** (`opColImport` `:2639`) — molde do fluxo seguro.
- **`opParseCsv`/`opToCsv`/`opReadFile`/`opDownload`** — I/O de arquivo.
- **Idempotência por chave** das recorrências (`:5379`) — molde do `import_row_key`.
- **Wizard 6 passos** dos orçamentos (`qzStep`, `ORC_STEPS`, CSS `.orc-steps`/`.orc-mobstep`)
  — molde direto do wizard de Replicação.
- **`resp-cards`** (tabela→cards no mobile, `:657`) e **`edForm`** (`:4282`) — UI pronta.
- **`commit()` + `D`** como fonte única — o serviço central escreve aqui.
- **Normalização de despesa** (`natDaCategoria`, competência) — reusar no import/replicação.
- **`sbUser`** (email/id) para autoria.

---

## 14. Riscos

1. **Idempotência inexistente por conteúdo** → duplo clique / reupload duplicam. (Mitigar:
   `import_row_key` na planilha + fingerprint + guarda de duplo clique.)
2. **Persistência em blob único**: importar centenas de linhas incha `D`; salvar reescreve
   o snapshot inteiro (não a linha). Volumes muito grandes (milhares) pesam no upsert e no
   `localStorage`. (Mitigar: limites configuráveis; avisar acima de N linhas; processar em
   lotes; medir tamanho.)
3. **Sem "backend" por linha**: não há como fazer RLS/validação por linha em SQL. A
   autoridade é o **módulo central JS** — precisa ser o único caminho de escrita, senão a
   garantia se perde. (Mitigar: canalizar manual/Excel/replicação por `LancService`.)
4. **Relacionamento por nome** (não ID): renome/typo quebra vínculo silenciosamente. Import
   deve **revalidar nomes** contra os cadastros e **sugerir** (não autocriar).
5. **`removerLanc` é hard delete** → um rollback de importação precisa de estratégia
   reversível (marcar `origem/import_batch_id` e permitir desfazer só o que o batch criou e
   não foi alterado).
6. **Snapshot do Excel envelhece**: cadastros mudam entre baixar e subir. Revalidar sempre
   contra o `D` atual (fazenda desativada, etc.).
7. **Mobile + XLSX**: edição de planilha no celular é ruim; priorizar manual/replicação/lote
   no mobile e reservar o Excel ao desktop (alinhado ao próprio prompt).
8. **`SheetJS 0.18.5`** tem CVEs históricos (ver auditoria de segurança, SEC-017); ler
   arquivo do usuário aumenta a superfície. (Mitigar: validar extensão/tamanho/estrutura;
   nunca executar fórmula; tratar conteúdo como dado.)

---

## Conclusão da FASE 0

O terreno é **favorável**: já existem o padrão append-only, o XLSX carregado, a fonte única
(`D`/`commit`), wizard e UI de cards. O principal a **construir** é: (a) o **serviço central**
`LancService` como único caminho de escrita; (b) **staging em memória + preview + classificação
de linhas**; (c) **dedupe em 3 camadas** (`import_row_key` → doc/código externo → fingerprint);
(d) **gerador XLSX premium** por tipo; (e) **replicação × rateio**; (f) **histórico/auditoria/
rollback** dentro de `D`. Tudo **client-side**, respeitando a arquitetura de blob e single-tenant.

O desenho detalhado vai para `02-ARQUITETURA-IMPORTACAO.md` **após sua aprovação** (abaixo).
