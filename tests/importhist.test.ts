// Testes de HISTÓRICO / ROLLBACK seguro (puro).
// Extrai o bloco <import-hist> do index.html.
// Rodar: bun test tests/importhist.test.ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const A = html.indexOf("// <import-hist>");
const B = html.indexOf("// </import-hist>");
if (A < 0 || B < 0) throw new Error("marcadores <import-hist> não encontrados");
// deno-lint-ignore no-explicit-any
const H: any = (0, eval)(html.slice(A, B) + "\nImportHist");

test("pertence: casa por importBatchId, replicationGroupId ou rateioGroupId", () => {
  expect(H.pertence({ importBatchId: "b1" }, "b1")).toBe(true);
  expect(H.pertence({ replicationGroupId: "b1" }, "b1")).toBe(true);
  expect(H.pertence({ rateioGroupId: "b1" }, "b1")).toBe(true);
  expect(H.pertence({ importBatchId: "b2" }, "b1")).toBe(false);
  expect(H.pertence(null, "b1")).toBe(false);
});

test("particionar: remove só o que o lote criou e NÃO foi editado", () => {
  const recs = [
    { id: 1, importBatchId: "b1" },                       // criado pelo lote, intacto → remover
    { id: 2, importBatchId: "b1", atualizadoEm: "2026-08-16" }, // editado depois → manter
    { id: 3, importBatchId: "b2" },                       // outro lote → ignora
    { id: 4 },                                            // manual → ignora
  ];
  const p = H.particionar(recs, "b1");
  expect(p.remover.map((r: any) => r.id)).toEqual([1]);
  expect(p.manter.map((r: any) => r.id)).toEqual([2]);
});

test("particionar: lote sem registros intactos → remover vazio (nada a desfazer)", () => {
  const recs = [{ id: 1, importBatchId: "b1", atualizadoEm: "x" }];
  const p = H.particionar(recs, "b1");
  expect(p.remover.length).toBe(0);
  expect(p.manter.length).toBe(1);
});

test("kpis: soma importados, duplicidades evitadas (existentes+possiveis), erros; conta hoje", () => {
  const batches = [
    { quando: "2026-08-15T10:00:00Z", importados: 431, existentes: 32, possiveis: 11, erros: 6 },
    { quando: "2026-08-14T09:00:00Z", importados: 10, existentes: 0, possiveis: 2, erros: 1 },
  ];
  const k = H.kpis(batches, "2026-08-15T23:00:00Z");
  expect(k.total).toBe(2);
  expect(k.hoje).toBe(1); // só o de 15/08
  expect(k.importados).toBe(441);
  expect(k.evitadas).toBe(45); // 32+11 + 0+2
  expect(k.erros).toBe(7);
});

test("kpis: lista vazia → zeros", () => {
  const k = H.kpis([], "2026-08-15");
  expect(k).toEqual({ hoje: 0, importados: 0, evitadas: 0, erros: 0, total: 0 });
});
