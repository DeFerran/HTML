# Controle Operacional — Tela 3: Controle de Entregas — Resultado

**Data:** 2026-08-14
**Fase:** terceira e última das 3 telas. Aditiva; mesmo padrão (estado `D`).
**Com isso o módulo Controle Operacional (Coleta · Amostras · Entregas) fica completo.**

## O que foi entregue

- Nova aba **Controle de Entregas** (grupo "Controle Operacional" + tab + sidebar + rota).
- **Matriz/checklist** por cliente/fazenda com cabeçalho **agrupado**: `Cliente
  (fixo) · Fazenda · Área (ha) · Prop. químicas · Mapas · Calcário (Média+Status)
  · Fósforo (Média+Status) · Potássio/KCL (Média+Status) · MIB (Média+Status) ·
  Progresso`.
- **Marcadores por item**: ✓ Concluído (verde) · ● Em andamento (azul) ·
  ● Pendente (dourado) · — Não iniciado/não se aplica (neutro).
- **Progresso automático por linha** = itens concluídos ÷ itens aplicáveis
  (exclui os "—"). Barra + %.
- **Cards**: Clientes em andamento, Entregas concluídas (100%), Entregas
  pendentes, Itens pendentes.
- **Filtros**: cliente, fazenda, status da linha (não iniciada/andamento/
  concluída), pendências (com/sem), busca.
- **CRUD** por modal: cliente (de `D.clientes`), fazenda, área, e os 6
  entregáveis com status + média (onde aplica).

## Defaults seguros / regras "a validar"

- **MIB** tratado como **campo** (status + média editável), **não** fórmula fixa
  (o PDF cita "Média MIB = 20" como a confirmar — deixado como valor editável).
- **"Itens atrasados"** do protótipo virou **"Itens pendentes"**: não há data/
  prazo nesta tela, então "atrasado" não é inferido (evita inventar). Um card de
  atraso real precisa de uma regra de prazo — fica para validação futura.
- **Títulos das colunas** mantidos conforme o protótipo (Cliente/Fazenda/Área e
  os entregáveis, inclusive "MIB").

## Arquivos

- `index.html` — view `#v-opentregas` + modal (matriz); `D.opEntregas` (migração);
  bloco puro `// <op-entregas-calc>`; runtime `renderOpEntregas` + CRUD;
  CSS `.op-mark`/`.op-progress`; tab/sidebar/rota.
- `tests/opentregas.test.ts` — 8 testes (progresso, status da linha, pendentes,
  agregados, filtros, marcadores).

## Testes

- **bun: 101/101** (+8 desta tela). Parse do `index.html` na baseline.
- **Render headless (Chromium)**: matriz com cabeçalho agrupado, marcadores por
  cor, barras de progresso e legenda; **0 erros de JS**. Progresso conferido
  (Edras 83%, Lorival 60%, Milton 67%, Gustavo 100%). **Smoke test do modal**
  (6 entregáveis, Cliente de `D.clientes`, salvar status+média → linha renderiza).

## Módulo Controle Operacional — resumo

| Tela | Aba | Estado | Testes | Doc |
|---|---|---|---|---|
| 1 · Coleta de Pontos | `opcoleta` | `D.opColeta` | 8 | `01-COLETA-DE-PONTOS-RESULTADO.md` |
| 2 · Envio de Amostras | `opamostras` | `D.opAmostras` | 8 | `02-ENVIO-DE-AMOSTRAS-RESULTADO.md` |
| 3 · Controle de Entregas | `opentregas` | `D.opEntregas` | 8 | este |

Pendências de validação do dono (para refino futuro): fator de hectares (Tela 1),
"Arquivo na Máquina" e prazo padrão (Tela 2), regra de "atrasado" e Média MIB
padrão (Tela 3). Migração para tabelas Supabase + RLS (entrada concorrente
multiusuário) fica como fase futura, conforme combinado.

**PARADO** conforme a regra de implementação incremental.
