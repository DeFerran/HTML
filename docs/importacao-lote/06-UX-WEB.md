# 06 — UX Web (desktop)

## Central de Lançamentos

Ações principais na barra de cada tipo (Despesas em Lançamentos → Despesas;
Coleta em Coleta de Pontos):

`+ Novo` · `⧉ Replicar em lote` · `➗ Ratear em lote` · `📥 Importar em lote` ·
`📄 Baixar modelo` · `🕘 Histórico`

Cada registro na lista tem, além de **editar**/**✕**: **⧉ replicar** e **➗ ratear**
(pré-preenchem a base a partir do lançamento).

## Importação (overlay wizard)

1. **Ingestão:** selecionar `.xlsx`/CSV **ou** colar dados (com cabeçalho).
2. **Conferência (preview):** resumo em tiles clicáveis (Todas/Novas/Já existem/
   Possível dup./Atenção/Erro) + tabela filtrável. Linhas 🟡/🟠 têm "Importar como
   novo"; 🔴 mostram o motivo.
3. **Ação primária:** `IMPORTAR SOMENTE NOVAS (n)` — nunca "importar e substituir".

## Replicar / Ratear (overlays wizard)

Passo-a-passo com stepper clicável; **preview obrigatório** antes de criar
("criará N · total R$ X" / "Total econômico = original"). Rateio mostra a
reconciliação ao vivo e desabilita o avanço enquanto Σ ≠ 100%/total.

## Histórico

Overlay com **KPIs** (lotes hoje, registros criados, duplicidades evitadas, linhas
com erro) + tabela dos lotes (quando, tipo, origem, arquivo, contagens, status)
com **↩ Desfazer** por lote.

## Princípios aplicados

- Ações principais visíveis; importação/replicação/rateio em wizard; preview
  profissional; sem excesso de botões concorrentes.
- Tabelas largas usam `resp-cards` (viram cards no mobile) dentro de área com
  rolagem própria, mantendo a ação primária sempre visível.
