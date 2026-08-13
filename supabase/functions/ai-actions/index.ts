// ai-actions (Edge Function) — Action Tools + Approval Engine (Fase APPROVALS).
// SAFE_WRITE: editor/admin executam direto (reversível/interno).
// SENSITIVE_WRITE: nunca executa sozinha → cria ai_approvals 'pendente'; só ADMIN
// decide (aprovar/editar/rejeitar) → executa → auditoria. SEM delete/finanças/
// recomendação agronômica final. Tudo sob JWT do usuário (RLS) + auditoria.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  canDecide,
  canExecuteSafe,
  canPropose,
  decisionToStatus,
  defaultRisk,
  isForbiddenAction,
  toolClass,
} from "./approval_logic.ts";

const EMPRESA = "DF AGRO";
const API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") ?? "v20.0";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}
function err(code: string, message: string) { return { error: { code, message } }; }
function argsHash(o: unknown): string { const s = JSON.stringify(o ?? {}); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); }
// deno-lint-ignore no-explicit-any
type SB = any;

async function audit(sb: SB, row: Record<string, unknown>) {
  try { await sb.from("ai_audit_log").insert({ empresa: EMPRESA, tipo: "tool_call", ...row }); } catch { /* nunca derruba */ }
}

// ---- SAFE_WRITE handlers (retornam {tabela,id}) ----
async function execSafe(sb: SB, tool: string, payload: Record<string, unknown>): Promise<{ tabela: string; id: string }> {
  if (tool === "create_internal_alert") {
    const { data, error } = await sb.from("ai_alerts").insert({
      empresa: EMPRESA, nivel: String(payload.nivel ?? "info"), titulo: payload.titulo ?? null,
      mensagem: payload.mensagem ?? null, entity_type: payload.entity_type ?? null, entity_id: payload.entity_id ?? null, origem: "ia",
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { tabela: "ai_alerts", id: data.id };
  }
  if (tool === "create_task") {
    const titulo = String(payload.titulo ?? "").trim();
    if (!titulo) throw new Error("titulo é obrigatório");
    const { data, error } = await sb.from("ai_tasks").insert({
      empresa: EMPRESA, titulo, descricao: payload.descricao ?? null, prioridade: String(payload.prioridade ?? "media"),
      entity_type: payload.entity_type ?? null, entity_id: payload.entity_id ?? null, origem: "ia",
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { tabela: "ai_tasks", id: data.id };
  }
  if (tool === "generate_report_draft") {
    const titulo = String(payload.titulo ?? "Rascunho de relatório").trim();
    const { data, error } = await sb.from("ai_report_drafts").insert({
      empresa: EMPRESA, titulo, conteudo: payload.conteudo ?? "", entity_type: payload.entity_type ?? null, entity_id: payload.entity_id ?? null, origem: "ia",
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { tabela: "ai_report_drafts", id: data.id };
  }
  throw new Error(`SAFE_WRITE desconhecida: ${tool}`);
}

// ---- SENSITIVE_WRITE executor (só chamado na APROVAÇÃO) ----
async function execSensitive(tool: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (tool === "send_external_whatsapp_message") {
    const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";
    const phoneNumberId = String(payload.phone_number_id ?? Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "");
    const to = String(payload.to ?? "").trim();
    const text = String(payload.text ?? "").trim();
    if (!to || !text) throw new Error("to/text obrigatórios");
    if (!token || !phoneNumberId) throw new Error("not_configured: WhatsApp token/phone_number_id ausente");
    const url = `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`;
    let lastErr = "";
    for (let a = 1; a <= 3; a++) {
      try {
        const resp = await fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text.slice(0, 4000) } }), signal: AbortSignal.timeout(20_000) });
        if (resp.ok) { const d = await resp.json(); return { enviado: true, wa_message_id: d?.messages?.[0]?.id ?? null }; }
        lastErr = `HTTP ${resp.status}`;
        if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) break;
      } catch (e) { lastErr = (e as Error).message ?? "rede"; }
      await new Promise((r) => setTimeout(r, 400 * a));
    }
    throw new Error(`falha no envio: ${lastErr}`);
  }
  throw new Error(`SENSITIVE_WRITE desconhecida: ${tool}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, err("method_not_allowed", "Use POST."));

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json(401, err("unauthorized", "Token ausente."));
  const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: ud } = await sb.auth.getUser();
  const user = ud?.user;
  if (!user) return json(401, err("unauthorized", "Sessão inválida."));
  const { data: ativo, error: ativoErr } = await sb.rpc("is_membro_ativo");
  if (ativoErr) return json(500, err("rbac_error", "Falha ao verificar acesso."));
  if (ativo !== true) return json(403, err("forbidden", "Acesso não liberado."));
  let papel = "leitor";
  try { const { data: p } = await sb.rpc("meu_papel"); if (typeof p === "string" && p) papel = p; } catch { /* leitor */ }

  let body: { action?: unknown; tool?: unknown; payload?: unknown; approval_id?: unknown; decision?: unknown; entity_type?: unknown; entity_id?: unknown; risco?: unknown };
  try { body = await req.json(); } catch { return json(400, err("bad_request", "JSON inválido.")); }
  const action = typeof body.action === "string" ? body.action : "";
  const payload = (body.payload && typeof body.payload === "object" ? body.payload : {}) as Record<string, unknown>;

  try {
    // ---- executar SAFE_WRITE direto (editor/admin) ----
    if (action === "execute_safe") {
      const tool = typeof body.tool === "string" ? body.tool : "";
      if (isForbiddenAction(tool) || toolClass(tool) !== "SAFE_WRITE") return json(400, err("bad_tool", "Ferramenta não é SAFE_WRITE válida."));
      if (!canExecuteSafe(papel)) { await audit(sb, { tool, nivel: "SAFE_WRITE", ok: false, erro: "forbidden", args_hash: argsHash(payload) }); return json(403, err("forbidden", "Requer editor/admin.")); }
      const r = await execSafe(sb, tool, payload);
      await audit(sb, { tool, nivel: "SAFE_WRITE", ok: true, args_hash: argsHash(payload) });
      return json(200, { ok: true, ...r });
    }

    // ---- propor SENSITIVE_WRITE (cria approval pendente; NÃO executa) ----
    if (action === "propose") {
      const tool = typeof body.tool === "string" ? body.tool : "";
      if (isForbiddenAction(tool) || toolClass(tool) !== "SENSITIVE_WRITE") return json(400, err("bad_tool", "Ferramenta não é SENSITIVE_WRITE válida."));
      if (!canPropose(papel)) return json(403, err("forbidden", "Requer editor/admin para propor."));
      const risco = ["baixo", "medio", "alto"].includes(String(body.risco)) ? String(body.risco) : defaultRisk(tool);
      const { data, error } = await sb.from("ai_approvals").insert({
        empresa: EMPRESA, agente: "Copiloto DF AGRO", tool, nivel: "SENSITIVE_WRITE",
        entity_type: (body.entity_type as string) ?? null, entity_id: (body.entity_id as string) ?? null,
        payload, risco, status: "pendente",
      }).select("id").single();
      if (error) throw new Error(error.message);
      await audit(sb, { tool, nivel: "SENSITIVE_WRITE", ok: true, erro: null, args_hash: argsHash(payload) });
      return json(200, { ok: true, approval_id: data.id, status: "pendente" });
    }

    // ---- decidir (aprovar/editar/rejeitar) — SÓ ADMIN ----
    if (action === "decide") {
      if (!canDecide(papel)) return json(403, err("forbidden_admin", "Apenas admin decide aprovações."));
      const approvalId = typeof body.approval_id === "string" ? body.approval_id : "";
      const decision = String(body.decision ?? "");
      if (!approvalId || !["approve", "edit", "reject"].includes(decision)) return json(400, err("bad_request", "approval_id/decision inválidos."));
      const { data: ap } = await sb.from("ai_approvals").select("*").eq("id", approvalId).maybeSingle();
      if (!ap) return json(404, err("not_found", "Aprovação não encontrada."));
      if (ap.status !== "pendente") return json(409, err("conflict", `Aprovação já está '${ap.status}'.`));
      const nowIso = new Date().toISOString();

      if (decision === "reject") {
        await sb.from("ai_approvals").update({ status: "rejeitado", decidido_por: user.id, decidido_em: nowIso, atualizado_em: nowIso }).eq("id", approvalId);
        await audit(sb, { conversation_id: null, tool: ap.tool, nivel: "SENSITIVE_WRITE", ok: true, erro: "rejeitado", args_hash: argsHash(ap.payload) });
        return json(200, { ok: true, status: "rejeitado" });
      }
      if (decision === "edit") {
        const novo = (payload && Object.keys(payload).length) ? payload : ap.payload;
        await sb.from("ai_approvals").update({ payload: novo, atualizado_em: nowIso }).eq("id", approvalId);
        await audit(sb, { tool: ap.tool, nivel: "SENSITIVE_WRITE", ok: true, erro: "editado", args_hash: argsHash(novo) });
        return json(200, { ok: true, status: "pendente", editado: true });
      }
      // approve → executa
      if (isForbiddenAction(ap.tool) || toolClass(ap.tool) !== "SENSITIVE_WRITE") return json(400, err("bad_tool", "Ferramenta inválida para execução."));
      try {
        const resultado = await execSensitive(ap.tool, ap.payload as Record<string, unknown>);
        await sb.from("ai_approvals").update({ status: decisionToStatus("approve", true), decidido_por: user.id, decidido_em: nowIso, resultado, erro: null, atualizado_em: nowIso }).eq("id", approvalId);
        await audit(sb, { tool: ap.tool, nivel: "SENSITIVE_WRITE", ok: true, args_hash: argsHash(ap.payload) });
        return json(200, { ok: true, status: "executado", resultado });
      } catch (e) {
        const msg = (e as Error).message ?? "erro";
        await sb.from("ai_approvals").update({ status: decisionToStatus("approve", false), decidido_por: user.id, decidido_em: nowIso, erro: msg.slice(0, 500), atualizado_em: nowIso }).eq("id", approvalId);
        await audit(sb, { tool: ap.tool, nivel: "SENSITIVE_WRITE", ok: false, erro: msg.slice(0, 500), args_hash: argsHash(ap.payload) });
        return json(502, err("exec_error", msg));
      }
    }

    return json(400, err("bad_request", "action inválida (execute_safe | propose | decide)."));
  } catch (e) {
    return json(500, err("internal", (e as Error).message ?? "erro"));
  }
});
