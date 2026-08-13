// Testes do chunking (bun test).
// Rodar: bun test supabase/functions/ai-knowledge/chunking.test.ts

import { expect, test } from "bun:test";
import { chunkText, normalizeText } from "./chunking.ts";

test("normalizeText: colapsa espaços e linhas em branco, preserva parágrafos", () => {
  const t = normalizeText("a\r\n\r\n\r\n b   c \n\n\n d");
  expect(t).toBe("a\n\nb c\n\nd");
});

test("chunkText: texto vazio → nenhum chunk", () => {
  expect(chunkText("")).toEqual([]);
  expect(chunkText("   \n\n  ")).toEqual([]);
});

test("chunkText: índices sequenciais começando em 0", () => {
  // 12 parágrafos de ~40 chars → excede o piso de 200 e gera vários chunks.
  const paras = Array.from({ length: 12 }, (_, i) => `Paragrafo numero ${i} com algum texto extra.`);
  const chunks = chunkText(paras.join("\n\n"), { maxChars: 200 });
  expect(chunks.map((c) => c.idx)).toEqual(chunks.map((_, i) => i));
  expect(chunks.length).toBeGreaterThan(1);
});

test("chunkText: agrupa parágrafos curtos até o alvo", () => {
  const chunks = chunkText("aa\n\nbb\n\ncc", { maxChars: 100 });
  expect(chunks.length).toBe(1);
  expect(chunks[0].trecho).toContain("aa");
  expect(chunks[0].trecho).toContain("cc");
});

test("chunkText: parágrafo maior que o alvo é fatiado com overlap", () => {
  const big = "x".repeat(1000);
  const chunks = chunkText(big, { maxChars: 300, overlap: 50 });
  expect(chunks.length).toBeGreaterThan(1);
  // cada fatia respeita o teto.
  for (const c of chunks) expect(c.trecho.length).toBeLessThanOrEqual(300);
});

test("chunkText: determinístico (mesma entrada → mesma saída)", () => {
  const input = "Parágrafo A.\n\nParágrafo B com mais texto.\n\nParágrafo C.";
  expect(chunkText(input)).toEqual(chunkText(input));
});
