# 02 — Jornadas do usuário

Jornadas reais medidas por navegação headless. Cliques = interações até
**começar** a tarefa (fora o preenchimento de campos). "Mudança de contexto" =
troca de tela/seção.

## J1 — Gestor: "Qual é o principal problema hoje?" (GESTÃO · diária)
**Passos atuais:** abrir → cai na Visão Geral → **ler 14 KPIs + parágrafo** →
rolar 3,3 telas → interpretar.
- Cliques: 0 (já abre na Visão Geral) · Rolagens: ~2–3 · Mudanças de contexto: 0.
- **Fricção:** a tela não responde "o principal problema" — todos os KPIs têm
  peso igual, sem alerta destacado, sem seta de tendência. O gestor precisa
  **ler tudo e concluir sozinho**.
- **Fluxo ideal:** topo com 1 número-herói (margem líquida) + variação vs safra/
  mês anterior + faixa de 2–3 alertas ("o que exige atenção") com link direto.

## J2 — Gestor: "Ver custos deste mês" (GESTÃO · semanal)
**Passos:** abrir → sidebar **Custos & Coleta** (1) → rolar entre 21 KPIs + 6
gráficos (4,7 telas).
- Cliques: 1 · Rolagens: ~4 · Contexto: 1.
- **Fricção:** custo aparece em **geral, fin, metas e custos** com rótulos
  diferentes — ambiguidade. A tela Custos é densa (achar "custo do mês" exige
  garimpo).

## J3 — Gestor: "Comparar meses" (GESTÃO · mensal)
**Passos:** Financeiro (cCaixa/cTimeline) **ou** Custos (cEstrMes/cColetaMes).
- Cliques: 1 · **Fricção:** a comparação existe em **gráficos**, mas não há um
  "mês vs mês anterior" resumido em número/variação; o gestor lê barras.

## J4 — Operador: "Criar um novo lançamento (despesa)" (OPERAÇÃO · diária) ⚠️
**Passos atuais:** abrir → **Lançamentos** (1) → passar por toolbar (6 botões) +
banner de importação → seção **Despesas** (2) → **+ Nova despesa** (3) →
formulário com **13 campos** → Salvar lançamento (4).
- Cliques até o formulário: **3** · Campos: 13 (1 obrigatório: Valor) ·
  Dropdowns: 8 · Rolagens: 1–2 · Confirmação: 0 (salva direto) · Contexto: 2.
- **Fricção alta:** 13 campos de uma vez; nenhum "mais detalhes"; sem "salvar e
  criar outro"; no celular o Valor abre teclado alfabético; a Data é opcional
  (competência derivada) — bom, mas o resto compete por atenção.
- **Fluxo ideal:** Data (hoje por padrão) → Descrição → Valor (teclado numérico)
  → Categoria (auto-preenche Natureza) → **[Salvar]** / **[Salvar e novo]**;
  "Cliente/Serviço/Veículo/Centro/Forma/Obs" atrás de **"+ Mais detalhes"**.

## J5 — Operador: "Editar o lançamento recém-criado" (OPERAÇÃO · diária)
**Passos:** na tabela de Despesas → botão **editar** na linha → form de card.
- Cliques: 1 · **Fricção:** baixa no desktop; no celular a tabela vira card
  (`resp-cards`), então achar a linha e o "editar" é ok. **Excluir** pede
  confirmação (bom, aqui é card).

## J6 — Operador: "Registrar coleta pelo celular" (CAMPO · diária) ⚠️
**Passos:** abrir → **Coleta de Pontos** (sidebar, 1) → **+ Novo lançamento**
(2, abre **modal**) → data, equipe, cliente, fazenda, talhão, fator, status,
colaboradores+pontos → Salvar.
- Cliques até o modal: 2 · Campos no modal: vários + lista de colaboradores ·
  Contexto: 1 (modal).
- **Fricção:** modal em pé no celular é ok, mas há **8 filtros** na tela por
  baixo; o "fator ha/ponto" é `type=number` (bom, teclado numérico). Sem
  "salvar e novo" para lançar vários dias/equipes em sequência.

## J7 — Usuário: "Encontrar uma fazenda ou talhão" (AMBOS) 🔴
**Realidade:** **não há entidade fazenda/talhão** no modelo, nem busca global.
Trabalha-se por **Cliente** e **Serviço**. A palavra "fazenda" aparece em
formulários operacionais (Coleta/Amostras/Entregas) como **texto livre**, não
como cadastro pesquisável.
- **Fricção:** alta se o usuário espera navegar Cliente→Fazenda→Talhão (não
  existe). Não há campo de busca global por cliente/fazenda/serviço/colaborador.

## J8 — Usuário comete erro de preenchimento (recuperação)
- **Valor ≤ 0 na despesa:** `alert()` bloqueia — ok, mas alerta nativo (não
  inline no campo).
- **Demais campos:** quase **sem validação** — tabelas inline aceitam vazio/
  qualquer valor. O sistema **não perde** o formulário (auto-save), mas também
  **não avisa** o que está incompleto.
- **Excluir por engano:** nas **tabelas inline** o "✕ Remover" apaga **sem
  confirmação** (clique único) — risco real de perda.

## Resumo de fricção por jornada

| Jornada | Perfil | Cliques p/ iniciar | Fricção | Principal gargalo |
|---|---|--:|---|---|
| J1 Principal problema | Gestor | 0 | Média-Alta | sem hierarquia/alerta/tendência |
| J2 Custos do mês | Gestor | 1 | Média | tela densa + número duplicado |
| J3 Comparar meses | Gestor | 1 | Média | só em gráfico, sem variação-resumo |
| **J4 Nova despesa** | Operador | 3 | **Alta** | 13 campos, sem progressive/salvar-e-novo, R$ sem teclado |
| J5 Editar lançamento | Operador | 1 | Baixa | ok |
| **J6 Coleta no campo** | Operador | 2 | **Média-Alta** | sem salvar-e-novo; muitos filtros na tela |
| **J7 Achar fazenda/talhão** | Ambos | — | **Alta** | não existe entidade nem busca global |
| J8 Recuperar de erro | Ambos | — | Média | validação fraca; exclusão inline sem confirmação |

**Passos desnecessários mais comuns:** (a) para lançar uma despesa passa-se por
toolbar de 6 botões + banner de import antes do "+ Nova despesa"; (b) contexto
não é reaproveitado — não há "estou no Cliente X, crie algo já com X preenchido"
porque as telas não são hierárquicas por cliente.
