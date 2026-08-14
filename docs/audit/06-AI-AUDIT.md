# 06 — Auditoria de IA / Automação

Complementa `docs/ai/14-AUDITORIA-POS-IMPLEMENTACAO.md` com o recorte do 360°.

## Edge Functions (Deno) — reais, não-mock

| Função | Versão | Papel | Status |
|--------|--------|-------|--------|
| `ai-gateway` | v6 | orquestra chat, tools READ, RAG | ✅ real |
| `ai-actions` | v1 | engine de aprovação (SAFE/SENSITIVE/decide) | ✅ real, correto |
| `ai-worker` | v2 | jobs assíncronos | ✅ real |
| `ai-knowledge` | v1 | base de conhecimento/RAG | ✅ real |
| `ai-whatsapp` | v1 | webhook (HMAC, dedupe, orquestra READ, retry) | ✅ real / ⚪ não configurado |

- `anthropic.ts`: chamada **real** à API Anthropic; lança
  `ProviderError(503, not_configured)` se não houver chave. Sem mock.
- **Sem SQL livre** do LLM; toda leitura passa por tools/RPC.

## Ferramentas por nível (conforme CLAUDE.md)

- **READ** (consulta): `get_costs`, área, produtividade, clientes, safras, etc.
- **SAFE_WRITE** (reversível, editor/admin): via `execute_safe`.
- **SENSITIVE_WRITE** (aprovação humana): via `propose` → `decide` (admin).

A IA **não** apaga registros, **não** altera finanças, **não** envia comunicação
externa nem muda recomendação agronômica crítica automaticamente. ✅

## Furos encontrados

| # | Item | Efeito | Classe |
|---|------|--------|--------|
| I-08 | ~~`get_costs` lê `bi_custos_mensais` (zerada)~~ **CORRIGIDO (D-03)**: total/categoria via `bi_custo_categoria` (reconcilia); mensal omitido com aviso quando zerado | IA não reporta mais **R$ 0**; deploy pendente | ✅ código corrigido/testado |
| I-09 | Metas via `bi_metas` defasada | IA/relatório de meta desatualizado | 🟡 ETL |
| I-16 | Chave Anthropic e `whatsapp_config` ausentes | IA/WhatsApp **desligados** | ⚪ configuração |

**Nada foi auto-corrigido aqui** — os dois primeiros são qualidade de dado no
ETL (fora do código do app); o terceiro é provisionamento pelo dono.

## RAG / memória / automações

- RAG por `ai-knowledge` + espelhos; respostas objetivas vêm das tools (não
  inventa área/produtividade/custos).
- WhatsApp: webhook **read-only** (não escreve no banco pela conversa),
  verificação HMAC e dedupe presentes — seguro para ligar quando configurado.

## Recomendação central

Antes de confiar nos números que a IA dá sobre **custos** e **metas**, corrigir
os espelhos `bi_custos_mensais`/`bi_metas` (ETL). Enquanto isso, tratar esses
dois KPIs da IA como **não confiáveis** e apontar o usuário para o app (fonte
viva). Alternativa de código (decisão): apontar `get_costs` para
`bi_custo_categoria`/`bi_lancamentos` (que **batem**) — ver 08/09.
