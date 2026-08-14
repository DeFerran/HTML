# 07 — Auditoria do perfil OPERADOR / COLABORADOR

Prioridade do operador: RAPIDEZ + SIMPLICIDADE + POUCOS CLIQUES + BAIXA CHANCE
DE ERRO.

## Respostas diretas

| O operador consegue… | Hoje | Comentário |
|---|:--:|---|
| **Lançar rápido?** | 🟡 | 3 cliques + 13 campos para uma despesa; sem lançamento rápido. |
| **Usar no celular?** | 🟡 | funciona (drill-in, cards), mas Valor R$ abre teclado alfabético. |
| **Corrigir erro?** | 🟡 | editar é fácil; validação fraca; exclusão inline sem confirmação. |
| **Entender obrigatórios?** | 🔴 | só "Valor" é obrigatório e não há marcação visual de obrigatório. |
| **Salvar sem dúvida?** | ✔/🟡 | auto-save é seguro, mas sem "✓ salvo" por registro; some no drill-in mobile. |
| **Fazer vários lançamentos seguidos?** | 🔴 | **não há "salvar e criar outro"** — reabre o fluxo a cada um. |

## Onde serve bem o operador
- **Auto-save**: nunca perde o formulário por esquecer de salvar. Grande força
  para uso diário e internet ruim (local-first).
- **Categoria → Natureza automática** na despesa (uma relação inteligente real).
- **Receita calculada** (Área × Preço/ha) em Clientes/Serviços/Funil — menos
  digitação e menos erro.
- **Importar custos atuais** (banner) para popular a base sem digitar tudo.
- **Modais operacionais** (Coleta/Amostras/Entregas) mantêm o foco na tarefa.
- **Confirmação ao excluir** nos formulários de card (Despesas/Recorrências/
  Veículos).

## Onde atrapalha o operador
1. **Sem lançamento rápido.** Para lançar uma despesa: Lançamentos → passar por
   toolbar de 6 botões + banner de import → Despesas → + Nova despesa. O FAB
   existente é o Copiloto de IA, não um "+ Lançar".
2. **13 campos de uma vez** na despesa, sem "mais detalhes" — o operador
   "pensa onde clicar" (o oposto do objetivo).
3. **Sem "salvar e criar outro"** — quem lança 10 despesas repete o fluxo 10×.
4. **R$ sem teclado numérico** no celular (Despesas/Metas) — digitação lenta e
   propensa a erro.
5. **Obrigatórios invisíveis** — nada marca o que é preciso preencher; só um
   `alert()` se o Valor ≤ 0.
6. **Exclusão inline sem confirmação** — nas tabelas (Serviços, Funil, Custos,
   Equipe, Coleta, Estrutura, Operação, Clientes) um clique no "✕ Remover" apaga
   a linha sem perguntar. Risco real no uso rápido/celular.
7. **Sem comprovante/anexo** — não dá para fotografar a nota junto da despesa.
8. **Feedback por registro ausente** — não aparece "✓ Despesa salva"; e no
   drill-in mobile o indicador global some.

## Contexto automático (Fase 6/13)
- **Existe:** Categoria→Natureza (auto-preenche). Cálculos derivados (Receita,
  Contribuição, Valor ponderado do funil).
- **Não existe:** herança de contexto entre telas (não há "Cliente X →
  Fazenda Y → Talhão 03" — a dimensão fazenda/talhão nem existe). Não há
  dropdowns dependentes cliente→fazenda→talhão (não se aplica ao modelo atual).
- **Defaults ausentes:** Data não vem "hoje"; Forma de pgto/Status não têm
  default; nada é "lembrado" do lançamento anterior.

## Prevenção de erros (Fase 10)
- ✔ Não perde formulário (auto-save local).
- ✔ Valor ≤ 0 bloqueado.
- 🔴 Duplo clique / salvar 2× e duplicidade: **sem proteção explícita** (o
  auto-save mitiga, mas "+ Nova despesa" seguido pode gerar registros repetidos
  sem aviso).
- 🔴 Exclusão inline sem confirmação.
- 🟡 Sem spinner/retry por requisição de sincronização (baixo risco por design
  local-first, mas sem feedback claro de "sincronizando/falhou").

## Recomendações para o operador (a validar — não implementar)
1. **FAB "+ Lançar"** (Despesa/Coleta/Entrega/Observação) já no contexto da
   safra — corta a jornada para 2 cliques.
2. **Despesa progressiva**: 4 campos principais + "Mais detalhes"; **[Salvar e
   criar outro]**; Data=hoje; lembrar Centro/Forma/Status anteriores.
3. **`inputmode="decimal"`** nos campos R$ da área financeira (paridade com os
   editores em tabela).
4. **Confirmação de exclusão** (ou "desfazer" por alguns segundos) nas tabelas
   inline.
5. **Feedback por registro**: "✓ Lançamento salvo" (toast) e manter o indicador
   de salvo visível no drill-in mobile.
6. **Marcar obrigatórios** e validar antes de salvar (sem travar o fluxo comum).

**Nota Operador: 60/100** — a base local-first é excelente, mas a falta de
lançamento rápido, salvar-e-novo e teclado numérico no R$ pesa no uso diário.
