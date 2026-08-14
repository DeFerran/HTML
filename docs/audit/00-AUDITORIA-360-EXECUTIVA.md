# 00 — Auditoria 360° · Sumário Executivo

**Data:** 2026-08-14 · **Escopo:** plataforma inteira (arquitetura, frontend,
backend, banco/Supabase, fórmulas, dashboards, auth, RLS, multi-tenant, IA/RAG/
automação/WhatsApp, Controle Operacional, import/export, segurança, performance).
**Método:** código confrontado com o banco (Supabase MCP, **read-only**), docs e
testes. **Nada inventado** — cada afirmação aponta arquivo:linha ou tabela.

> Correções aplicadas: **apenas as seguras** (causa comprovada, solução
> inequívoca, baixo risco, testável, rollback simples) e **somente no frontend**.
> Banco, RLS e auth **não** foram tocados. O resto está registrado como
> **NECESSITA DECISÃO** (08) — não mexo sem sua ordem.

## Placar (XX/100)

| Dimensão | Nota | Leitura |
|----------|-----:|---------|
| Arquitetura | **78** | PWA single-file + edge functions + Supabase, limpa; monólito de 6.3k linhas é o risco. |
| Banco | **72** | RLS sólido e reconciliação boa; 2 espelhos ETL furados (custos/metas). |
| Segurança | **88** | 37/37 RLS, 69 policies, 0 aberta, sem segredo no front, sem SQL livre da IA. |
| Fórmulas | **70** | Vivas e testadas; furos em `recBruta` fixo e base de comissão. |
| Frontend | **83** | Renderiza limpo, mobile ok, 0 erro JS; rótulos "na safra" enganosos. |
| Backend (IA) | **80** | Gateway/actions/worker/whatsapp reais; `get_costs` lê tabela zerada. |
| AP / Controle Operacional | **82** | Implementado e testado; **P0 de perda de dados corrigido** nesta auditoria. |
| IA (RAG/tools/aprovação) | **74** | Engine de aprovação correta; dados de custo/meta da IA não confiáveis (ETL). |
| Automação | **68** | WhatsApp webhook real e seguro, porém **não configurado**. |
| Testes | **74** | 120 passam (pure blocks + smoke headless); cobertura fora dos blocos é menor. |

## Contagem de problemas

- **Corrigidos (seguros):** 5 → 1×P0, 2×P1, 2×P2.
- **Necessitam decisão (negócio/ETL):** 7 → I-06..I-10, I-12, D-07.
- **Higiene / risco futuro (P3):** 5 → advisors, config, monólito.

## TOP 10 problemas

1. 🚨 **P0** Import da planilha apagava todo o Controle Operacional + metas/preços por safra (`mergeImport`). **[CORRIGIDO]**
2. 🔴 **P1** `bi_custos_mensais` zerada (288 linhas) → IA reporta custo mensal R$ 0. **[decisão D-03]**
3. 🔴 **P1** Import de Entregas destruía decimais da Área (`1.234,5`→12345). **[CORRIGIDO]**
4. 🔵 **P1** Base da comissão diverge (linha 2452: rec−custoDir vs receita bruta). **[decisão D-02]**
5. 🔵 **P1** `recBruta()` índice fixo `[2]` — financeiro ignora a safra ativa. **[decisão D-01]**
6. 🚨 **P1** Observações não faziam round-trip no CSV operacional. **[CORRIGIDO]**
7. 🟡 **P2** `bi_metas` realizado defasado (=0, meta 1.8M). **[decisão D-04]**
8. 🟡 **P2** `tempoMedio` das Amostras somava dias negativos. **[CORRIGIDO]**
9. 🟡 **P2** Formatadores exibiam `R$ NaN`/`Infinity%` com receita 0. **[CORRIGIDO]**
10. 🔵 **P2** Entregas: linha 100% pendente conta como andamento **e** pendente. **[decisão D-05]**

## TOP 10 correções aplicadas (todas testadas, só frontend)

1. Preservar Controle Operacional + metas/preços por safra na importação (P0).
2. `opNum()` pt-BR para Área (não corrompe decimais).
3. Coluna Observações no export **e** import de Entregas.
4. Coluna Observações no export **e** import de Amostras.
5. `tempoMedio` exclui dias negativos.
6. `BRL` à prova de NaN/Infinity.
7. `BRLk` à prova de NaN/Infinity.
8. `PCT` à prova de NaN/Infinity (fecha todos os `x/receita`).
9. Testes novos: `importmerge.test.ts`, `formatadores.test.ts`.
10. Testes ampliados: `opcsv.test.ts` (opNum), `opamostras.test.ts` (negativos).

## TOP 10 decisões que dependem de você (08-MANUAL-DECISIONS.md)

1. Comissão: sobre faturamento ou sobre margem? (D-02)
2. `recBruta` por safra ou fixo 26/27? (D-01)
3. `get_costs`: trocar fonte para tabelas que reconciliam, ou reprocessar ETL? (D-03)
4. Metas: espelhar `metasSafra` ou ler snapshot vivo? (D-04)
5. "Em andamento" nas Entregas: definição + fim da contagem dupla. (D-05)
6. Hectares oficial: base clientes (~20.003) ou serviços (~28.500)? (D-06)
7. Re-rotular telas operacionais / filtro por safra. (D-07)
8. Ligar leaked-password protection. (P3)
9. Índices nas 11 FKs quentes + limpeza de política duplicada. (P3)
10. Quebrar `index.html` em módulos (mantendo blocos puros). (P3)

## Riscos de produção

- **Custo/meta na IA não confiáveis** enquanto os espelhos ETL não forem
  corrigidos (D-03/D-04) — trate como "consulte o app".
- **Financeiro atrelado à 26/27** (recBruta fixo) — o seletor de safra não muda o
  financeiro; pode induzir leitura errada até decidir D-01.
- **Comissão inconsistente** entre telas até padronizar D-02.
- Integrações **desligadas** (chave Anthropic/WhatsApp) — nada quebra, mas a IA
  não responde até configurar.

## Próximos passos

Ver **09-ROADMAP.md**. Sugestão imediata de maior valor/menor risco: **D-03**
(fonte do `get_costs`) e o lote de UX **D-07**. As decisões financeiras (D-01/
D-02) merecem fase própria com testes de regressão.

---

### Relatórios desta auditoria
`00` executivo · `01` issues · `02` fórmulas · `03` data-flow · `04` banco ·
`05` segurança · `06` IA · `07` fixes aplicados · `08` decisões · `09` roadmap.

**PARADO** após esta auditoria, conforme a regra de implementação incremental.
Não inicio nova refatoração sem sua autorização.
