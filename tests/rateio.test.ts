// Testes do núcleo de RATEIO (puro). Σpartes === total original.
// Extrai o bloco <rateio> do index.html.
// Rodar: bun test tests/rateio.test.ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const A = html.indexOf("// <rateio>");
const B = html.indexOf("// </rateio>");
if (A < 0 || B < 0) throw new Error("marcadores <rateio> não encontrados");
// deno-lint-ignore no-explicit-any
const R: any = (0, eval)(html.slice(A, B) + "\nRateio");

const soma = (r: any) => Math.round(r.partes.reduce((a: number, p: any) => a + p.valor, 0) * 100) / 100;

test("dividir igual: 1000 em 3 → Σ = 1000 (última absorve resíduo)", () => {
  const r = R.distribuir(1000, [{ nome: "A" }, { nome: "B" }, { nome: "C" }], "igual");
  expect(r.ok).toBe(true);
  expect(r.partes.map((p: any) => p.valor)).toEqual([333.33, 333.33, 333.34]);
  expect(soma(r)).toBe(1000); // NUNCA 3000 (isso seria replicação)
});

test("por percentual 40/30/30 = 100% → 400/300/300, Σ=1000", () => {
  const r = R.distribuir(1000, [{ nome: "A", pct: 40 }, { nome: "B", pct: 30 }, { nome: "C", pct: 30 }], "percentual");
  expect(r.ok).toBe(true);
  expect(r.partes.map((p: any) => p.valor)).toEqual([400, 300, 300]);
  expect(soma(r)).toBe(1000);
});

test("percentual 99,99% → reconciliação FALHA", () => {
  const r = R.distribuir(1000, [{ nome: "A", pct: 33.33 }, { nome: "B", pct: 33.33 }, { nome: "C", pct: 33.33 }], "percentual");
  expect(r.ok).toBe(false);
  expect(r.motivo).toContain("100%");
});

test("percentual 100,01% → reconciliação FALHA", () => {
  const r = R.distribuir(1000, [{ nome: "A", pct: 50 }, { nome: "B", pct: 50.01 }], "percentual");
  expect(r.ok).toBe(false);
});

test("por valor exato → OK; soma diferente → FALHA", () => {
  const ok = R.distribuir(1000, [{ nome: "A", valor: 400 }, { nome: "B", valor: 600 }], "valor");
  expect(ok.ok).toBe(true);
  expect(soma(ok)).toBe(1000);
  const bad = R.distribuir(1000, [{ nome: "A", valor: 400 }, { nome: "B", valor: 300 }], "valor"); // soma 700
  expect(bad.ok).toBe(false);
  expect(bad.motivo).toContain("diferença");
});

test("por hectare: 100/50/50 ha de 1000 → 500/250/250", () => {
  const r = R.distribuir(1000, [{ nome: "A", ha: 100 }, { nome: "B", ha: 50 }, { nome: "C", ha: 50 }], "hectare");
  expect(r.ok).toBe(true);
  expect(r.partes.map((p: any) => p.valor)).toEqual([500, 250, 250]);
  expect(soma(r)).toBe(1000);
});

test("hectare sem áreas (Σha=0) → FALHA", () => {
  const r = R.distribuir(1000, [{ nome: "A", ha: 0 }, { nome: "B", ha: 0 }], "hectare");
  expect(r.ok).toBe(false);
});

test("arredondamento: 100 em 3 iguais → Σ exatamente 100", () => {
  const r = R.distribuir(100, [{ nome: "A" }, { nome: "B" }, { nome: "C" }], "igual");
  expect(soma(r)).toBe(100);
  expect(r.partes[2].valor).toBe(33.34); // última absorve o centavo
});

test("zero destinos → FALHA", () => {
  const r = R.distribuir(1000, [], "igual");
  expect(r.ok).toBe(false);
});

test("um destino leva 100%", () => {
  const r = R.distribuir(1000, [{ nome: "A" }], "igual");
  expect(r.ok).toBe(true);
  expect(r.partes[0].valor).toBe(1000);
});
