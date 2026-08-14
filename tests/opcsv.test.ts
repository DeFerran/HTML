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
// deno-lint-ignore no-explicit-any
const opParseCsv: any = (0, eval)(html.slice(A, B) + "\nopParseCsv");
// deno-lint-ignore no-explicit-any
const opNum: any = (0, eval)(html.slice(A, B) + "\nopNum");

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

test("opParseCsv: cabeçalho → objetos; ignora linhas vazias e BOM", () => {
  const { headers, rows } = opParseCsv("﻿Data;Cliente\r\n2026-08-11;Casari\r\n;\r\n2026-08-12;Progresso");
  expect(headers).toEqual(["Data", "Cliente"]);
  expect(rows).toHaveLength(2); // linha vazia descartada
  expect(rows[0]).toEqual({ Data: "2026-08-11", Cliente: "Casari" });
  expect(rows[1].Cliente).toBe("Progresso");
});

test("opParseCsv: campos com aspas, ';' e quebra de linha internos", () => {
  const { rows } = opParseCsv('A;B\r\n"x;y";"linha1\nlinha2"');
  expect(rows[0].A).toBe("x;y");
  expect(rows[0].B).toBe("linha1\nlinha2");
});

test("opNum: preserva decimais do próprio Exportar (número cru '1234.5')", () => {
  expect(opNum("1234.5")).toBe(1234.5);   // bug antigo /[^\d]/g virava 12345
  expect(opNum("500")).toBe(500);
  expect(opNum(320)).toBe(320);
});

test("opNum: aceita formato digitado pt-BR (milhar '.' + decimal ',')", () => {
  expect(opNum("1.234,5")).toBe(1234.5);
  expect(opNum("1.000")).toBe(1);         // convenção pt-BR do app (ponto=decimal quando só há ponto)
  expect(opNum("2,75")).toBe(2.75);
  expect(opNum("R$ 47,50")).toBe(47.5);
});

test("opNum: vazio/'-'/inválido → '' (preserva 'a validar', não vira 0)", () => {
  expect(opNum("")).toBe("");
  expect(opNum("   ")).toBe("");
  expect(opNum("-")).toBe("");
  expect(opNum(null)).toBe("");
  expect(opNum(undefined)).toBe("");
  expect(opNum("abc")).toBe("");
});

test("round-trip: opParseCsv(opToCsv(...)) preserva os dados", () => {
  const matrix = [["Data", "Colaboradores/Pontos"], ["2026-08-11", "Deivison: 27 | Emanuel: 20"]];
  const { rows } = opParseCsv(opToCsv(matrix));
  expect(rows[0]["Data"]).toBe("2026-08-11");
  expect(rows[0]["Colaboradores/Pontos"]).toBe("Deivison: 27 | Emanuel: 20");
});
