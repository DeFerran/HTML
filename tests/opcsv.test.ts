// Testes do gerador de CSV do Controle Operacional (bloco // <op-csv>).
// Rodar: bun test tests/opcsv.test.ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const A = html.indexOf("// <op-csv>");
const B = html.indexOf("// </op-csv>");
if (A < 0 || B < 0) throw new Error("marcadores <op-csv> não encontrados");
// deno-lint-ignore no-explicit-any
const opToCsv: any = (0, eval)(html.slice(A, B) + "\nopToCsv");

test("separador ';' e linhas com CRLF", () => {
  expect(opToCsv([["a", "b"], ["1", "2"]])).toBe("a;b\r\n1;2");
});

test("escapa aspas, ponto-e-vírgula e quebras de linha", () => {
  expect(opToCsv([["diz \"oi\""]])).toBe('"diz ""oi"""');
  expect(opToCsv([["a;b"]])).toBe('"a;b"');
  expect(opToCsv([["linha1\nlinha2"]])).toBe('"linha1\nlinha2"');
});

test("células nulas/indefinidas viram vazio; números viram texto", () => {
  expect(opToCsv([[null, undefined, 0, 47]])).toBe(";;0;47");
});

test("matriz vazia → string vazia", () => {
  expect(opToCsv([])).toBe("");
});
