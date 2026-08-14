# Operação AP — Resultado da implementação (Fases 1–10)

O **pipeline operacional de Agricultura de Precisão** está completo: dá para
acompanhar cada serviço **da entrada do pedido à conclusão**, com datas, responsáveis,
tempos, atrasos e alertas — tudo como **camada aditiva** sobre a plataforma existente,
sem duplicar nenhuma base.

## O ciclo, fim a fim
Pedido (orçamento) → **conversão** cria o **projeto** → Planejamento → **Coleta**
(Modo Campo) → **Laboratório** (automação no resultado) → Interpolação → Mapas →
Apresentação → **Regulagem** → **Acompanhamento** → **Conclusão** (configurável).

## Entregue por fase
1. **Auditoria** — diagnóstico do que existia/faltava (sem código).
2. **Fundação** — `D.projetos` + `D.pipelineCfg` (workflow por tipo de serviço) +
   log de eventos (`projeto.eventos`) + `PipelineCalc`; `orcConverter` cria 1 projeto
   idempotente e carimba `projetoId` na coleta/amostras/entregas.
3. **Timeline** — tela Projetos: lista, ficha com linha do tempo, visão por cliente,
   movimentação auditada.
4. **Produtividade** — dashboard por colaborador/equipe (dia/semana/mês), drill-down —
   reaproveitando a Coleta.
5. **Painel Operacional** — KPIs de hoje/mês + pipeline por etapa clicável.
6. **Gargalos & SLA** — gargalos/aging + tempo médio por etapa (mês×mês) + **SLA
   configurável por etapa**.
7. **Modo Campo** — operador registra a coleta em poucos toques (captura automática) e
   avança o pipeline.
8. **Kanban** — quadro por etapa, mover = confirmado + auditado.
9. **Regulagem & Acompanhamento** — captura das etapas finais + conclusão configurável.
10. **Alertas & automações** — central "Precisa da sua atenção" priorizada + automação
    laboratório → interpolação.

## Respostas que a plataforma agora dá em segundos
- **Hoje**: pontos coletados, hectares, quem trabalhou, onde, o que está atrasado.
- **Semana/Mês**: pontos/ha por colaborador e equipe, média diária, projetos que
  avançaram/pararam, tempo médio por etapa, lead time, atrasos.
- **Projeto**: pedido → … → conclusão com datas, responsáveis, tempos, atrasos,
  pendências e histórico completo.

## Preservação (regras do projeto)
- **Nenhuma base duplicada**: clientes, fazendas, colaboradores, serviços, coletas,
  laboratório e entregas continuam sendo a fonte oficial; o projeto **referencia**
  (por `projetoId`/`quoteId`/`refs`), não copia.
- **Só aditivo**: novos arrays/campos/telas; motores puros existentes intactos;
  `mergeImport` preserva `projetos`/`pipelineCfg`; snapshot `painel_estado` inalterado.
- **RBAC**: herda `membros` (admin/editor/leitor); leitores não têm ações de escrita.
- **Auditoria**: toda mudança de etapa gera evento (quem/quando/de→para/origem); nada
  muda status crítico só visualmente (Kanban confirma e registra).

## Qualidade
- **171 testes / 0 falhas**; smoke headless de cada fase com **0 erro de JS** e **0
  overflow** (desktop e 390px, claro e escuro).

## Preparado para a IA (futuro, sem lógica fictícia agora)
Os eventos e o `PipelineCalc` já permitem responder "quais projetos estão atrasados?",
"qual o maior gargalo?", "quem coletou mais essa semana?", "qual cliente espera há mais
tempo?", "lead time médio?", "quais regulagens pendentes?", "quais projetos parados?".

## Pendências opcionais (futuras, não bloqueiam)
- **Checklists configuráveis por etapa** (`pipelineCfg.etapas[].checklist` já existe no
  modelo; falta a UI).
- **Safra carimbada na coleta** (hoje a produtividade recorta por data, não por safra).
- **Taxa de retrabalho** a partir das `ocorrencias` registradas no Modo Campo.
- **Custo/receita por projeto** cruzando com a base financeira existente (sem criar
  segunda base).
- **Editor visual do workflow** (adicionar/remover etapas e tipos de serviço).

## Módulo concluído (Fases 1–10)
Ciclo comercial → operacional integrado ponta a ponta, do pedido à conclusão, sobre a
plataforma existente — sem duplicar base, com auditoria e testes.
