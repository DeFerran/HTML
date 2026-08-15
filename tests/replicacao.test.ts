// Testes do núcleo de REPLICAÇÃO em lote (puro).
// Extrai o bloco <replicacao> do index.html.
// Rodar: bun test tests/replicacao.test.ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const A = html.indexOf("// <replicacao>");
const B = html.indexOf("// </replicacao>");
if (A < 0 || B < 0) throw new Error("marcadores <replicacao> não encontrados");
// deno-lint-ignore no-explicit-any
const R: any = (0, eval)(html.slice(A, B) + "\nReplicacao");

const BASE = { data: "2026-08-15", descricao: "Análise de solo", valor: 1000, categoria: "Laboratório" };
const CAMPOS = { data: true, descricao: true, valor: true, categoria: true };

test("REPLICAR multiplica: R$1.000 × 3 destinos = 3 lançamentos, total R$3.000", () => {
  const recs = R.planejar(BASE, CAMPOS, ["Cliente A", "Cliente B", "Cliente C"], {}, "cliente");
  expect(recs.length).toBe(3);
  recs.forEach((x: any) => { expect(x.valor).toBe(1000); expect(x.descricao).toBe("Análise de solo"); });
  expect(recs.map((x: any) => x.cliente)).toEqual(["Cliente A", "Cliente B", "Cliente C"]);
  expect(R.total(recs)).toBe(3000); // NUNCA vira R$1.000 (isso seria rateio)
});

test("destino é gravado no campo correto (cliente)", () => {
  const recs = R.planejar(BASE, CAMPOS, ["Cliente A"], {}, "cliente");
  expect(recs[0].cliente).toBe("Cliente A");
});

test("valor diferente por destino (ajuste individual)", () => {
  const recs = R.planejar(BASE, CAMPOS, ["A", "B", "C"], { A: { valor: 1000 }, B: { valor: 1200 }, C: { valor: 950 } }, "cliente");
  expect(recs.map((x: any) => x.valor)).toEqual([1000, 1200, 950]);
  expect(R.total(recs)).toBe(3150);
});

test("campo não marcado NÃO é copiado", () => {
  const recs = R.planejar({ ...BASE, obs: "segredo" }, { ...CAMPOS, obs: false }, ["A"], {}, "cliente");
  expect(recs[0].obs).toBeUndefined();
  expect(recs[0].descricao).toBe("Análise de solo");
});

test("1 destino", () => {
  expect(R.planejar(BASE, CAMPOS, ["Único"], {}, "cliente").length).toBe(1);
});

test("10 destinos", () => {
  const dez = Array.from({ length: 10 }, (_, i) => "C" + i);
  const recs = R.planejar(BASE, CAMPOS, dez, {}, "cliente");
  expect(recs.length).toBe(10);
  expect(R.total(recs)).toBe(10000);
});

test("100 destinos — reconciliação: nº de destinos == nº criado", () => {
  const cem = Array.from({ length: 100 }, (_, i) => "C" + i);
  const recs = R.planejar(BASE, CAMPOS, cem, {}, "cliente");
  expect(recs.length).toBe(cem.length);
  expect(R.total(recs)).toBe(100 * 1000);
});

test("zero destinos → nada criado", () => {
  expect(R.planejar(BASE, CAMPOS, [], {}, "cliente").length).toBe(0);
  expect(R.total([])).toBe(0);
});
