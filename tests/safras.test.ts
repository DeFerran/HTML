// Testa safraMais() — gera o rótulo da próxima/anterior safra (usado no botão
// "↦ Próxima" de Configurações e no ciclo de coleta). Função pura extraída do index.
// Rodar: bun test tests/safras.test.ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const m = html.match(/function safraMais\(label,n\)\{[\s\S]*?\n\}/) || html.match(/function safraMais\(label,n\)\{.*?\}/);
if (!m) throw new Error("safraMais não encontrada");
// deno-lint-ignore no-explicit-any
const safraMais: any = (0, eval)(m[0] + "\nsafraMais");

test("safraMais: próxima e anterior safra", () => {
  expect(safraMais("26/27", 1)).toBe("27/28");
  expect(safraMais("27/28", 1)).toBe("28/29");
  expect(safraMais("26/27", -1)).toBe("25/26");
  expect(safraMais("26/27", 0)).toBe("26/27");
});

test("safraMais: vira o século (99 → 00)", () => {
  expect(safraMais("99/00", 1)).toBe("00/01");
});

test("safraMais: rótulo inválido → vazio (não inventa)", () => {
  expect(safraMais("", 1)).toBe("");
  expect(safraMais("abc", 1)).toBe("");
  expect(safraMais(null, 1)).toBe("");
});

test("formato AA/AA aceito pela validação de nova safra", () => {
  const re = /^\d{2}\/\d{2}$/;
  expect(re.test("28/29")).toBe(true);
  expect(re.test("2/3")).toBe(false);
  expect(re.test("28-29")).toBe(false);
  expect(re.test(safraMais("27/28", 1))).toBe(true);
});
