# Fase 06 — Copiloto (UI de chat) — Resultado

**Data:** 2026-08-13
**Fase:** interface do Copiloto (botão global + drawer + histórico + contexto da
página). Sem automações, sem WhatsApp.
**Regra-mãe:** a IA é uma CAMADA. Esta fase é **100% front-end aditivo** no
`index.html` (atrás de feature flag) — não altera nenhuma página/dado existente
nem o backend. O `ai-gateway` já tinha tudo (READ tools + RAG + memória).

---

## 1. Objetivo realizado

Interface de conversa com o Copiloto, ligada ao `ai-gateway`:
1. **botão global** (FAB) da IA;
2. **drawer** do Copiloto (chat);
3. **histórico** da conversa (persistido em `ai_messages`; conversas recentes);
4. **contexto automático da página** (aba + safra + empresa) enviado a cada
   pergunta — o usuário não precisa repetir o que já está na tela.

A IA usa **exclusivamente as READ tools desta fase** (o gateway não expõe
nenhuma outra), e **exibe com clareza quando falta informação** (ex.: talhão/
fazenda não existem → `get_field`/`get_farm` retornam `disponivel=false` e o
Copiloto diz que a plataforma não tem esse cadastro).

## 2. Sobre "Analise este talhão"

A plataforma **não tem talhão/fazenda** (auditoria doc 01). O contexto enviado
inclui o que existe (aba atual, safra em foco, empresa). Ao pedir "analise este
talhão", o Copiloto **não inventa**: responde que não há cadastro de talhão e
oferece o que existe (cliente, safra, custos). Isso foi verificado no smoke test.

## 3. Contexto automático (o que é enviado)

Montado no cliente a cada envio, embutido na mensagem como
`(Contexto da página: aba X; safra Y; empresa DF AGRO)` e também no corpo
(`contexto`):

| Campo pedido | Enviado? | Origem |
| ------------ | -------- | ------ |
| `tenant_id` / `company_id` | ✅ `'DF AGRO'` | tenant único real |
| `season_id` | ✅ | `safraAtual()` (safra em foco) |
| `client_id` | parcial | a aba ativa (ex.: Clientes) vai no contexto; não há "cliente selecionado" único na tela |
| `farm_id` / `field_id` | ❌ (não existem) | a plataforma não tem fazenda/talhão — omitidos, e o Copiloto diz isso |

> Decisão: o contexto viaja **embutido na mensagem** (e no corpo `contexto`),
> sem alterar o `ai-gateway` — menor risco, sem novo deploy. O gateway continua
> guardando o histórico em `ai_messages`.

## 4. Interface

- **FAB** fixo (canto inferior direito), visível só para **membro ativo** com a
  feature flag ligada (`df_ia_kb`). Controlado por `aplicarPermissoes()`.
- **Drawer** lateral (à direita; **full-screen no mobile** via media query),
  com: cabeçalho (título, seletor de **conversas recentes**, "＋ Nova", fechar),
  linha de **contexto**, lista de mensagens (bolhas user/IA), rodapé com textarea
  (Enter envia, Shift+Enter quebra linha) e botão enviar.
- **Fontes**: quando a resposta usa a Base de Conhecimento, as **fontes** vêm no
  rodapé da bolha.
- **Erros amigáveis**: se a chave da IA não estiver configurada
  (`not_configured`), o Copiloto explica que ainda não está configurado (e que
  Base de Conhecimento/Memória já funcionam).

## 5. Arquivos

**Modificados**
- `index.html` — aditivo: 1 botão de aba? não; **1 FAB + 1 drawer + 1 bloco CSS +
  1 bloco de funções** (`cop*`), e 3 linhas em `aplicarPermissoes`/handler de
  abas. **Nenhuma view/dado existente alterado.** CSP **não** foi tocada (já
  permitia `supabase.co`, onde ficam as Edge Functions).

**Criados**
- `docs/ai/06-COPILOTO-RESULTADO.md`

**Backend:** nenhuma mudança (gateway/DB inalterados nesta fase).

## 6. Testes executados

### Smoke test de UI (Chromium headless / Playwright) — **PASSOU**

CDNs stubados (supabase-js, chart.js, xlsx) para bootar offline; backend
(`functions.invoke`) simulado. Verificado:

- FAB presente; `copOpen()` abre o drawer (`open`);
- **contexto automático correto**: `Contexto: aba Visão Geral; safra 26/27; empresa DF AGRO`;
- saudação renderiza; enviar "Analise este talhão" gera bolhas **user + IA**
  (3 bolhas: saudação + pergunta + resposta);
- resposta honesta sobre ausência de talhão;
- `copClose()` fecha o drawer;
- **0 erros de JavaScript** na página.

### Sintaxe / regressão

- Sintaxe de todos os scripts inline do `index.html`: **OK**.
- Suite de backend (bun) inalterada: **34/34** (nada no backend mudou nesta fase).

## 7. Riscos

| Risco | Nível | Observação |
| ----- | ----- | ---------- |
| Poluir `index.html` | BAIXO | Tudo aditivo, atrás de flag; rollback = desligar a flag. |
| Contexto no texto da mensagem | BAIXO | Prefixo é removido ao recarregar histórico; não afeta os dados. |
| Custo de tokens | BAIXO | Gateway mantém `max_tokens`, rate limit e histórico limitado. |
| Expectativa de talhão/fazenda | BAIXO | Copiloto diz claramente que não existe (stubs + system prompt). |

## 8. Rollback

- `desativarPainelIA()` (ou `localStorage df_ia_kb='0'`) esconde FAB + drawer +
  abas de IA, sem tocar no resto.
- Reverter o commit do `index.html` remove a UI por completo.
Nenhum efeito sobre backend, `painel_estado`, `bi_*` ou `membros`.

## 9. Pendências

- Configurar `ANTHROPIC_API_KEY` no `ai-gateway` (passo do dono) para o chat
  responder de verdade. Sem isso, o Copiloto abre e conversa, mas retorna o aviso
  amigável de "não configurado".
- Smoke test manual end-to-end pelo dono (com a chave).

## 10. Próxima fase sugerida

- **Aprofundar o contexto**: quando houver "cliente em foco" numa tela de
  detalhe, enviar `client_id` específico (hoje vai a aba).
- **READ tools de gestão restantes** (doc 03 seção A/B) para enriquecer o
  Copiloto.
- Approval Engine / automações / WhatsApp seguem **fora de escopo** até ordem
  explícita.

**Não iniciar sem ordem explícita do usuário.**

---

_PARADO conforme a regra de implementação incremental._
