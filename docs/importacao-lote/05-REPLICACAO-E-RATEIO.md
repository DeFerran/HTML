# 05 — Replicação × Rateio

> Duas operações DIFERENTES, deixadas visualmente distintas (verde, títulos
> "⧉ Replicar" vs "➗ Ratear", copy explicativa em cada wizard). Ambas escrevem
> pelo `LancStore` (mesmas regras) e entram no histórico.

## Replicar (bloco `<replicacao>` `Replicacao`)

**Cria UM lançamento completo para cada destino.** Multiplica.

```
R$ 1.000 · 3 clientes  →  Cliente A = 1.000 · B = 1.000 · C = 1.000  →  total R$ 3.000
```

- Wizard (4 passos): **Base & campos** (valores comuns + o que copiar; o cliente é
  o destino) → **Destinos** (busca + selecionar todos + contador) → **Ajustes**
  (valor por destino) → **Revisão** (preview obrigatório "criará N · total R$ X").
- Rastreabilidade: `source=replicacao`, `replicationGroupId`, `replicatedFromId`.
- Reconciliação: **nº de destinos = nº de lançamentos criados**; total = Σ dos
  valores (nunca vira rateio).

## Ratear (bloco `<rateio>` `Rateio`)

**Distribui UM custo real entre destinos.** A soma das partes = valor original.

```
R$ 1.000 · 40/30/30%  →  A = 400 · B = 300 · C = 300  →  TOTAL ECONÔMICO R$ 1.000
```

- Modos: **Dividir igual · Por percentual · Por valor · Por hectare** (hectares
  pré-preenchidos das fazendas do cliente).
- Wizard: **Custo & campos** → **Destinos** → **Distribuição** (chips de modo +
  inputs + reconciliação ao vivo) → **Revisão** ("Total econômico = original").
- Rastreabilidade: `source=rateio`, `rateioGroupId`.

## Reconciliação obrigatória do rateio

- **Percentual:** Σ deve ser **exatamente 100%** (99,99% e 100,01% **bloqueiam**).
- **Valor:** Σ deve ser **exatamente** o total (diferença bloqueia).
- **Igual/Hectare:** somam por construção — a última parcela absorve o resíduo de
  centavos → Σ exatamente = total.

Nunca transforma R$ 1.000 em R$ 3.000. Provado em `tests/rateio.test.ts` e
`tests/replicacao.test.ts` (1/10/100 destinos, arredondamento, limites de %).
