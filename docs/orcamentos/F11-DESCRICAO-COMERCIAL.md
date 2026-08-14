# Orçamentos — Descrição comercial por serviço (pendência da Fase 7)

Fecha a pendência documentada na Fase 7: **descrição comercial cadastrável por
serviço** (nome comercial + escopo padrão) que aparece na **proposta ao cliente**.
Aditivo — nenhum cálculo/rota/dado existente alterado; é uma camada de
apresentação sobre o serviço real.

## Objetivo realizado
Antes, a proposta usava o **escopo técnico** (malha/profundidade/amostras) + a
descrição opcional do item. Agora cada serviço pode ter, **cadastrado uma vez**:
- **Nome comercial** — como o serviço aparece na proposta (ex.: "Fertilidade
  Grid 3" → "Mapa de Fertilidade Premium").
- **Descrição comercial / escopo padrão** — texto de venda que entra **antes** do
  escopo técnico.

Ambos são **opcionais**: sem preencher, a proposta mantém exatamente o
comportamento anterior (nome do serviço + escopo técnico).

## Onde cadastrar
**Cadastros & Parâmetros › Comercial › "Descrições comerciais por serviço"** —
tabela com todos os serviços (mesma lista do assistente, via `funilServicoLista`),
cada um com dois campos de texto (Nome comercial · Descrição comercial). Salva
automaticamente ao sair do campo.

## Onde aparece (só na proposta ao cliente)
- **Título do item** = nome comercial (quando preenchido); senão, o nome do
  serviço.
- **Escopo do item** = descrição comercial · descrição do item · malha · prof. ·
  ~amostras (nessa ordem).
- Vale para serviços **inclusos e opcionais**.

## Integração / segurança
- **Não cria segunda base**: guarda em `D.comercial.descServico` — mapa
  `{ '<servico>': { nome, desc } }`, mesma convenção do `metodoPorServico`. Já
  viaja no snapshot e no `mergeImport` (o objeto `comercial` já é preservado).
- **Chave real preservada**: os itens do orçamento continuam com `it.servico` = o
  nome real do serviço. Preço, funil, conversão para o operacional e todos os
  cálculos usam a chave real — o nome comercial é **só exibição** na proposta.
- **Sem lixo**: apagar os dois campos remove a entrada do mapa.
- Não afeta wizard, lista, painel nem nenhuma tela interna — apenas o documento
  do cliente.

## Testes executados
- `bun test` → **143 pass / 0 fail** (motor inalterado).
- Smoke headless: cadastrar nome "Mapa de Fertilidade Premium" + descrição →
  proposta mostra o **nome comercial** como título e a **descrição comercial**
  antes do escopo técnico (malha/prof/amostras) e da obs do item; o nome real
  ("Fertilidade Grid 3") **não** aparece como título mas segue preservado em
  `it.servico`; a aba Comercial renderiza a tabela; limpar os campos remove a
  chave. **0 erro de JS** (screenshots da proposta e do cadastro).

## Arquivos
- `index.html`: seed `co.descServico={}`; helpers `qtDescServico`,
  `qzItemTitulo`; `qzItemEscopo` passa a prefixar a descrição comercial; card
  **ccDesc** + `renderDescServicos()` + `descServSet()` na aba Comercial;
  `qzPropostaHTML` usa `qzItemTitulo` no título do item.
- `docs/orcamentos/F11-DESCRICAO-COMERCIAL.md` (este relatório).

## Riscos / rollback
- Risco baixo: camada de apresentação opcional; sem preencher, nada muda.
  Rollback: reverter o commit remove o cadastro e volta a proposta ao escopo
  técnico; orçamentos existentes seguem válidos (a chave real nunca foi tocada).
