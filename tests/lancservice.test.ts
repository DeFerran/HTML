// Testes do SERVIÇO CENTRAL DE LANÇAMENTOS (núcleo puro).
// Extrai o bloco `// <lanc-service> ... // </lanc-service>` do index.html.
// Rodar: bun test tests/lancservice.test.ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const A = html.indexOf("// <lanc-service>");
const B = html.indexOf("// </lanc-service>");
if (A < 0 || B < 0) throw new Error("marcadores <lanc-service> não encontrados");
// deno-lint-ignore no-explicit-any
const L: any = (0, eval)(html.slice(A, B) + "\nLancService");

test("normalizar despesa: valor vira número arredondado (2 casas)", () => {
  const r = L.normalizar({ valor: "1234.567" }, "despesa", {});
  expect(r.valor).toBe(1234.57);
});

test("normalizar despesa: competência deriva da data (YYYY-MM)", () => {
  const r = L.normalizar({ valor: 10, data: "2026-08-15" }, "despesa", {});
  expect(r.competencia).toBe("2026-08");
});

test("normalizar despesa: sem data usa hojeYM do contexto", () => {
  const r = L.normalizar({ valor: 10 }, "despesa", { hojeYM: "2026-08" });
  expect(r.competencia).toBe("2026-08");
});

test("normalizar despesa: competência informada não é sobrescrita", () => {
  const r = L.normalizar({ valor: 10, data: "2026-08-15", competencia: "2026-01" }, "despesa", {});
  expect(r.competencia).toBe("2026-01");
});

test("validar despesa: valor > 0 passa", () => {
  const v = L.validar({ valor: 100 }, "despesa");
  expect(v.ok).toBe(true);
  expect(v.erros).toEqual([]);
});

test("validar despesa: valor <= 0 falha e aponta o campo", () => {
  const v0 = L.validar({ valor: 0 }, "despesa");
  expect(v0.ok).toBe(false);
  expect(v0.campo).toBe("valor");
  expect(v0.erros.length).toBe(1);
  expect(L.validar({ valor: -5 }, "despesa").ok).toBe(false);
  expect(L.validar({}, "despesa").ok).toBe(false);
});

test("fingerprint despesa: canônico, estável e case-insensitive", () => {
  const a = L.fingerprint({ data: "2026-08-15", valor: 1000, cliente: "Danilo Ferrarezi", categoria: "Laboratório", descricao: "Análise de solo" }, "despesa");
  const b = L.fingerprint({ data: "2026-08-15", valor: 1000, cliente: "danilo ferrarezi", categoria: "laboratório", descricao: "ANÁLISE DE SOLO" }, "despesa");
  expect(a).toBe(b); // mesma despesa, capitalização diferente → mesmo fingerprint
});

test("fingerprint despesa: valor diferente → fingerprint diferente", () => {
  const a = L.fingerprint({ data: "2026-08-15", valor: 1000, cliente: "A", categoria: "Lab", descricao: "x" }, "despesa");
  const b = L.fingerprint({ data: "2026-08-15", valor: 1001, cliente: "A", categoria: "Lab", descricao: "x" }, "despesa");
  expect(a).not.toBe(b);
});

test("fingerprint despesa: duas despesas legítimas iguais têm o MESMO fingerprint (só marca 'possível', não apaga)", () => {
  // duas diárias de campo idênticas no mesmo dia são possíveis e legítimas
  const a = L.fingerprint({ data: "2026-08-15", valor: 200, cliente: "A", categoria: "Combustível", descricao: "Diesel" }, "despesa");
  const b = L.fingerprint({ data: "2026-08-15", valor: 200, cliente: "A", categoria: "Combustível", descricao: "Diesel" }, "despesa");
  expect(a).toBe(b); // igualdade de fingerprint é sinal de ATENÇÃO, não de exclusão automática
});

test("tipo registrado: despesa existe e aponta para D.lancamentos", () => {
  expect(L.TIPOS.despesa).toBeTruthy();
  expect(L.TIPOS.despesa.array).toBe("lancamentos");
});

test("tipo desconhecido: normalizar/validar/fingerprint são passthrough seguros", () => {
  const rec = { valor: 10 };
  expect(L.normalizar(rec, "inexistente", {})).toBe(rec); // devolve o mesmo objeto
  expect(L.validar(rec, "inexistente").ok).toBe(true);
  expect(L.fingerprint(rec, "inexistente")).toBe("");
});
