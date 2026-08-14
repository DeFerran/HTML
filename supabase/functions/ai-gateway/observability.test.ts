// Testes da observabilidade + guardrails (bun test).
// Rodar: bun test supabase/functions/ai-gateway/observability.test.ts
import { expect, test } from "bun:test";
import {
  budgetStatus,
  costGuard,
  deriveTechnicalAlerts,
  DEFAULT_THRESHOLDS,
  estimateCostUsd,
  percentile,
  priceFor,
  rowCostUsd,
  summarizeAudit,
  type AuditRow,
} from "./observability.ts";

test("priceFor: casa por prefixo e cai para sonnet no desconhecido", () => {
  expect(priceFor("claude-opus-4-8")).toEqual({ in: 5, out: 25 });
  expect(priceFor("claude-haiku-4-5")).toEqual({ in: 1, out: 5 });
  expect(priceFor("modelo-x")).toEqual({ in: 3, out: 15 });
});

test("estimateCostUsd: input+output por 1M", () => {
  // sonnet: 1M in = $3, 1M out = $15
  expect(estimateCostUsd("claude-sonnet-5", 1_000_000, 0)).toBeCloseTo(3, 6);
  expect(estimateCostUsd("claude-sonnet-5", 0, 1_000_000)).toBeCloseTo(15, 6);
  expect(estimateCostUsd("claude-opus-4-8", 1_000_000, 1_000_000)).toBeCloseTo(30, 6);
});

test("rowCostUsd: prioriza custo_usd, depois split, depois heurística", () => {
  expect(rowCostUsd({ tipo: "run", custo_usd: 0.5, tokens: 999 })).toBe(0.5);
  expect(rowCostUsd({ tipo: "run", modelo: "claude-sonnet-5", tokens_in: 1_000_000, tokens_out: 0 })).toBeCloseTo(3, 6);
  // só tokens totais → 70/30 sobre sonnet
  const c = rowCostUsd({ tipo: "run", modelo: "claude-sonnet-5", tokens: 1_000_000 });
  expect(c).toBeCloseTo(0.7 * 3 + 0.3 * 15, 6);
});

test("percentile: p95 estável", () => {
  expect(percentile([], 95)).toBe(0);
  expect(percentile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 95)).toBe(100);
  expect(percentile([5], 50)).toBe(5);
});

test("summarizeAudit: agrega runs, tokens, custo e tool failures", () => {
  const rows: AuditRow[] = [
    { tipo: "run", ok: true, latencia_ms: 1000, tokens: 100, modelo: "claude-sonnet-5" },
    { tipo: "run", ok: false, erro: "x", latencia_ms: 3000, tokens: 200, modelo: "claude-sonnet-5" },
    { tipo: "run", ok: true, latencia_ms: 2000, tokens_in: 500, tokens_out: 100, modelo: "claude-sonnet-5" },
    { tipo: "tool_call", ok: true, tool: "get_client" },
    { tipo: "tool_call", ok: false, tool: "get_costs" },
    { tipo: "tool_call", ok: false, tool: "get_costs" },
  ];
  const s = summarizeAudit(rows);
  expect(s.runsTotal).toBe(3);
  expect(s.runsOk).toBe(2);
  expect(s.runsFail).toBe(1);
  expect(s.successRate).toBeCloseTo(2 / 3, 6);
  expect(s.errorRate).toBeCloseTo(1 / 3, 6);
  expect(s.latAvgMs).toBe(2000);
  expect(s.tokensTotal).toBe(300);
  expect(s.tokensIn).toBe(500);
  expect(s.tokensOut).toBe(100);
  expect(s.toolCalls).toBe(3);
  expect(s.toolFail).toBe(2);
  expect(s.toolTop[0]).toEqual({ tool: "get_costs", fail: 2 });
  expect(s.costUsd).toBeGreaterThan(0);
});

test("summarizeAudit: sem runs → sucesso 100% e erro 0%", () => {
  const s = summarizeAudit([]);
  expect(s.successRate).toBe(1);
  expect(s.errorRate).toBe(0);
  expect(s.runsTotal).toBe(0);
});

test("budgetStatus: limite 0 = ilimitado; senão calcula pct/remaining/ok", () => {
  expect(budgetStatus(100, 0)).toMatchObject({ ok: true, remaining: Infinity });
  const b = budgetStatus(80, 100);
  expect(b.ok).toBe(true);
  expect(b.pct).toBeCloseTo(0.8, 6);
  expect(b.remaining).toBe(20);
  expect(budgetStatus(100, 100).ok).toBe(false); // atingiu o teto
  expect(budgetStatus(150, 100)).toMatchObject({ ok: false, remaining: 0, pct: 1 });
});

test("costGuard: bloqueia por tenant ou por usuário; senão libera", () => {
  expect(costGuard(50, 100, 10, 50)).toMatchObject({ allow: true, escopo: null });
  expect(costGuard(100, 100, 0, 50)).toMatchObject({ allow: false, escopo: "tenant" });
  expect(costGuard(10, 100, 50, 50)).toMatchObject({ allow: false, escopo: "user" });
  expect(costGuard(10, 0, 10, 0)).toMatchObject({ allow: true }); // ambos ilimitados
});

test("deriveTechnicalAlerts: modelo não configurado é crítico", () => {
  const a = deriveTechnicalAlerts({ anthropicConfigured: false, summary: summarizeAudit([]), queueFail: 0, autoFail: 0 });
  expect(a.some((x) => x.code === "model_unconfigured" && x.nivel === "critico")).toBe(true);
});

test("deriveTechnicalAlerts: taxa de erro alta vira crítico (com amostra >=5)", () => {
  const rows: AuditRow[] = Array.from({ length: 6 }, (_, i) => ({ tipo: "run", ok: i < 2, latencia_ms: 100 }));
  const s = summarizeAudit(rows); // 2 ok / 6 → erro 67%
  const a = deriveTechnicalAlerts({ anthropicConfigured: true, summary: s, queueFail: 0, autoFail: 0 });
  expect(a.some((x) => x.code === "high_error_rate")).toBe(true);
});

test("deriveTechnicalAlerts: fila/automação/orçamento", () => {
  const s = summarizeAudit([{ tipo: "run", ok: true, latencia_ms: 100, tokens: 10 }]);
  const a = deriveTechnicalAlerts({
    anthropicConfigured: true, summary: s, queueFail: 2, autoFail: 3,
    budget: budgetStatus(90, 100),
  });
  expect(a.some((x) => x.code === "queue_failures")).toBe(true);
  expect(a.some((x) => x.code === "automation_failures")).toBe(true);
  expect(a.some((x) => x.code === "budget_near_limit")).toBe(true);
});

test("deriveTechnicalAlerts: tudo saudável → info único", () => {
  const s = summarizeAudit([{ tipo: "run", ok: true, latencia_ms: 100, tokens: 10 }]);
  const a = deriveTechnicalAlerts({ anthropicConfigured: true, summary: s, queueFail: 0, autoFail: 0 });
  expect(a).toHaveLength(1);
  expect(a[0].code).toBe("healthy");
});

test("thresholds default expostos", () => {
  expect(DEFAULT_THRESHOLDS.errorRate).toBeGreaterThan(0);
});
