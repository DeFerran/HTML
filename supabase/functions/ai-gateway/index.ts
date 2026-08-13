// AI Gateway — Fase FOUNDATION + READ TOOLS.
// Único ponto de entrada da IA. Conversa com o modelo e, quando útil, chama
// TOOLS SOMENTE-LEITURA sobre os espelhos bi_*. NUNCA escreve em dados de
// negócio (só nas tabelas ai_*). Requisitos atendidos:
//   1. API key só no backend (Deno.env)          5. timeout
//   2. autenticação obrigatória (verify_jwt+get)  6. tratamento de erro
//   3. tenant obrigatório (empresa)               7. rate limiting (ai_audit_log)
//   4. logs (ai_audit_log: run + tool_call)       8-11. sem WRITE/automação/WhatsApp/RAG
//
// Segurança das tools:
//   - o client `sb` usa o JWT do usuário → a RLS é a barreira de tenant;
//   - o modelo só escolhe NOME + args do schema; nunca envia SQL (proibição CLAUDE.md);
//   - tools sem dado real retornam disponivel=false (nunca inventam valores).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { AnthropicProvider } from "./anthropic.ts";
import {
  ChatMessage,
  ContentBlock,
  ProviderError,
  ToolResultBlock,
} from "./provider.ts";
import { runReadTool, toolSpecs } from "./tools/read_tools.ts";
import { KnowledgeHit } from "./tools/types.ts";

// ---- configuração (backend) ----
const EMPRESA = "DF AGRO"; // tenant único atual (ver docs/ai/01-AUDITORIA-ATUAL.md)
const EMB_MODEL = "gte-small"; // embeddings nativas do Edge (384 dim), sem chave
const MAX_TOKENS = 1024;
const TIMEOUT_MS = 60_000;
const RATE_LIMIT_PER_MIN = 30; // por usuário
const HISTORY_LIMIT = 20; // últimas mensagens no contexto
const MAX_MESSAGE_LEN = 8_000;
const MAX_TOOL_ITERS = 6; // teto de idas-e-voltas de tool no mesmo turno

const SYSTEM_PROMPT =
  `Você é o Copiloto da DF AGRO, uma consultoria de agricultura de precisão. ` +
  `Ajude com gestão (clientes, serviços, safras, custos, margem, funil, equipe). ` +
  `Regras invioláveis: a fonte da verdade são os dados da plataforma, não você — ` +
  `nunca invente números de clientes, receitas, custos, hectares, análises de solo ` +
  `ou mapas. Para qualquer dado objetivo, use as ferramentas de leitura disponíveis ` +
  `(get_client, get_season, get_costs, get_collection_status). ` +
  `Para dúvidas conceituais/procedimentais, use search_knowledge (Base de ` +
  `Conhecimento) e SEMPRE cite ao final quais documentos (fontes) você utilizou. ` +
  `Se search_knowledge não achar nada, diga que não há documento aprovado sobre o ` +
  `tema — não invente. ` +
  `Algumas ferramentas (get_farm, get_field, get_soil_analysis) retornam ` +
  `disponivel=false porque esta plataforma NÃO tem esse cadastro — nesse caso, ` +
  `diga com clareza que a informação não existe na plataforma e NÃO invente nada. ` +
  `Se uma ferramenta retornar encontrado=false, informe que o registro não foi ` +
  `achado. Você só pode LER; não altera nenhum dado. Responda objetivo, em ` +
  `português do Brasil.`;

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

// hash estável e não-reversível dos args (para auditar sem gravar PII crua).
function argsHash(obj: unknown): string {
  const s = JSON.stringify(obj ?? {});
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

// embeddings nativas do Edge (gte-small, 384 dim) — sem chave externa.
// deno-lint-ignore no-explicit-any
const SB_AI = (globalThis as any).Supabase?.ai;
async function embedText(text: string): Promise<number[]> {
  if (!SB_AI) throw new Error("Supabase.ai indisponível.");
  const session = new SB_AI.Session(EMB_MODEL);
  return (await session.run(text, { mean_pool: true, normalize: true })) as number[];
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
  let body: { message?: unknown; conversation_id?: unknown; contexto?: unknown };
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

  // recuperação semântica (RAG): embed a consulta + RPC sob RLS (só docs
  // aprovados/indexados do próprio usuário). Injetada como ctx.retrieve.
  const retrieve = async (consulta: string, limite: number): Promise<KnowledgeHit[]> => {
    const qv = await embedText(consulta);
    const { data, error } = await sb.rpc("match_ai_knowledge", {
      query_embedding: `[${qv.join(",")}]`,
      match_count: limite,
    });
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<Record<string, unknown>>).map((h) => ({
      doc_id: String(h.doc_id),
      titulo: String(h.titulo),
      fonte: (h.fonte as string) ?? null,
      idx: Number(h.idx),
      trecho: String(h.trecho),
      distancia: Number(h.distancia),
    }));
  };
  const ctx = { userId, empresa: EMPRESA, retrieve };

  // documentos da Base de Conhecimento efetivamente usados nesta resposta.
  const fontesUsadas = new Map<string, { doc_id: string; titulo: string; fonte: string | null }>();

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

    // grava a mensagem do usuário.
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

    // ---- provider + loop de tools (READ-only) ----
    const provider = new AnthropicProvider(anthropicKey, model);
    let inputTokens = 0;
    let outputTokens = 0;
    let finalText = "";

    for (let iter = 0; iter < MAX_TOOL_ITERS; iter++) {
      const result = await provider.complete({
        system: SYSTEM_PROMPT,
        messages,
        maxTokens: MAX_TOKENS,
        timeoutMs: TIMEOUT_MS,
        tools: toolSpecs(),
      });
      inputTokens += result.inputTokens;
      outputTokens += result.outputTokens;

      if (result.stopReason !== "tool_use" || result.toolUses.length === 0) {
        finalText = result.text;
        break;
      }

      // ecoa o turno do assistente (com os blocos tool_use).
      messages.push({ role: "assistant", content: result.content });

      // executa cada tool e monta os tool_result.
      const toolResults: ToolResultBlock[] = [];
      for (const call of result.toolUses) {
        const tStart = Date.now();
        let ok = true;
        let erro: string | null = null;
        let payload: unknown;
        try {
          payload = await runReadTool(sb, call.name, call.input, ctx);
          // captura as fontes citáveis vindas do RAG.
          if (call.name === "search_knowledge") {
            const dados = (payload as { dados?: { fontes?: unknown } })?.dados;
            const fontes = Array.isArray(dados?.fontes) ? dados!.fontes : [];
            for (const f of fontes as Array<Record<string, unknown>>) {
              const id = String(f.doc_id);
              if (id && !fontesUsadas.has(id)) {
                fontesUsadas.set(id, {
                  doc_id: id,
                  titulo: String(f.titulo ?? ""),
                  fonte: (f.fonte as string) ?? null,
                });
              }
            }
          }
        } catch (e) {
          ok = false;
          erro = (e as Error).message ?? "erro na tool";
          payload = {
            disponivel: false,
            encontrado: false,
            motivo: "Falha ao consultar os dados.",
          };
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(payload),
          is_error: !ok,
        });

        // (4/8) registra o tool_call na auditoria (nível READ sempre).
        await sb.from("ai_audit_log").insert({
          empresa: EMPRESA,
          conversation_id: conversationId,
          tipo: "tool_call",
          tool: call.name,
          nivel: "READ",
          args_hash: argsHash(call.input),
          modelo: result.model,
          ok,
          erro: erro ? erro.slice(0, 500) : null,
          latencia_ms: Date.now() - tStart,
        });
      }

      // devolve os resultados como turno do usuário e continua o loop.
      messages.push({
        role: "user",
        content: toolResults as unknown as ContentBlock[],
      });

      if (iter === MAX_TOOL_ITERS - 1) {
        // teto atingido: pede uma resposta final sem mais tools.
        const wrap = await provider.complete({
          system: SYSTEM_PROMPT,
          messages,
          maxTokens: MAX_TOKENS,
          timeoutMs: TIMEOUT_MS,
        });
        inputTokens += wrap.inputTokens;
        outputTokens += wrap.outputTokens;
        finalText = wrap.text;
      }
    }

    // grava resposta.
    await sb.from("ai_messages").insert({
      conversation_id: conversationId,
      empresa: EMPRESA,
      papel: "assistant",
      conteudo: finalText,
      tokens: outputTokens,
    });
    await sb.from("ai_conversations")
      .update({ atualizado_em: new Date().toISOString() })
      .eq("id", conversationId);

    // (4) log do run.
    await sb.from("ai_audit_log").insert({
      empresa: EMPRESA,
      conversation_id: conversationId,
      tipo: "run",
      nivel: "READ",
      modelo: model,
      ok: true,
      latencia_ms: Date.now() - started,
      tokens: inputTokens + outputTokens,
    });

    return json(200, {
      conversation_id: conversationId,
      reply: finalText,
      usage: { input: inputTokens, output: outputTokens },
      fontes: [...fontesUsadas.values()], // docs da Base de Conhecimento usados
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
