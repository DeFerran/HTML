// Observabilidade + guardrails da camada de IA — LÓGICA PURA (sem Deno/DB/DOM),
// para ser 100% testável (bun/deno test). Consumida pelo ai-gateway em:
//   - {action:'metrics'}  → agrega ai_audit_log / ai_jobs / automation_runs
//   - guardrail de custo   → orçamento por tenant/usuário antes de chamar o modelo
//   - alertas técnicos     → deriva alertas de saúde a partir das métricas
//
// Nada aqui escreve em dados de negócio. Preços são estimativas de custo (USD)
// só para observabilidade — não são cobrança.

export interface AuditRow {
  tipo: string; // 'run' | 'tool_call'
  ok?: boolean | null;
  erro?: string | null;
  latencia_ms?: number | null;
  tokens?: number | null;
  tokens_in?: number | null;
  tokens_out?: number | null;
  custo_usd?: number | null;
  modelo?: string | null;
  tool?: string | null;
}

// Preços de referência (USD por 1M tokens) por prefixo de modelo. Fonte: tabela
// pública de modelos Claude. Fallback = sonnet (modelo padrão do gateway).
export const MODEL_PRICES: Record<string, { in: number; out: number }> = {
  "claude-opus": { in: 5, out: 25 },
  "claude-sonnet": { in: 3, out: 15 },
  "claude-haiku": { in: 1, out: 5 },
  "claude-fable": { in: 10, out: 50 },
};

export function priceFor(model?: string | null): { in: number; out: number } {
  const m = (model ?? "").toLowerCase();
  for (const k of Object.keys(MODEL_PRICES)) if (m.startsWith(k)) return MODEL_PRICES[k];
  return MODEL_PRICES["claude-sonnet"];
}

// custo estimado (USD) de um par de tokens in/out para um modelo.
export function estimateCostUsd(model: string | null | undefined, tokensIn: number, tokensOut: number): number {
  const p = priceFor(model);
  const ti = Math.max(0, +tokensIn || 0), to = Math.max(0, +tokensOut || 0);
  return (ti / 1e6) * p.in + (to / 1e6) * p.out;
}

// custo de UMA linha de auditoria, tolerante ao schema:
//  1) usa custo_usd se já gravado;
//  2) senão usa tokens_in/tokens_out (split real);
//  3) senão estima a partir de `tokens` com um split heurístico input-pesado (70/30).
export function rowCostUsd(r: AuditRow): number {
  if (r.custo_usd != null && isFinite(+r.custo_usd)) return Math.max(0, +r.custo_usd);
  const hasSplit = r.tokens_in != null || r.tokens_out != null;
  if (hasSplit) return estimateCostUsd(r.modelo, +r.tokens_in! || 0, +r.tokens_out! || 0);
  const t = Math.max(0, +r.tokens! || 0);
  return estimateCostUsd(r.modelo, t * 0.7, t * 0.3);
}

export function percentile(values: number[], p: number): number {
  const v = values.filter((x) => typeof x === "number" && isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return 0;
  const idx = Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1));
  return v[idx];
}

export interface AuditSummary {
  runsTotal: number; runsOk: number; runsFail: number;
  successRate: number; errorRate: number; // 0..1
  latAvgMs: number; latP95Ms: number;
  tokensTotal: number; tokensIn: number; tokensOut: number;
  costUsd: number;
  toolCalls: number; toolFail: number;
  toolTop: Array<{ tool: string; fail: number }>; // ferramentas que mais falham
}

// Agrega uma janela de linhas de ai_audit_log (runs + tool_calls).
export function summarizeAudit(rows: AuditRow[]): AuditSummary {
  const runs = rows.filter((r) => r.tipo === "run");
  const tools = rows.filter((r) => r.tipo === "tool_call");
  const runsOk = runs.filter((r) => r.ok !== false).length;
  const runsFail = runs.length - runsOk;
  const lats = runs.map((r) => +r.latencia_ms! || 0).filter((x) => x > 0);
  const latAvg = lats.length ? lats.reduce((a, b) => a + b, 0) / lats.length : 0;

  let tokensTotal = 0, tokensIn = 0, tokensOut = 0, costUsd = 0;
  for (const r of runs) {
    tokensTotal += Math.max(0, +r.tokens! || 0);
    tokensIn += Math.max(0, +r.tokens_in! || 0);
    tokensOut += Math.max(0, +r.tokens_out! || 0);
    costUsd += rowCostUsd(r);
  }

  const failByTool = new Map<string, number>();
  let toolFail = 0;
  for (const t of tools) {
    if (t.ok === false) {
      toolFail++;
      const k = t.tool ?? "(sem nome)";
      failByTool.set(k, (failByTool.get(k) ?? 0) + 1);
    }
  }
  const toolTop = [...failByTool.entries()]
    .map(([tool, fail]) => ({ tool, fail }))
    .sort((a, b) => b.fail - a.fail)
    .slice(0, 5);

  return {
    runsTotal: runs.length, runsOk, runsFail,
    successRate: runs.length ? runsOk / runs.length : 1,
    errorRate: runs.length ? runsFail / runs.length : 0,
    latAvgMs: Math.round(latAvg), latP95Ms: percentile(lats, 95),
    tokensTotal, tokensIn, tokensOut,
    costUsd: +costUsd.toFixed(4),
    toolCalls: tools.length, toolFail, toolTop,
  };
}

// ---- guardrail de custo (orçamento por tenant/usuário) ----
export interface BudgetStatus { limit: number; used: number; remaining: number; pct: number; ok: boolean; }

// status de um orçamento (tokens/dia). limit<=0 significa "sem limite".
export function budgetStatus(usedTokens: number, limitTokens: number): BudgetStatus {
  const used = Math.max(0, +usedTokens || 0);
  const limit = Math.max(0, +limitTokens || 0);
  if (limit <= 0) return { limit: 0, used, remaining: Infinity, pct: 0, ok: true };
  const remaining = Math.max(0, limit - used);
  return { limit, used, remaining, pct: Math.min(1, used / limit), ok: used < limit };
}

// decisão do guardrail: bloqueia quando o tenant OU o usuário estourou o teto do dia.
export function costGuard(
  usedTenant: number, limitTenant: number,
  usedUser: number, limitUser: number,
): { allow: boolean; motivo: string | null; escopo: string | null } {
  const t = budgetStatus(usedTenant, limitTenant);
  if (!t.ok) return { allow: false, motivo: "limite diário da organização atingido", escopo: "tenant" };
  const u = budgetStatus(usedUser, limitUser);
  if (!u.ok) return { allow: false, motivo: "limite diário do usuário atingido", escopo: "user" };
  return { allow: true, motivo: null, escopo: null };
}

// ---- alertas técnicos (derivados das métricas) ----
export interface TechThresholds {
  errorRate: number;   // ex.: 0.20 → 20% de runs com erro
  latP95Ms: number;    // ex.: 20000
  toolFail: number;    // nº de tool failures na janela
  queueFail: number;   // nº de jobs com erro
  autoFail: number;    // nº de automation_runs com erro
  costUsd: number;     // custo da janela acima do qual alerta
  budgetPct: number;   // ex.: 0.8 → 80% do orçamento consumido
}
export const DEFAULT_THRESHOLDS: TechThresholds = {
  errorRate: 0.2, latP95Ms: 20_000, toolFail: 3, queueFail: 1, autoFail: 1, costUsd: 5, budgetPct: 0.8,
};

export interface TechAlert { code: string; nivel: "info" | "aviso" | "critico"; titulo: string; detalhe: string; }

export interface HealthInput {
  anthropicConfigured: boolean;
  summary: AuditSummary;
  queueFail: number;
  autoFail: number;
  budget?: BudgetStatus | null;
}

// Deriva alertas técnicos. NÃO grava nada — só classifica (o painel decide exibir).
export function deriveTechnicalAlerts(h: HealthInput, thr: TechThresholds = DEFAULT_THRESHOLDS): TechAlert[] {
  const out: TechAlert[] = [];
  if (!h.anthropicConfigured) {
    out.push({ code: "model_unconfigured", nivel: "critico", titulo: "Modelo de IA não configurado", detalhe: "ANTHROPIC_API_KEY ausente — o Copiloto não responde." });
  }
  const s = h.summary;
  if (s.runsTotal >= 5 && s.errorRate >= thr.errorRate) {
    out.push({ code: "high_error_rate", nivel: "critico", titulo: "Taxa de erro alta", detalhe: `${Math.round(s.errorRate * 100)}% dos turnos falharam na janela.` });
  }
  if (s.latP95Ms >= thr.latP95Ms) {
    out.push({ code: "high_latency", nivel: "aviso", titulo: "Latência alta", detalhe: `p95 de ${(s.latP95Ms / 1000).toFixed(1)}s por turno.` });
  }
  if (s.toolFail >= thr.toolFail) {
    const top = s.toolTop[0];
    out.push({ code: "tool_failures", nivel: "aviso", titulo: "Falhas em ferramentas", detalhe: `${s.toolFail} falhas de tool${top ? ` (maior: ${top.tool})` : ""}.` });
  }
  if (h.queueFail >= thr.queueFail) {
    out.push({ code: "queue_failures", nivel: "aviso", titulo: "Falhas na fila", detalhe: `${h.queueFail} job(s) da fila em erro.` });
  }
  if (h.autoFail >= thr.autoFail) {
    out.push({ code: "automation_failures", nivel: "aviso", titulo: "Falhas em automações", detalhe: `${h.autoFail} execução(ões) de automação em erro.` });
  }
  if (s.costUsd >= thr.costUsd) {
    out.push({ code: "cost_spike", nivel: "aviso", titulo: "Custo elevado na janela", detalhe: `US$ ${s.costUsd.toFixed(2)} estimados na janela.` });
  }
  if (h.budget && h.budget.limit > 0 && h.budget.pct >= thr.budgetPct) {
    out.push({ code: "budget_near_limit", nivel: h.budget.ok ? "aviso" : "critico", titulo: "Orçamento de tokens perto do limite", detalhe: `${Math.round(h.budget.pct * 100)}% do teto diário consumido.` });
  }
  if (!out.length) out.push({ code: "healthy", nivel: "info", titulo: "Tudo saudável", detalhe: "Nenhum alerta técnico na janela." });
  return out;
}
