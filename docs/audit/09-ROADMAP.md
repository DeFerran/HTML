# 09 — Roadmap (próximos passos sugeridos)

Ordenado por risco×valor. **Nada inicia sem sua ordem explícita** (regra de
implementação incremental).

## Fase A — Confiabilidade dos dados da IA (P1, alto valor)
1. **D-03** `get_costs`: apontar para `bi_custo_categoria`/`bi_lancamentos`
   (reconciliam) **ou** reprocessar `bi_custos_mensais`. Fecha o "custo R$ 0".
2. **D-04** metas: espelhar `metasSafra` no ETL ou ler snapshot vivo.
   - *Entregável:* IA responde custo/meta corretos. Teste: comparar tool vs app.

## Fase B — Regras financeiras (P1, decisão + testes)
3. **D-02** padronizar a **base de comissão** num único ponto (single source),
   depois de você confirmar faturamento×margem.
4. **D-01** decidir `recBruta` por safra vs fixo 26/27; se por safra, fase
   dedicada com testes de regressão em todo o bloco financeiro.

## Fase C — UX operacional (P2, baixo risco)
5. **D-07** re-rotular telas operacionais ("total" em vez de "na safra") ou
   adicionar filtro real por safra.
6. **D-05** definir "em andamento" nas Entregas e remover a contagem dupla.

## Fase D — Robustez / higiene (P3)
7. Ligar leaked-password protection.
8. Índices nas 11 FKs quentes; remover política duplicada de `membros`.
9. Avaliar quebrar `index.html` em módulos (mantendo os blocos puros testados).

## Fase E — Integrações (quando o dono provisionar)
10. Configurar chave Anthropic (backend) e `whatsapp_config` → ligar IA/WhatsApp
    (webhook já é read-only e seguro).

## Testes contínuos sugeridos
- Manter a regra: **toda nova estrutura manual em `D` entra na lista do
  `mergeImport`** e ganha um teste de preservação (como `importmerge.test.ts`).
- Ampliar o smoke headless para incluir os round-trips de CSV no CI local.
