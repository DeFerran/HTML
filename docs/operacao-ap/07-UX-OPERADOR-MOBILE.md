# Operação AP — Fase 7: Modo Campo (operador)

> **Atualização (a pedido): Modo Campo simplificado.** A tela ficou com só o
> essencial: **iniciar a coleta na fazenda** (seletor de fazenda + "▶ Iniciar
> coleta", ou iniciar uma coleta já planejada) e o colaborador **anotar os pontos
> coletados no dia** (contador −1/+1/+5 e entrada direta). Foram **removidos** da
> tela: finalizar, registrar problema, CTA "enviar amostras", e os campos extras
> (talhão/fator/equipe/hectares). Continuam automáticos: **você (operador), data e
> hora de início**; iniciar ainda avança o projeto vinculado para **Coleta**. O
> restante do fluxo (finalizar, amostras, etc.) é feito nas telas do gestor. O texto
> abaixo descreve a versão original completa.

---


Tela **mobile-first** para o operador registrar a coleta em poucos toques —
reaproveitando a **Coleta de Pontos** (`D.opColeta`, sem segundo formulário) e
alimentando o pipeline automaticamente. Aditivo; nenhum cálculo/rota/dado existente
alterado.

## Objetivo realizado
Um **Modo Campo** (nav + aba, view `#v-campo`) com botões grandes, fluxo vertical e
captura automática — o operador executa e registra sem digitar o que o sistema já sabe.

## Quem é o operador (uma vez)
Seletor **"Sou: [colaborador]"** salvo no aparelho (`localStorage`) — os pontos são
atribuídos a esse colaborador sem re-selecionar a cada ação. Lista vem de
`D.colaboradores`.

## Minhas coletas (cards grandes)
Lista as coletas **abertas** (planejada/andamento) como cartões: fazenda, cliente,
talhão, status e ação principal grande:
- **Planejada** → **▶ Iniciar coleta**.
- **Em andamento** → contador grande **"meus pontos"** (+ equipe + ~ha), stepper
  **−1 / +1 / +5** e input direto, mais **✓ Finalizar** e **⚠ Problema**.

## Captura automática (sem digitar)
- **Iniciar**: status → andamento, **data = hoje**, **hora de início = agora**, e
  adiciona o operador à equipe da coleta — nada disso é perguntado.
- **Registrar pontos**: soma/edita os pontos do operador (também inicia se ainda
  planejada). Campos novos aditivos: `horaInicio`, `horaFim`, `ocorrencias[]`.
- **Finalizar**: status → finalizada, **hora de fim = agora**.

## Ponte coleta → pipeline (automação)
Se a coleta veio de um projeto (`projetoId`), as ações avançam o projeto **só para
frente**, com evento auditado:
- Iniciar/registrar → projeto entra em **COLETA** (evento `COLETA_INICIADA`).
- Finalizar → projeto avança para **LABORATÓRIO** (evento `COLETA_CONCLUIDA`).
- Problema → registra `OCORRENCIA` no projeto.
"O vendedor vende X, a operação executa X e o pipeline anda sozinho."

## Próximo passo (após concluir)
Ao finalizar, aparece o aviso **"✓ Coleta concluída — próximo passo: enviar amostras"**
com o botão **📦 Registrar envio de amostras** que leva direto ao **Envio de Amostras**.

## Problema / retrabalho
**⚠ Problema** registra uma ocorrência (`ocorrencias[]` + marca em `obs`: ponto
refeito, acesso bloqueado, chuva, amostra perdida…), base para futura **taxa de
retrabalho** — sem penalizar o colaborador automaticamente.

## Coleta rápida
Botão **+ Nova coleta** com o mínimo (cliente/fazenda/talhão/fator) para o operador
abrir uma coleta avulsa e já começar — data/hora/operador entram sozinhos.

## Testes executados
- `bun test` → **169 pass / 0 fail** (motor inalterado).
- Smoke headless (390px, origem real p/ localStorage): selecionar **Bruno** → 2
  cartões; **iniciar** k1 → andamento + data/hora automáticos + operador na equipe +
  **projeto PLANEJAMENTO→COLETA**; registrar pontos (30); **problema** grava
  ocorrência + obs; **finalizar** → finalizada + hora fim + **projeto COLETA→
  LABORATÓRIO** + CTA "enviar amostras" (cartão sai da lista de abertas); **0
  overflow** a 390px; **0 erro de JS** (screenshots do fluxo).

## Arquivos
- `index.html`: nav + aba + view `#v-campo`; dispatch; `renderCampo`/`campoCardHTML`/
  `campoNovaForm` + ações (`campoIniciar`/`campoAddPontos`/`campoSetPontos`/
  `campoFinalizar`/`campoProblema`/`campoNovaCriar`) + `campoAvancaProjeto` (ponte
  pipeline); CSS `.campo-*`/`.cc-*`.
- `docs/operacao-ap/07-UX-OPERADOR-MOBILE.md` (este relatório).

## Riscos / rollback
- Risco baixo: escreve na Coleta existente (mesma estrutura + campos novos aditivos) e
  avança o projeto só para frente, com evento. Rollback: reverter o commit remove a
  tela; coletas e projetos seguem íntegros.

## Próxima fase
**Fase 8 — Kanban/pipeline**: quadro por etapa com cartões arrastáveis (mudança
persistida + auditada, sem alterar status crítico só visualmente). (Aguardando ordem.)
