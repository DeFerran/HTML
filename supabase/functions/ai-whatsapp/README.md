# ai-whatsapp (Edge Function) — Integração inicial WhatsApp Cloud API

`verify_jwt=false` (o webhook do WhatsApp não envia JWT). Segurança própria:

- **GET** (handshake): `hub.verify_token` == `WHATSAPP_VERIFY_TOKEN` → devolve `hub.challenge`.
- **POST webhook**: valida a assinatura **HMAC-SHA256** (`X-Hub-Signature-256`)
  com `WHATSAPP_APP_SECRET` sobre o corpo cru. Assinatura inválida → 401.
- **POST admin** (`send_message` / `status`): valida o **JWT do usuário** e exige `is_admin()`.

Escrita no banco via **service role** (backend). **Tokens só no backend.**
Escopo: **somente leitura** (consultas/respostas/resumos). Sem ações sensíveis.

## Fluxo (inbound)
receber → validar assinatura → **dedupe** (`unique wa_message_id`) → identificar
contato/conversa → registrar mensagem → **orchestrator** (RAG + memória validada +
snapshot, tudo READ) → gerar resposta → **enviar** (retry) → registrar/logar.

## Secrets (backend — o dono configura)
`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID` (ou via `whatsapp_config`), opcional `WHATSAPP_API_VERSION`.
`ANTHROPIC_API_KEY`/`AI_MODEL` para gerar a resposta (sem eles, envia aviso).
`SUPABASE_SERVICE_ROLE_KEY` é injetado pelo Supabase.

## Retry seguro
Envio ao Graph API tenta até 3× com backoff; erros de cliente (4xx≠429) não
repetem. Falha final → mensagem marcada `erro` + log.

## Rollback
Desabilitar/remover a função; DROP das tabelas `whatsapp_*`. App/BI intactos.
