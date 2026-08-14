// Formatadores BRL / BRLk / PCT à prova de divisão por zero.
// Quando a base é 0 (ex.: x/receita com receita 0), o resultado NaN/Infinity
// não pode aparecer como "R$ NaN" ou "Infinity%" na tela.
// Rodar: bun test tests/formatadores.test.ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
function pick(name: string) {
  const re = new RegExp("const " + name + " = [^\\n]+;");
  const m = html.match(re);
  if (!m) throw new Error("não achei " + name);
  return m[0];
}
const src = [pick("BRL"), pick("BRLk"), pick("PCT")].join("\n");
// deno-lint-ignore no-explicit-any
const BRL: any = (0, eval)(src + "\nBRL");
// deno-lint-ignore no-explicit-any
const BRLk: any = (0, eval)(src + "\nBRLk");
// deno-lint-ignore no-explicit-any
const PCT: any = (0, eval)(src + "\nPCT");

test("valores finitos não mudam de comportamento", () => {
  expect(PCT(0.25)).toBe("25,0%");
  expect(PCT(0)).toBe("0,0%");
  expect(BRLk(1_500_000)).toBe("R$ 1,50 mi");
});

test("NaN / Infinity viram 0 (nunca 'NaN'/'Infinity' na tela)", () => {
  expect(PCT(Infinity)).toBe("0,0%");     // x/0 com x>0
  expect(PCT(NaN)).toBe("0,0%");          // 0/0
  expect(PCT(-Infinity)).toBe("0,0%");
  expect(BRL(NaN)).toBe("R$ 0");
  expect(BRL(Infinity)).toBe("R$ 0");
  expect(BRLk(NaN)).toBe("R$ 0k");
  expect(BRLk(Infinity)).toBe("R$ 0k");
});
