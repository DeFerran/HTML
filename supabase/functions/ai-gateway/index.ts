// AI Gateway — Fase FOUNDATION.
// Único ponto de entrada da IA. Conversa com o modelo, SEM tools, SEM escrever
// em dados de negócio. Requisitos atendidos:
//   1. API key só no backend (Deno.env)          5. timeout
//   2. autenticação obrigatória (verify_jwt+get)  6. tratamento de erro
//   3. tenant obrigatório (empresa)               7. rate limiting (via ai_audit_log)
//   4. logs (ai_audit_log)                        8-11. sem WRITE/automação/WhatsApp/RAG
//
// Fonte da verdade e bi_* NÃO são tocados. A IA só grava nas tabelas ai_*.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { AnthropicProvider } from "./anthropic.ts";
import { ChatMessage, ProviderError } from "./provider.ts";

// ---- configuração (backend) ----
const EMPRESA = "DF AGRO"; // tenant único atual (ver docs/ai/01-AUDITORIA-ATUAL.md)
const MAX_TOKENS = 1024;
const TIMEOUT_MS = 60_000;
const RATE_LIMIT_PER_MIN = 30; // por usuário
const HISTORY_LIMIT = 20; // últimas mensagens no contexto
const MAX_MESSAGE_LEN = 8_000;

const SYSTEM_PROMPT =
  `Você é o Copiloto da DF AGRO, uma consultoria de agricultura de precisão. ` +
  `Ajude com gestão (clientes, serviços, safras, custos, margem, funil, equipe). ` +
  `Regras: a fonte da verdade são os dados da plataforma, não você — nunca invente ` +
  `números de clientes, receitas, custos, hectares, análises de solo ou mapas. ` +
  `Quando não tiver o dado, diga que ainda não tem acesso a essa informação. ` +
  `Nesta fase você ainda NÃO tem ferramentas de consulta nem pode alterar dados; ` +
  `responda de forma útil e objetiva, em português do Brasil.`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

function errBody(code: string, message: string) {
  return { error: { code, message } };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return json(405, errBody("method_not_allowed", "Use POST."));
  }

  // ---- clientes / ambiente ----
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  const model = Deno.env.get("AI_MODEL") ?? "claude-sonnet-5";
  const authHeader = req.headers.get("Authorization") ?? "";

  // (2) autenticação obrigatória — sem token, nem tenta.
  if (!authHeader) {
    return json(401, errBody("unauthorized", "Token de autenticação ausente."));
  }

  // Cliente com o JWT do usuário → a RLS aplica o escopo em toda leitura/escrita.
  const sb = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await sb.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) {
    return json(401, errBody("unauthorized", "Sessão inválida ou expirada."));
  }
  const userId = user.id;

  // (3) tenant + acesso: precisa ser membro ativo (mesmo RBAC do painel).
  const { data: ativo, error: ativoErr } = await sb.rpc("is_membro_ativo");
  if (ativoErr) {
    return json(500, errBody("rbac_error", "Falha ao verificar acesso."));
  }
  if (ativo !== true) {
    return json(
      403,
      errBody("forbidden", "Seu acesso ainda não foi liberado pelo administrador."),
    );
  }

  // (7) rate limiting simples por usuário (usa a infra já criada: ai_audit_log).
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count: recent } = await sb
    .from("ai_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("criado_em", since);
  if ((recent ?? 0) >= RATE_LIMIT_PER_MIN) {
    return json(
      429,
      errBody("rate_limited", "Muitas mensagens em pouco tempo. Aguarde um instante."),
    );
  }

  // ---- corpo ----
  let body: { message?: unknown; conversation_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, errBody("bad_request", "Corpo JSON inválido."));
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const conversationIdIn = typeof body.conversation_id === "string"
    ? body.conversation_id
    : null;
  if (!message) {
    return json(400, errBody("bad_request", "Campo 'message' é obrigatório."));
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return json(
      400,
      errBody("too_long", `Mensagem excede ${MAX_MESSAGE_LEN} caracteres.`),
    );
  }

  const started = Date.now();
  let conversationId = conversationIdIn;

  try {
    // ---- conversa (cria se preciso) ----
    if (!conversationId) {
      const { data: conv, error } = await sb
        .from("ai_conversations")
        .insert({ empresa: EMPRESA, titulo: message.slice(0, 60) })
        .select("id")
        .single();
      if (error) throw new ProviderError(500, "db_error", error.message);
      conversationId = conv.id as string;
    }

    // (9) grava a mensagem do usuário.
    {
      const { error } = await sb.from("ai_messages").insert({
        conversation_id: conversationId,
        empresa: EMPRESA,
        papel: "user",
        conteudo: message,
      });
      if (error) throw new ProviderError(500, "db_error", error.message);
    }

    // ---- contexto: histórico recente ----
    const { data: hist, error: histErr } = await sb
      .from("ai_messages")
      .select("papel, conteudo")
      .eq("conversation_id", conversationId)
      .order("criado_em", { ascending: true })
      .limit(HISTORY_LIMIT);
    if (histErr) throw new ProviderError(500, "db_error", histErr.message);

    const messages: ChatMessage[] = (hist ?? [])
      .filter((m) => m.papel === "user" || m.papel === "assistant")
      .map((m) => ({
        role: m.papel as "user" | "assistant",
        content: m.conteudo as string,
      }));

    // ---- provider (1 API key backend, 5 timeout) ----
    const provider = new AnthropicProvider(anthropicKey, model);
    const result = await provider.complete({
      system: SYSTEM_PROMPT,
      messages,
      maxTokens: MAX_TOKENS,
      timeoutMs: TIMEOUT_MS,
    });

    // grava resposta.
    await sb.from("ai_messages").insert({
      conversation_id: conversationId,
      empresa: EMPRESA,
      papel: "assistant",
      conteudo: result.text,
      tokens: result.outputTokens,
    });
    await sb.from("ai_conversations")
      .update({ atualizado_em: new Date().toISOString() })
      .eq("id", conversationId);

    // (4) log de run (tipo='run', sem tool nesta fase).
    await sb.from("ai_audit_log").insert({
      empresa: EMPRESA,
      conversation_id: conversationId,
      tipo: "run",
      nivel: "READ",
      modelo: result.model,
      ok: true,
      latencia_ms: Date.now() - started,
      tokens: result.inputTokens + result.outputTokens,
    });

    return json(200, {
      conversation_id: conversationId,
      reply: result.text,
      usage: { input: result.inputTokens, output: result.outputTokens },
    });
  } catch (e) {
    // (6) tratamento de erro + log do run com falha.
    const pe = e instanceof ProviderError
      ? e
      : new ProviderError(500, "internal", (e as Error).message ?? "erro");
    try {
      await sb.from("ai_audit_log").insert({
        empresa: EMPRESA,
        conversation_id: conversationId,
        tipo: "run",
        nivel: "READ",
        modelo: model,
        ok: false,
        erro: `${pe.code}: ${pe.message}`.slice(0, 500),
        latencia_ms: Date.now() - started,
      });
    } catch { /* nunca deixa o log derrubar a resposta */ }
    return json(pe.status, errBody(pe.code, pe.message));
  }
});
