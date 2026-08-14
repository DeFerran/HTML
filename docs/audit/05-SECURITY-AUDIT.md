# 05 — Auditoria de Segurança

**Sem segredos neste documento.** Nenhuma chave, token ou credencial é exibida.

## Postura geral: **forte**

| Controle | Situação |
|----------|----------|
| RLS habilitado | **37/37 tabelas** (0 sem RLS) ✅ |
| Políticas | **69** ✅ |
| Políticas permissivas `true` (abertas) | **0** ✅ |
| `service_role` no frontend | **não** ✅ |
| SQL livre gerado pela IA em produção | **não** — IA usa tools/RPC parametrizadas ✅ |
| Segredos no frontend | **não** — Anthropic/Service Role/WhatsApp ficam no backend ✅ |

## Fronteira da IA (aprovação humana)

- `ai-actions`: `execute_safe` (SAFE_WRITE, papel editor/admin) · `propose`
  (SENSITIVE cria pendência, **não executa**) · `decide` (**admin only**).
- **SENSITIVE nunca executa sem aprovação de admin** — confirmado no código.
- Fluxo: Usuário → AI Gateway → Orchestrator → Tool autorizada → banco/API →
  resultado. O modelo **não** tem acesso irrestrito ao banco. Conforme CLAUDE.md.

## Advisors de segurança (WARN, P3) — confirmados

| Item | Avaliação |
|------|-----------|
| 6 funções `SECURITY DEFINER` executáveis por `authenticated`: `is_admin`, `pode_editar`, `meu_papel`, `is_membro_ativo`, `meu_email`, `vincular_meu_usuario` | **Por design** — são os helpers de RBAC que precisam checar papel **contornando RLS**. Padrão comum e seguro. Sem ação. |
| Leaked-password protection **desligada** | Recomendado **ligar** (HaveIBeenPwned) no painel Auth. Baixo risco. |

## Multi-tenant

Plataforma **single-tenant** hoje (`empresa='DF AGRO'`). As políticas já filtram
por usuário/papel. Toda funcionalidade nova deve manter o escopo por
`user_id`/papel — nenhuma organização acessa dados de outra. Nenhuma segunda
tabela de clientes/fazendas/talhões/financeiro foi criada.

## Segredos / configuração

- Anthropic API key: **backend only** (edge functions), nunca no repositório nem
  no frontend. **Não** está commitada.
- `whatsapp_config` vazia e chave Anthropic não provisionada no ambiente →
  integrações **reais, porém desligadas** até o dono configurar. Esperado.

## Verificação desta auditoria

- Nenhuma credencial foi lida, exibida, gravada ou commitada.
- Nenhuma política/RLS foi alterada.
- As correções são apenas de frontend (integridade de dados), sem tocar em auth.

## Recomendações (aguardam ordem)

1. Ligar leaked-password protection.
2. (Opcional) revisar `EXECUTE` das funções RBAC se algum papel não devesse
   chamá-las diretamente — hoje é intencional.
