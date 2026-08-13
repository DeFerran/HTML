// Testes das regras de memória (bun test).
// Rodar: bun test supabase/functions/ai-gateway/tools/memory_rules.test.ts

import { expect, test } from "bun:test";
import {
  initialMemoryStatus,
  isCriticalMemory,
} from "./memory_rules.ts";

test("isCriticalMemory: agronomicos criticos (case-insensitive)", () => {
  expect(isCriticalMemory("recomendacao_agronomica")).toBe(true);
  expect(isCriticalMemory("Analise_Solo")).toBe(true);
  expect(isCriticalMemory("calagem")).toBe(true);
  expect(isCriticalMemory("preferencia")).toBe(false);
  expect(isCriticalMemory("")).toBe(false);
});

test("proposta da IA nunca nasce validada (mesmo tipo simples)", () => {
  expect(initialMemoryStatus("preferencia", "ia", true)).toBe("PENDING_REVIEW");
});

test("agronomico critico sempre PENDING, mesmo manual e pedindo validar", () => {
  expect(initialMemoryStatus("recomendacao_agronomica", "usuario", true)).toBe("PENDING_REVIEW");
  expect(initialMemoryStatus("calagem", "usuario", true)).toBe("PENDING_REVIEW");
});

test("manual nao-critico pode nascer VALIDATED (validacao humana)", () => {
  expect(initialMemoryStatus("preferencia", "usuario", true)).toBe("VALIDATED");
});

test("manual nao-critico sem pedir validar => PENDING", () => {
  expect(initialMemoryStatus("fato", "usuario", false)).toBe("PENDING_REVIEW");
});
