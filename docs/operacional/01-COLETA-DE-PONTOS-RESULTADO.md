# Controle Operacional — Tela 1: Coleta de Pontos Diários — Resultado

**Data:** 2026-08-14
**Origem:** PDF "DF AGRO — Controle Operacional" (3 telas: Coleta de Pontos,
Envio de Amostras, Controle de Entregas) + tema `temadfagro.css`.
**Fase:** primeira das 3 telas. Aditiva; não altera dados/lógica existentes.

## Decisões validadas com o dono

1. **Armazenamento:** no app (estado `D.opColeta`) + sincronização existente
   (`commit()`), como o resto do painel. Migração para tabelas Supabase + RLS fica
   para uma fase futura (entrada concorrente multiusuário).
2. **Ritmo:** uma tela por vez — esta é a Tela 1.
3. **Cadastros:** `Cliente` puxa de `D.clientes`; `Fazenda`/`Talhão` são campos
   operacionais livres com autocompletar (datalist) do que já foi digitado.
4. **Regras "a validar" (não inventadas):** tratadas como parâmetros. `Hectares
   estimados` fica **desligado** (mostra "—", "fator a validar") até o dono
   confirmar o fator (`D.opColeta.hectaresFator`, hoje `null`).

## O que foi entregue

- Nova aba **Coleta de Pontos** (grupo "Controle Operacional" na sidebar + tab).
- **Tabela** como centro da tela: `Data · Equipe · Cliente · Fazenda · Talhão ·
  Colaboradores/Pontos (chips) · Total · Status · Observações`, **agrupada por
  mês** (linha de período + **Total do mês**), com coluna Data fixa (sticky) e
  rolagem horizontal.
- **Status visuais**: Planejada · Em andamento · Finalizada · Não trabalhado.
- **Cards de resumo**: Total de pontos, Dias trabalhados (pontos>0), Média
  diária, Lançamentos, Hectares estimados (a validar).
- **Filtros**: data inicial/final, cliente, fazenda, equipe, colaborador, status,
  busca por observação.
- **Produtividade no período** (por colaborador: dias, pontos, média).
- **CRUD** por modal (Novo/Editar/Excluir) — colaboradores são **chips sem
  limite** (não colunas fixas), exatamente como pedido.
- Visual do protótipo adaptado ao **design system do app** (tokens/tema
  claro-escuro), com classes **escopadas `.op-*`** — o CSS do protótipo **não**
  foi importado global (evita quebrar `input`/`.btn` do app).

## Arquivos

- `index.html` — CSS `.op-*`; view `#v-opcoleta` + modal; `D.opColeta` (migração);
  bloco puro `// <op-coleta-calc>`; runtime `renderOpColeta` + CRUD; tab/sidebar/rota.
- `tests/opcoleta.test.ts` — 8 testes do cálculo puro (totais, dias, média,
  produtividade, filtros, agrupamento por mês, status, hectares).

## Testes

- **bun: 85/85** (+8 desta tela). Parse do `index.html` na baseline.
- **Render headless (Chromium)** claro/escuro: tela renderiza (cards, tabela
  agrupada, badges, produtividade) com **0 erros de JS**; **smoke test do modal**
  (abrir → Cliente de `D.clientes` → salvar com pontos → fechar → linha aparece).

## Pontos a validar pendentes (do PDF — para as próximas telas / ajuste)

- **Hectares = pontos × fator**: confirmar o fator (hoje desligado).
- **"Arquivo na Máquina" (amostras)**: significado (data, prazo ou status?).
- **Média MIB = 20 (entregas)**: valor padrão ou calculado?
- **Prazo esperado de resultado (amostras)**: será configurável.
- **Títulos das colunas de Entregas** (Cliente/Fazenda/Área): confirmar.

## Próximas telas (aguardando ordem)

- **Tela 2 — Envio de Amostras** (remessas, dias de análise, situação por cor).
- **Tela 3 — Controle de Entregas** (matriz/checklist + progresso por linha).

**PARADO** conforme a regra de implementação incremental.
