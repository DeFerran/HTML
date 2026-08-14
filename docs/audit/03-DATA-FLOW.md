# 03 — Fluxo de Dados (Data Flow)

## Visão geral

O app é uma **PWA single-file** (`index.html`, vanilla JS, estado global `D`).
A planilha **GESTÃO_AP (.xlsx)** é a fonte das análises; os cadastros manuais e
o Controle Operacional vivem só no app. O Supabase guarda um **snapshot** do
estado e tabelas-espelho **bi_*** (ETL) que a IA lê.

```
                 ┌──────────────────────────────────────────────┐
   Planilha  →   │ parseWB()  →  _fresh (safras, caixa, custos,  │
   GESTÃO_AP     │              serviços, clientes-análise,      │
   (.xlsx)       │              visitas, operação)               │
                 └──────────────┬───────────────────────────────┘
                                │ mergeImport(prev=D, fresh)
                                │  ↳ PRESERVA cadastros manuais que
                                │    NÃO estão na planilha:
                                │    lancamentos, recorrencias, funil,
                                │    clientes, equipe, comissao, …,
                                │    opColeta, opAmostras, opEntregas,
                                │    metasSafra, precosSafra   ← (fix I-01)
                                ▼
                        hydrate(merged)  → normaliza/defaults → D
                                │
              commit() = schedulePersist + scheduleDash
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                        ▼
   localStorage(SKEY)   render* (DOM/Charts)     snapshot → Supabase
                                                  (painel_estado JSON)
                                                        │  ETL
                                                        ▼
                                                  bi_* (espelhos)
                                                        │
                                                        ▼
                                            ai-gateway (READ tools)
```

## Entradas

| Origem | O que traz | Destino |
|--------|-----------|---------|
| Upload `.xlsx` | análises (safras, caixa, custos, serviços, clientes, visitas, operação) | `parseWB` → `mergeImport` → `hydrate` → `D` |
| Edição manual (Lançamentos) | despesas, funil, clientes, equipe, metas/preços por safra, Controle Operacional | `D` direto → `commit()` |
| Import CSV operacional | Coleta/Amostras/Entregas (formato do próprio Exportar) | **ADICIONA** linhas a `D.opX` |

## Persistência

- **localStorage** (`SKEY`): cópia integral de `D` a cada `commit()`; aviso de
  cota cheia (`saveLocal`).
- **Supabase snapshot**: `painel_estado` (JSON) sincronizado; **bi_*** são
  derivadas por ETL (chaveadas por texto, sem FK/created_at).

## Pontos de atenção no fluxo (confirmados)

1. **mergeImport era o gargalo de perda de dados** — qualquer chave manual fora
   da lista de preservação é destruída por `hydrate` no próximo import.
   Corrigido para o Controle Operacional e metas/preços por safra (I-01).
   *Regra viva:* toda nova estrutura manual em `D` **precisa** entrar nessa lista.
2. **bi_* podem divergir do app** — são espelhos ETL; `bi_custos_mensais` está
   zerada e `bi_metas` defasada. A **fonte viva** é `D` (metasSafra/precosSafra),
   não os espelhos. A IA que lê espelhos herda a defasagem (I-08/I-09).
3. **CSV operacional é aditivo** (nunca apaga) e agora faz round-trip completo
   (inclui Observações e Área com decimais — I-02/I-03).
4. **Import xlsx é destrutivo por natureza** para as análises (reconstrói), mas
   **preserva** o manual — o `confirm()` lista o que será preservado.

## Saídas

| Saída | Fonte |
|-------|-------|
| Dashboards/KPIs/gráficos | `D` (render*) |
| Export CSV operacional | `D.opX` (round-trip fiel) |
| Respostas da IA | tools READ → bi_*/RPC (objetivo) + snapshot |
