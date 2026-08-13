// Testes da lógica de automação (bun test).
// Rodar: bun test supabase/functions/ai-worker/automation_logic.test.ts

import { expect, test } from "bun:test";
import {
  buildDailySummary,
  dedupeManual,
  dedupeSchedule,
  evaluateCondition,
  isScheduleDue,
  retryDelaySeconds,
  shouldRetry,
} from "./automation_logic.ts";

test("condition vazio => sempre true", () => {
  expect(evaluateCondition({}, { x: 1 })).toBe(true);
  expect(evaluateCondition(null, {})).toBe(true);
});

test("condition numérica e textual", () => {
  expect(evaluateCondition({ campo: "receita", op: ">", valor: 100 }, { receita: 150 })).toBe(true);
  expect(evaluateCondition({ campo: "receita", op: ">", valor: 100 }, { receita: 50 })).toBe(false);
  expect(evaluateCondition({ campo: "safra", op: "==", valor: "26/27" }, { safra: "26/27" })).toBe(true);
  expect(evaluateCondition({ campo: "nome", op: "contains", valor: "boa" }, { nome: "Fazenda Boa Vista" })).toBe(true);
});

test("retry controlado: para no máximo", () => {
  expect(shouldRetry(0, 3)).toBe(true);
  expect(shouldRetry(2, 3)).toBe(true);
  expect(shouldRetry(3, 3)).toBe(false);
});

test("backoff exponencial com teto", () => {
  expect(retryDelaySeconds(1)).toBe(30);
  expect(retryDelaySeconds(2)).toBe(60);
  expect(retryDelaySeconds(3)).toBe(120);
  expect(retryDelaySeconds(20)).toBe(900); // teto
});

test("dedupe estável (idempotência) — mesma chave lógica dá mesma string", () => {
  expect(dedupeManual("r1", "2026-08-13T10:00")).toBe("manual:r1:2026-08-13T10:00");
  expect(dedupeManual("r1", "b")).toBe(dedupeManual("r1", "b"));
  expect(dedupeSchedule("r1", "2026-08-13")).toBe("schedule:r1:2026-08-13");
});

test("schedule diário: due só uma vez por dia", () => {
  const now = "2026-08-13T09:00:00.000Z";
  expect(isScheduleDue({ frequencia: "daily" }, null, now)).toBe(true); // nunca rodou
  expect(isScheduleDue({ frequencia: "daily" }, "2026-08-12T23:00:00Z", now)).toBe(true); // ontem
  expect(isScheduleDue({ frequencia: "daily" }, "2026-08-13T01:00:00Z", now)).toBe(false); // já rodou hoje
});

test("buildDailySummary: só resumo interno, sem inventar", () => {
  const s = buildDailySummary({ safra: "26/27", clientes: 26, receita: 900000, custo: 400000, docsIndexados: 2, memoriasValidadas: 3 });
  expect(s).toContain("Resumo AP — safra 26/27");
  expect(s).toContain("Clientes na carteira: 26");
  expect(s).toContain("Margem estimada");
  expect(s).toContain("não é recomendação nem ação financeira");
});
