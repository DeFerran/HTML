// ai-worker (Edge Function) — Automation Engine (Fase AUTOMAÇÕES).
// Processa a fila ai_jobs (queue aprovada). Executa regras (TRIGGER/CONDITION/
// ACTION). SEM ações financeiras. SEM exclusões (nada é apagado; jobs mudam de
// status, regras desativam via ativo=false).
//
// Segurança: verify_jwt=true + auth.getUser() + is_membro_ativo(). Tudo sob o
// JWT do usuário → a RLS é a barreira de tenant. Retries controlados, dedupe por
// chave única (idempotência).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  buildDailySummary,
  dedupeManual,
  dedupeSchedule,
  evaluateCondition,
  isScheduleDue,
  retryDelaySeconds,
  shouldRetry,
} from "./automation_logic.ts";

const EMPRESA = "DF AGRO";
const MAX_JOBS = 5;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}
function err(code: string, message: string) { return { error: { code, message } }; }

// deno-lint-ignore no-explicit-any
type SB = any;

async function num(sb: SB, table: string, filters: [string, unknown][]): Promise<number> {
  try {
    let q = sb.from(table).select("id", { count: "exact", head: true });
    for (const f of filters) q = q.eq(f[0], f[1]);
    const { count } = await q;
    return count ?? 0;
  } catch { return 0; }
}

// ---- ações ----
async function runAgent(prompt: string): Promise<{ reply: string }> {
  const key = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  const model = Deno.env.get("AI_MODEL") ?? "claude-sonnet-5";
  if (!key) throw new Error("not_configured: ANTHROPIC_API_KEY ausente para run_agent.");
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 512, messages: [{ role: "user", content: prompt || "Resuma o status." }] }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!resp.ok) throw new Error(`provider ${resp.status}`);
  const data = await resp.json();
  const reply = (data.content ?? []).filter((b: { type?: string }) => b?.type === "text").map((b: { text?: string }) => b?.text ?? "").join("").trim();
  return { reply };
}

async function executeAction(sb: SB, rule: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = String(rule.action_type);
  const cfg = (rule.action_config ?? {}) as Record<string, unknown>;
  if (action === "generate_summary") {
    const safra = String(cfg.safra ?? "26/27");
    const clientes = await num(sb, "bi_clientes", []);
    const docsIndexados = await num(sb, "ai_knowledge_docs", [["status", "indexado"]]);
    const memoriasValidadas = await num(sb, "ai_memory", [["status", "VALIDATED"]]);
    let receita = 0, custo = 0;
    try {
      const { data } = await sb.from("bi_safras").select("receita, custo_competencia").eq("safra_label", safra).maybeSingle();
      if (data) { receita = Number(data.receita) || 0; custo = Number(data.custo_competencia) || 0; }
    } catch { /* ignore */ }
    const summary = buildDailySummary({ safra, clientes, receita, custo, docsIndexados, memoriasValidadas });
    return { tipo: "resumo_interno", summary };
  }
  if (action === "create_internal_alert") {
    return { tipo: "alerta_interno", alerta: { nivel: String(cfg.nivel ?? "info"), mensagem: String(cfg.mensagem ?? "Alerta interno.") } };
  }
  if (action === "run_agent") {
    return { tipo: "run_agent", ...(await runAgent(String(cfg.prompt ?? ""))) };
  }
  throw new Error(`ação desconhecida: ${action}`);
}

// contexto para CONDITION (leve; usa agregados reais quando útil)
async function buildContext(sb: SB, rule: Record<string, unknown>): Promise<Record<string, unknown>> {
  const cfg = (rule.action_config ?? {}) as Record<string, unknown>;
  const safra = String(cfg.safra ?? "26/27");
  const clientes = await num(sb, "bi_clientes", []);
  let receita = 0, custo = 0;
  try {
    const { data } = await sb.from("bi_safras").select("receita, custo_competencia").eq("safra_label", safra).maybeSingle();
    if (data) { receita = Number(data.receita) || 0; custo = Number(data.custo_competencia) || 0; }
  } catch { /* ignore */ }
  return { clientes, receita, custo, safra, margem: receita - custo };
}

async function executeJob(sb: SB, job: Record<string, unknown>): Promise<Record<string, unknown>> {
  const started = new Date().toISOString();
  const t0 = Date.now();
  const tentativa = (Number(job.tentativas) || 0) + 1;
  // carrega a regra
  const { data: rule } = await sb.from("automation_rules").select("*").eq("id", job.rule_id).maybeSingle();
  if (!rule) {
    await sb.from("ai_jobs").update({ status: "erro", erro: "regra não encontrada", atualizado_em: new Date().toISOString() }).eq("id", job.id);
    return { job: job.id, status: "erro", motivo: "rule_missing" };
  }

  try {
    const ctx = await buildContext(sb, rule);
    if (!evaluateCondition(rule.condition as Record<string, unknown>, ctx)) {
      await sb.from("ai_jobs").update({ status: "ok", resultado: { pulado: true }, atualizado_em: new Date().toISOString() }).eq("id", job.id);
      await sb.from("automation_runs").insert({
        empresa: EMPRESA, rule_id: rule.id, job_id: job.id, trigger_type: rule.trigger_type,
        status: "pulado", tentativa, started_at: started, finished_at: new Date().toISOString(),
        duracao_ms: Date.now() - t0, output: { motivo: "condição não atendida" },
      });
      return { job: job.id, status: "pulado" };
    }

    const output = await executeAction(sb, rule);
    await sb.from("ai_jobs").update({ status: "ok", tentativas: tentativa, resultado: output, erro: null, atualizado_em: new Date().toISOString() }).eq("id", job.id);
    await sb.from("automation_runs").insert({
      empresa: EMPRESA, rule_id: rule.id, job_id: job.id, trigger_type: rule.trigger_type,
      status: "ok", tentativa, started_at: started, finished_at: new Date().toISOString(),
      duracao_ms: Date.now() - t0, output,
    });
    await sb.from("automation_rules").update({ ultima_exec: new Date().toISOString(), atualizado_em: new Date().toISOString() }).eq("id", rule.id);
    return { job: job.id, status: "ok" };
  } catch (e) {
    const msg = (e as Error).message ?? "erro";
    const max = Number(job.max_tentativas) || 3;
    const retry = shouldRetry(tentativa, max);
    if (retry) {
      const runAt = new Date(Date.now() + retryDelaySeconds(tentativa) * 1000).toISOString();
      await sb.from("ai_jobs").update({ status: "pendente", tentativas: tentativa, erro: msg.slice(0, 500), run_at: runAt, atualizado_em: new Date().toISOString() }).eq("id", job.id);
    } else {
      await sb.from("ai_jobs").update({ status: "erro", tentativas: tentativa, erro: msg.slice(0, 500), atualizado_em: new Date().toISOString() }).eq("id", job.id);
    }
    await sb.from("automation_runs").insert({
      empresa: EMPRESA, rule_id: rule.id, job_id: job.id, trigger_type: rule.trigger_type,
      status: "erro", tentativa, started_at: started, finished_at: new Date().toISOString(),
      duracao_ms: Date.now() - t0, erro: msg.slice(0, 500),
    });
    return { job: job.id, status: retry ? "retry" : "erro", erro: msg };
  }
}

async function enqueue(sb: SB, rule: Record<string, unknown>, dedupe: string): Promise<string | null> {
  const { data } = await sb.from("ai_jobs")
    .upsert({ empresa: EMPRESA, tipo: "automation", rule_id: rule.id, dedupe_key: dedupe, payload: {}, status: "pendente", run_at: new Date().toISOString() },
      { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
    .select("id");
  return (data && data[0]?.id) ?? null; // null = já existia (idempotente)
}

async function processBatch(sb: SB): Promise<Record<string, unknown>[]> {
  const { data: jobs } = await sb.rpc("automation_claim_jobs", { max_jobs: MAX_JOBS });
  const out: Record<string, unknown>[] = [];
  for (const j of (jobs ?? [])) out.push(await executeJob(sb, j));
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, err("method_not_allowed", "Use POST."));

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json(401, err("unauthorized", "Token ausente."));

  const sb = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData?.user) return json(401, err("unauthorized", "Sessão inválida."));
  const { data: ativo, error: ativoErr } = await sb.rpc("is_membro_ativo");
  if (ativoErr) return json(500, err("rbac_error", "Falha ao verificar acesso."));
  if (ativo !== true) return json(403, err("forbidden", "Acesso não liberado."));

  let body: { action?: unknown; rule_id?: unknown; idempotency_key?: unknown };
  try { body = await req.json(); } catch { return json(400, err("bad_request", "JSON inválido.")); }
  const action = typeof body.action === "string" ? body.action : "";

  try {
    if (action === "run_rule") {
      const ruleId = typeof body.rule_id === "string" ? body.rule_id : "";
      if (!ruleId) return json(400, err("bad_request", "rule_id é obrigatório."));
      const { data: rule } = await sb.from("automation_rules").select("*").eq("id", ruleId).maybeSingle();
      if (!rule) return json(404, err("not_found", "Regra não encontrada."));
      // dedupe: chave do cliente OU bucket por minuto (evita duplicação em cliques repetidos)
      const bucket = typeof body.idempotency_key === "string" && body.idempotency_key
        ? body.idempotency_key
        : `${ruleId}-${Math.floor(Date.now() / 60000)}`;
      await enqueue(sb, rule, dedupeManual(ruleId, bucket));
      const results = await processBatch(sb);
      return json(200, { ok: true, acao: "run_rule", processados: results });
    }

    if (action === "tick") {
      // enfileira schedules "due" (idempotente por dia) e processa um lote.
      const nowIso = new Date().toISOString();
      const { data: rules } = await sb.rpc("automation_due_rules");
      let enfileirados = 0;
      for (const r of (rules ?? [])) {
        if (isScheduleDue(r.trigger_config, r.ultima_exec, nowIso)) {
          const id = await enqueue(sb, r, dedupeSchedule(r.id, nowIso.slice(0, 10)));
          if (id) enfileirados++;
        }
      }
      const results = await processBatch(sb);
      return json(200, { ok: true, acao: "tick", enfileirados, processados: results });
    }

    return json(400, err("bad_request", "action inválida (use 'run_rule' ou 'tick')."));
  } catch (e) {
    return json(500, err("internal", (e as Error).message ?? "erro"));
  }
});
