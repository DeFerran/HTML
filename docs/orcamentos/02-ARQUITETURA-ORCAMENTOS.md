# Orçamentos — 02 · Arquitetura proposta

Arquitetura **nativa do `D`** (nada de tabelas SQL novas), integrada ao que já
existe, incremental e reversível.

## Modelo de dados novo (aditivo)

### `D.quotes[]` — orçamentos comerciais
```
{ id, numero:'ORC-2026-0041', versao:1, versaoDe:null,   // versionamento
  status:'rascunho',                                       // ver estados
  clienteNome, fazenda, municipio, vendedor, safra,
  areaHa,                                                  // área do orçamento
  itens:[ {                                                // um por serviço
     servico, metodo:'ha', descricao, incluso:'incluso',   // incluso|opcional|nao
     config:{ malha, profundidades:[], pontos, amostras }, // campos condicionais
     precoBase, unidade, quantidade, subtotal,
     descontoPct, total,
     origemPreco:{ safra, fonte, precoTabela } } ],         // SNAPSHOT
  descontoGeralPct, subtotal, descontoValor, total,
  totalTabela, desvioPct,                                   // vs preço de tabela
  pagamento:{ condicaoId, parcelas:[{n,pct,dias,valor,venc}] },
  validadeDias, emitidoEm, validoAte,
  obsCliente, obsInterna,
  aprovacao:{ exigida, status, por, motivo, em },           // alçada
  historico:[ {em, quem, acao, de, para} ],                 // auditoria
  funilId, convertidoEm,                                    // ligação com o funil / conversão
  criadoEm, criadoPor, atualizadoEm }
```
Estados (`status`): **rascunho · aguardando_aprovacao · aprovado · enviado ·
negociacao · aceito · recusado · expirado · cancelado · convertido**.

### `D.comercial` — cadastros comerciais configuráveis (no hub Cadastros)
```
{ profundidades:[ {id,nome,rotulo,regraAmostragem} ],       // ex.: 0–20, 0–10, 20–40 (+ novas)
  malhas:[ {id,nome,haPorPonto} ],                          // 1 pt/1ha, /2ha, /3ha, /5ha…
  condicoesPgto:[ {id,nome,parcelas:[{pct,dias}],entrada} ], // À vista, 30/60/90…
  pacotes:[ {id,nome,servicos:[],regraPreco,validade,descricao} ], // Básico/Completo/Premium
  alcadas:{ vendedor:{maxDescPct}, gestor:{maxDescPct}, precoMinimoPct },
  validadePadraoDias:15,
  metodoPorServico:{ '<servico>':'ha|amostra|ponto|fixo|pacote' } }  // default 'ha'
```
Tudo **cadastrável, nada hardcodado**. As malhas reaproveitam `D.lab.gridHa`; as
profundidades generalizam `D.lab.pctColeta`.

Ambos entram no `hydrate` (default vazio/seed mínimo) e no `mergeImport`
(preservados no re-import) — igual às Fases 1–6.

## Integração com o funil (não duplicar)
- O orçamento **é a origem**; o funil continua sendo o painel de projeção.
- Mapeamento de status → estágio: `enviado/negociacao → Possível/Provável`,
  `aceito/convertido → Fechado`, `recusado/expirado → (fora do funil)`.
- Ao **aceitar/converter**, o orçamento cria/atualiza **uma** oportunidade em
  `D.funil` (ou alimenta a carteira, na safra-base) com `cliente, servico, area,
  precoHa, vendedor, safra` — respeitando `funilOps()` para **não contar duas
  vezes**. O `funilId` no orçamento guarda o vínculo.
- A matemática de linha reutiliza `vendaMargem` (`precoTab/valorTab/desvio/mc`).

## Conversão → escopo técnico (o ponto forte)
"Preço comercial" (o orçamento) vs "escopo técnico" (o projeto AP). Ao converter
um orçamento **aceito**, com confirmação, pré-preencher os módulos operacionais
(sem redigitar):
- **`D.opColeta.lancamentos`**: `cliente, fazenda, fator (da malha), status:'planejada'`;
- **`D.opAmostras.remessas`**: `fazendas[], volume (amostras estimadas)`;
- **`D.opEntregas.linhas`**: `cliente, fazenda, areaHa, itens` (pré-marcados por serviço).
Assim **vendedor vende X e a operação recebe o mesmo X** — a integração que o
briefing destaca. Fluxo alvo: **Orçamento → Aprovação → Venda(funil) → Projeto AP
→ Coleta → Lab → Entrega → Financeiro**, com um dado só na origem.

## Financeiro
Orçamento **não** vira receita. Separação de conceitos: **Orçado → Contratado
(aceito) → Faturado → Recebido**, seguindo a regra atual (`safras`, carteira,
`recebimento`). Integração financeira só é avaliada na conversão, sem lançar
receita realizada automaticamente.

## Permissões (papéis reais)
- **Vendedor (editor):** cria/edita rascunho, envia, solicita aprovação; **não vê
  custo/margem/preço mínimo**.
- **Gestor/Diretor (admin):** vê equipe, margem; aprova/rejeita/devolve desconto;
  edita regras comerciais (`D.comercial`).
- Alçada de desconto e preço mínimo saem de `D.comercial.alcadas` (configurável).

## Experiência
- **Web (desktop):** formulário 65% + **resumo sticky 35%** sempre visível.
- **Mobile (vendedor):** **wizard passo-a-passo** (1 etapa/tela), botões grandes,
  `inputmode` numérico, resumo/total discreto no rodapé, **rascunho auto-salvo**
  (reusa a persistência atual), proteção contra duplo-envio (idempotência por id).
- Wizard: **Cliente → Área → Serviços → Configuração → Pagamento → Resumo →
  Gerar**. Campos condicionais por serviço. Autopreenchimento quando aberto de um
  cliente/fazenda.

## Plano em fases (adaptado à plataforma; cada fase testada e parada p/ aprovação)
| Fase | Entrega |
|---|---|
| **1** | **Auditoria + arquitetura (este documento)** — sem código |
| 2 | `D.quotes` + `D.comercial` + hydrate/mergeImport + **motor `precoItem()`** + cadastros comerciais no hub + testes de cálculo |
| 3 | Orçamento **Web** (wizard + resumo sticky) reusando cliente/fazenda/preço |
| 4 | Orçamento **Mobile** (stepper, botões grandes, rascunho, anti-duplo) |
| 5 | **Desconto + alçada + preço mínimo + aprovação** (status aguardando_aprovacao) |
| 6 | **Versionamento + histórico + duplicar** |
| 7 | **Proposta** (HTML + `window.print`), inclusos/opcionais, obs cliente×interna |
| 8 | **Lista + "Meus Orçamentos"** + filtros (web tabela / mobile cards) |
| 9 | **Dashboard comercial** (KPIs, conversão, por vendedor) + integração ao funil |
| 10 | **Conversão** → funil "Fechado" + seed operacional (opColeta/amostras/entregas) |

Docs restantes (`04-UX-WEB`, `05-UX-MOBILE`, `06-APROVACOES-E-PERMISSOES`,
`07-INTEGRACAO-COMERCIAL-FINANCEIRA`, `08-TESTES`, `09-IMPLEMENTACAO-RESULTADO`)
serão escritos conforme as fases correspondentes forem executadas.

## Riscos e mitigações
- **Dupla contagem no funil** → integrar via `funilOps`, guardar `funilId`.
- **Preço mudar depois** → snapshot por item; duplicar repuxa e avisa.
- **Snapshot inchar** → limitar histórico/versões retidas.
- **Receita cedo demais** → só na conversão, pela regra atual.
- **Preço por amostra/profundidade** → usar regras reais do lab; método por
  serviço configurável com default `ha`.
- **Mobile** → wizard 1-etapa/tela, testado em 320–1920px, sem scroll horizontal.
