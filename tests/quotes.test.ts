// Testes do motor puro de Orçamentos comerciais.
// Extrai o bloco `// <quote-calc> ... // </quote-calc>` do index.html.
// Rodar: bun test tests/quotes.test.ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const A = html.indexOf("// <quote-calc>");
const B = html.indexOf("// </quote-calc>");
if (A < 0 || B < 0) throw new Error("marcadores <quote-calc> não encontrados");
// deno-lint-ignore no-explicit-any
const Q: any = (0, eval)(html.slice(A, B) + "\nQuoteCalc");

test("malha → pontos", () => {
  expect(Q.pontos(1000, 3)).toBe(333); // round(1000/3)
  expect(Q.pontos(1000, 1)).toBe(1000);
  expect(Q.pontos(1000, 0)).toBe(0); // sem malha → 0 (evita divisão por zero)
  expect(Q.pontos(0, 3)).toBe(0);
});

test("pontos → amostras por profundidade", () => {
  // pontos=300, fatores 0-20=1, 0-10=0.30, 20-40=0.20
  expect(Q.amostras(300, [1, 0.3, 0.2])).toEqual([300, 90, 60]);
  expect(Q.amostrasTotal(300, [1, 0.3, 0.2])).toBe(450);
  expect(Q.amostrasTotal(300, [])).toBe(0);
});

test("quantidade por método de cobrança", () => {
  const ctx = { areaHa: 1000, pontos: 333, amostras: 450 };
  expect(Q.quantidade("ha", ctx)).toBe(1000);
  expect(Q.quantidade("ponto", ctx)).toBe(333);
  expect(Q.quantidade("amostra", ctx)).toBe(450);
  expect(Q.quantidade("fixo", ctx)).toBe(1);
  expect(Q.quantidade("pacote", ctx)).toBe(1);
  expect(Q.quantidade(undefined, ctx)).toBe(1000); // default ha
});

test("subtotal e total do item (com desconto do item)", () => {
  expect(Q.itemSubtotal(30, 1000)).toBe(30000);
  expect(Q.itemTotal(30000, 5)).toBe(28500); // 5% desconto
  expect(Q.itemTotal(30000, 0)).toBe(30000);
});

test("totais: Σitens = subtotal; subtotal − desconto geral = total", () => {
  const itens = [{ total: 28500 }, { total: 12000 }, { total: 6000 }];
  const t = Q.totais(itens, 10); // 10% desconto geral
  expect(t.subtotal).toBe(46500);
  expect(t.descontoValor).toBe(4650);
  expect(t.total).toBe(41850);
});

test("desvio vs preço de tabela", () => {
  // total negociado 28500 vs tabela 30000 → -5%
  expect(Q.desvioPct(28500, 30000)).toBeCloseTo(-0.05, 6);
  expect(Q.desvioPct(31500, 30000)).toBeCloseTo(0.05, 6);
  expect(Q.desvioPct(100, 0)).toBeNull(); // sem tabela
});

test("vencimentos determinísticos (UTC, sem drift de fuso)", () => {
  expect(Q.venc("2026-08-14", 0)).toBe("2026-08-14");
  expect(Q.venc("2026-08-14", 30)).toBe("2026-09-13");
  expect(Q.venc("2026-08-14", 60)).toBe("2026-10-13");
  expect(Q.venc("", 30)).toBe("");
});

test("parcelas: última absorve o resíduo → Σparcelas === total (sem erro de centavo)", () => {
  // total 41850 em 30/60/90 (1/3 cada) — 1/3 não é exato
  const ps = Q.parcelas(41850, [
    { pct: 1 / 3, dias: 30 },
    { pct: 1 / 3, dias: 60 },
    { pct: 1 / 3, dias: 90 },
  ], "2026-08-14");
  expect(ps.length).toBe(3);
  const soma = ps.reduce((a: number, p: { valor: number }) => a + p.valor, 0);
  expect(Math.round(soma * 100) / 100).toBe(41850);
  expect(ps[0].venc).toBe("2026-09-13");
  expect(ps[2].venc).toBe("2026-11-12");
});

test("parcelas à vista = total em uma parcela", () => {
  const ps = Q.parcelas(10000, [{ pct: 1, dias: 0 }], "2026-08-14");
  expect(ps.length).toBe(1);
  expect(ps[0].valor).toBe(10000);
});

test("reconcilia: detecta e aprova consistência ponta a ponta", () => {
  const itens = [
    { total: Q.itemTotal(Q.itemSubtotal(30, 1000), 5) }, // 28500
    { total: Q.itemTotal(Q.itemSubtotal(38, 450), 0) },  // 17100
  ];
  const t = Q.totais(itens, 0);
  const pag = { parcelas: Q.parcelas(t.total, [{ pct: 0.5, dias: 30 }, { pct: 0.5, dias: 60 }], "2026-08-14") };
  const q = { itens, subtotal: t.subtotal, descontoValor: t.descontoValor, total: t.total, pagamento: pag };
  const rec = Q.reconcilia(q);
  expect(rec.ok).toBe(true);
  expect(rec.erros).toEqual([]);
  // agora quebra o total de propósito
  const bad = { ...q, total: q.total + 100 };
  const rb = Q.reconcilia(bad);
  expect(rb.ok).toBe(false);
  expect(rb.erros.length).toBeGreaterThan(0);
});

test("caso área zero: subtotais zeram sem NaN", () => {
  expect(Q.itemSubtotal(30, Q.quantidade("ha", { areaHa: 0 }))).toBe(0);
  expect(Q.pontos(0, 3)).toBe(0);
});
