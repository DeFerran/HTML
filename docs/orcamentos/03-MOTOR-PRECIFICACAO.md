# Orçamentos — 03 · Motor de precificação (reuso do que existe)

O vendedor **não digita preço**. O motor busca o preço real vigente e calcula.
Cada item guarda um **snapshot** do preço usado, para o orçamento não mudar se a
tabela mudar depois.

## Fontes de preço reais (reutilizar, não recriar)
| Fonte | Estrutura | O que dá |
|---|---|---|
| Tabela por safra | `D.precosSafra[safra][servico] = {preco, custo, un:'ha'}` via `precoServ(S,serv)` | **preço de venda R$/ha** e **custo de execução R$/ha** por serviço/safra |
| Serviço | `D.servicos[].precoHa2627` | preço/ha de referência da safra-base |
| Laboratório | `D.lab.precos` (R$/amostra), `D.lab.gridHa` (ha/ponto), `D.lab.pctColeta` (% por profundidade) | custo **por amostra** e a malha ha→pontos→amostras |
| Custo composto | `custoExecHa(servico,tipo)` = lab/ha + coleta/ha + custo manual | **custo direto/ha** já pronto (para margem) |

## Malha (densidade) e amostras — a cadeia que já existe
```
pontos   = round( area_ha / gridHa[servico] )         // gridHa = ha por ponto (malha)
am_00_20 = round( pontos × pctColeta.p0020 )          // p0020 = 1 (1 amostra/ponto)
am_00_10 = round( pontos × pctColeta.p0010 )          // profundidade adicional
am_20_40 = round( pontos × pctColeta.p2040 )
custo_lab = am_00_20×(novo?comArgila:semArgila) + am_00_10×adic0010 + am_20_40×adic2040
```
(`gridDoServico`, `amostrasCliente`, `labCustoCliente`, `labCustoHa` — doc 01/agente).

**Profundidade hoje** = 3 estratos fixos (00–20 / 00–10 / 20–40) expressos como
**percentual de amostragem**, não como valor livre de profundidade. O novo
cadastro `D.comercial.profundidades` vai **generalizar** isso (rótulo + regra de
amostragem/custo por profundidade), sem quebrar o lab atual.

## Modelo de cobrança por serviço (hoje e proposto)
Hoje **tudo é vendido por hectare** (`receita = ha × preço/ha`); `un` em
`precosSafra` existe mas é sempre `'ha'`. Custo por amostra/ponto existe só como
**custo interno**, não como preço de venda.

O motor novo (`precoItem(servico, ctx, safra)`) suportará, conforme o serviço:
- `ha` → `preço/ha × área` (padrão, usa `precoServ`);
- `amostra` → `preço/amostra × amostras estimadas` (amostras via malha acima);
- `ponto` → `preço/ponto × pontos`;
- `fixo` / `serviço` → valor fixo;
- `pacote` → soma dos serviços do pacote com a regra do pacote;
- `personalizado` → preço autorizado (com alçada/aprovação).

O **método de cobrança de cada serviço** fica em `D.comercial` (config), com
**default `ha`** para preservar 100% o comportamento atual. Nenhuma regra é
assumida: se não houver configuração, cai no `precoServ` por ha que já existe.

## Snapshot por item (imutável)
Cada item do orçamento guarda, no momento da criação:
```
{ servico, metodo, precoBase, unidade, quantidade, subtotal,
  desconto, total,
  origemPreco:{ safra, fonte:'precosSafra|lab|servico|manual', precoTabela } }
```
Assim um orçamento antigo **não muda** quando `D.precosSafra` for atualizado.
Ao **duplicar** um orçamento, o motor **repuxa o preço vigente** e **avisa** se
mudou (nunca reusa preço antigo em silêncio).

## Margem (só para quem tem permissão)
Reutilizar `vendaMargem`-style: `custoDir = custoExecHa(servico) × área`,
`imp = receita × taxRate`, `com = receita × comRate()`, `mc = receita − imp −
custoDir − com`, `mcPct = mc/receita`. **Vendedor não vê custo/margem**; gestor
vê (por papel). Preço mínimo/alçada comparam o **desvio** contra a política
configurada.

## Reconciliação matemática (obrigatória nos testes)
- Σ(subtotais) = subtotal do orçamento;
- subtotal − desconto = total;
- Σ(parcelas) = total (tratar centavos: última parcela absorve o resíduo);
- desvio = (total − totalTabela)/totalTabela.
Sem diferença por arredondamento. Doc 08 (testes) cobrirá cada caso.
