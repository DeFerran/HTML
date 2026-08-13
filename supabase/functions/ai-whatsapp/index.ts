// ai-whatsapp (Edge Function) — Integração inicial WhatsApp Cloud API.
// verify_jwt=FALSE (o webhook do WhatsApp não manda JWT). A segurança é:
//   - GET: handshake com WHATSAPP_VERIFY_TOKEN (hub.verify_token);
//   - POST webhook: assinatura HMAC-SHA256 (X-Hub-Signature-256, app secret);
//   - POST admin (send_message/status): valida o JWT do usuário e exige admin.
// Escrita no banco pelo SERVICE ROLE (backend). Tokens só no backend (env).
// Escopo: SOMENTE leitura (consultas/respostas/resumos). Sem ações sensíveis.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { clampText, parseInboundMessages, verifyChallenge, verifySignature } from "./wa_logic.ts";

const EMPRESA = "DF AGRO";
const API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") ?? "v20.0";
const EMB_MODEL = "gte-small";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}
// deno-lint-ignore no-explicit-any
type SB = any;

function svc(): SB {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
}

async function log(sb: SB, userId: string | null, tipo: string, nivel: string, mensagem: string, detalhe?: unknown) {
  try { await sb.from("whatsapp_logs").insert({ user_id: userId, empresa: EMPRESA, tipo, nivel, mensagem: mensagem.slice(0, 500), detalhe: detalhe ?? null }); } catch { /* nunca derruba */ }
}

// ---- envio com retry seguro ----
async function sendWhatsApp(phoneNumberId: string, to: string, text: string): Promise<{ ok: boolean; id: string | null; erro: string | null }> {
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";
  if (!token || !phoneNumberId) return { ok: false, id: null, erro: "not_configured: token/phone_number_id ausente" };
  const url = `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`;
  const payload = { messaging_product: "whatsapp", to, type: "text", text: { body: clampText(text, 4000) } };
  let lastErr = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
      });
      if (resp.ok) {
        const data = await resp.json();
        return { ok: true, id: data?.messages?.[0]?.id ?? null, erro: null };
      }
      lastErr = `HTTP ${resp.status}: ${(await resp.text().catch(() => "")).slice(0, 200)}`;
      if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) break; // erro de cliente: não adianta retry
    } catch (e) { lastErr = (e as Error).message ?? "erro de rede"; }
    await new Promise((r) => setTimeout(r, 400 * attempt));
  }
  return { ok: false, id: null, erro: lastErr || "falha ao enviar" };
}

// ---- orchestrator READ-only (RAG + memória validada + snapshot) ----
async function embed(text: string): Promise<number[] | null> {
  // deno-lint-ignore no-explicit-any
  const ai = (globalThis as any).Supabase?.ai;
  if (!ai) return null;
  try { return await new ai.Session(EMB_MODEL).run(text, { mean_pool: true, normalize: true }) as number[]; } catch { return null; }
}
async function orchestrate(sb: SB, texto: string, historico: string): Promise<{ reply: string; usouFontes: number }> {
  const key = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  const model = Deno.env.get("AI_MODEL") ?? "claude-sonnet-5";

  // ferramentas AUTORIZADAS (somente leitura): RAG + memória validada + snapshot
  let contexto = "";
  let usouFontes = 0;
  const v = await embed(texto);
  if (v) {
    try {
      const { data } = await sb.rpc("match_ai_knowledge", { query_embedding: `[${v.join(",")}]`, match_count: 4 });
      const hits = (data ?? []) as Array<Record<string, unknown>>;
      usouFontes = hits.length;
      if (hits.length) contexto += "\nConhecimento:\n" + hits.map((h) => `- (${h.titulo}) ${h.trecho}`).join("\n");
    } catch { /* ignore */ }
  }
  try {
    const { data } = await sb.rpc("match_ai_memory", { consulta: texto, match_count: 5 });
    const mem = (data ?? []) as Array<Record<string, unknown>>;
    if (mem.length) contexto += "\nMemória validada:\n" + mem.map((m) => `- ${m.content}`).join("\n");
  } catch { /* ignore */ }
  try {
    const { count: clientes } = await sb.from("bi_clientes").select("id", { count: "exact", head: true });
    const { data: sf } = await sb.from("bi_safras").select("safra_label, receita, custo_competencia").eq("safra_label", "26/27").maybeSingle();
    contexto += `\nSnapshot: ${clientes ?? 0} clientes; safra 26/27 receita=${sf?.receita ?? "?"} custo=${sf?.custo_competencia ?? "?"}.`;
  } catch { /* ignore */ }

  if (!key) {
    return { reply: "Assistente da DF AGRO indisponível no momento (não configurado). Tente novamente mais tarde.", usouFontes };
  }
  const system = `Você é o assistente da DF AGRO no WhatsApp. Responda em português do Brasil, de forma curta e objetiva. ` +
    `Escopo desta fase: apenas CONSULTAS, RESPOSTAS e RESUMOS. NÃO execute ações sensíveis (não altere dados, não faça finanças, não prometa ações). ` +
    `Use SOMENTE os dados fornecidos no contexto; se faltar, diga que não tem essa informação. Nunca invente números.\n` +
    `Contexto disponível:${contexto || " (sem dados adicionais)"}`;
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model, max_tokens: 512, system,
        messages: [{ role: "user", content: (historico ? historico + "\n\n" : "") + texto }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!resp.ok) throw new Error(`provider ${resp.status}`);
    const data = await resp.json();
    const reply = (data.content ?? []).filter((b: { type?: string }) => b?.type === "text").map((b: { text?: string }) => b?.text ?? "").join("").trim();
    return { reply: reply || "Desculpe, não consegui gerar uma resposta agora.", usouFontes };
  } catch (_e) {
    return { reply: "Tive um problema ao consultar o assistente agora. Tente novamente em instantes.", usouFontes };
  }
}

// ---- processamento de um inbound ----
async function handleInbound(sb: SB, owner: string, phoneNumberId: string, m: { wa_message_id: string; from: string; name: string | null; tipo: string; texto: string }) {
  // contato
  const { data: contato } = await sb.from("whatsapp_contacts")
    .upsert({ user_id: owner, empresa: EMPRESA, wa_id: m.from, nome: m.name, ultimo_contato_em: new Date().toISOString() }, { onConflict: "user_id,wa_id" })
    .select("id").single();
  const contactId = contato?.id ?? null;
  // conversa (uma por contato)
  let convId: string | null = null;
  const { data: conv } = await sb.from("whatsapp_conversations").select("id").eq("contact_id", contactId).order("atualizado_em", { ascending: false }).limit(1).maybeSingle();
  if (conv) convId = conv.id;
  else {
    const { data: novo } = await sb.from("whatsapp_conversations").insert({ user_id: owner, empresa: EMPRESA, contact_id: contactId, wa_id: m.from, status: "aberta" }).select("id").single();
    convId = novo?.id ?? null;
  }
  // dedupe da mensagem recebida (unique wa_message_id)
  const { data: ins } = await sb.from("whatsapp_messages")
    .upsert({ user_id: owner, empresa: EMPRESA, conversation_id: convId, contact_id: contactId, wa_message_id: m.wa_message_id, direcao: "in", tipo: m.tipo, texto: m.texto, status: "recebida" }, { onConflict: "wa_message_id", ignoreDuplicates: true })
    .select("id");
  if (!ins || !ins.length) { await log(sb, owner, "webhook", "info", `mensagem duplicada ignorada ${m.wa_message_id}`); return; }
  if (m.tipo !== "text" || !m.texto) { await log(sb, owner, "webhook", "info", `mensagem sem texto (${m.tipo}) — sem resposta`); return; }

  // histórico curto
  const { data: hist } = await sb.from("whatsapp_messages").select("direcao, texto").eq("conversation_id", convId).order("criado_em", { ascending: true }).limit(10);
  const historico = (hist ?? []).map((h: Record<string, unknown>) => `${h.direcao === "in" ? "Usuário" : "Assistente"}: ${h.texto}`).join("\n");

  const { reply, usouFontes } = await orchestrate(sb, m.texto, historico);
  const env = await sendWhatsApp(phoneNumberId, m.from, reply);
  await sb.from("whatsapp_messages").insert({ user_id: owner, empresa: EMPRESA, conversation_id: convId, contact_id: contactId, wa_message_id: env.id, direcao: "out", tipo: "text", texto: reply, status: env.ok ? "enviada" : "erro", erro: env.erro });
  await sb.from("whatsapp_conversations").update({ atualizado_em: new Date().toISOString() }).eq("id", convId);
  await log(sb, owner, "orchestrator", env.ok ? "info" : "erro", env.ok ? `respondido (${usouFontes} fonte(s))` : `falha no envio: ${env.erro}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const sb = svc();

  // GET — handshake de verificação do webhook
  if (req.method === "GET") {
    const params = new URL(req.url).searchParams;
    const challenge = verifyChallenge(params, Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "");
    if (challenge !== null) return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
    return new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");

  // ---- caminho WEBHOOK (assinatura HMAC) ----
  if (sig) {
    const okSig = await verifySignature(Deno.env.get("WHATSAPP_APP_SECRET") ?? "", raw, sig);
    if (!okSig) { await log(sb, null, "webhook", "erro", "assinatura inválida"); return json(401, { error: "bad_signature" }); }
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return json(400, { error: "bad_json" }); }

    // resolve dono/config ativos (single-tenant: uma config ativa)
    const { data: cfg } = await sb.from("whatsapp_config").select("user_id, phone_number_id").eq("ativo", true).order("atualizado_em", { ascending: false }).limit(1).maybeSingle();
    const owner = cfg?.user_id ?? null;
    const phoneNumberId = cfg?.phone_number_id ?? Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
    if (!owner) { await log(sb, null, "webhook", "aviso", "sem config ativa — mensagem recebida mas não processada"); return json(200, { ok: true }); }

    const msgs = parseInboundMessages(body);
    // responde 200 rápido mesmo em erro (WhatsApp reenviaria; dedupe protege)
    for (const m of msgs) {
      try { await handleInbound(sb, owner, phoneNumberId, m); }
      catch (e) { await log(sb, owner, "webhook", "erro", `falha ao processar ${m.wa_message_id}: ${(e as Error).message}`); }
    }
    await sb.from("whatsapp_config").update({ ultimo_evento_em: new Date().toISOString() }).eq("user_id", owner);
    return json(200, { ok: true, processadas: msgs.length });
  }

  // ---- caminho ADMIN (send_message / status) — valida JWT + admin ----
  let body: { action?: unknown; to?: unknown; text?: unknown };
  try { body = JSON.parse(raw); } catch { return json(400, { error: "bad_json" }); }
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json(401, { error: "unauthorized" });
  const userSb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: ud } = await userSb.auth.getUser();
  const user = ud?.user;
  if (!user) return json(401, { error: "unauthorized" });
  const { data: adm } = await userSb.rpc("is_admin");
  if (adm !== true) return json(403, { error: "forbidden_admin" });

  const action = typeof body.action === "string" ? body.action : "";
  if (action === "status") {
    const { data: cfg } = await sb.from("whatsapp_config").select("*").eq("user_id", user.id).maybeSingle();
    return json(200, { ok: true, config: cfg ?? null, conectado: !!(cfg && cfg.ativo) });
  }
  if (action === "send_message") {
    const to = typeof body.to === "string" ? body.to.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!to || !text) return json(400, { error: "to/text obrigatórios" });
    const { data: cfg } = await sb.from("whatsapp_config").select("phone_number_id").eq("user_id", user.id).maybeSingle();
    const phoneNumberId = cfg?.phone_number_id ?? Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
    const env = await sendWhatsApp(phoneNumberId, to, text);
    // registra a mensagem de saída (contato/conversa mínimos)
    const { data: contato } = await sb.from("whatsapp_contacts").upsert({ user_id: user.id, empresa: EMPRESA, wa_id: to, ultimo_contato_em: new Date().toISOString() }, { onConflict: "user_id,wa_id" }).select("id").single();
    await sb.from("whatsapp_messages").insert({ user_id: user.id, empresa: EMPRESA, contact_id: contato?.id ?? null, wa_message_id: env.id, direcao: "out", tipo: "text", texto: text, status: env.ok ? "enviada" : "erro", erro: env.erro });
    await log(sb, user.id, "send", env.ok ? "info" : "erro", env.ok ? `envio manual para ${to}` : `falha envio manual: ${env.erro}`);
    return json(env.ok ? 200 : 502, { ok: env.ok, id: env.id, erro: env.erro });
  }
  return json(400, { error: "action inválida" });
});
