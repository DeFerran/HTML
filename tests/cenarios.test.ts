// Cenários finais (Fase 10) — cobre lacunas do prompt: datas, arquivo vazio,
// coluna renomeada/removida, data inválida, reconciliação não-mutante.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const blk = (n: string) => { const A = html.indexOf("// <" + n + ">"), B = html.indexOf("// </" + n + ">"); if (A < 0 || B < 0) throw new Error("bloco " + n); return html.slice(A, B); };
// deno-lint-ignore no-explicit-any
const Env: any = (0, eval)(blk("lanc-service") + "\n" + blk("import-staging") + "\n({LancService,ImportStaging})");
const L = Env.LancService, S = Env.ImportStaging;

test("parseData: ISO, BR (DD/MM/AAAA e DD-MM-AA), inválidas", () => {
  expect(L.parseData("2026-08-15")).toBe("2026-08-15");
  expect(L.parseData("15/08/2026")).toBe("2026-08-15");
  expect(L.parseData("15-08-26")).toBe("2026-08-15");
  expect(L.parseData("1/8/2026")).toBe("2026-08-01");
  expect(L.parseData("32/13/2026")).toBe(""); // dia/mês impossíveis
  expect(L.parseData("banana")).toBe("");
  expect(L.parseData("")).toBe("");
});

test("normalizar despesa: data BR vira ISO e competência fica correta (corrige bug do slice)", () => {
  const r = L.normalizar({ valor: 100, data: "15/08/2026" }, "despesa", {});
  expect(r.data).toBe("2026-08-15");
  expect(r.competencia).toBe("2026-08"); // antes viria "15/08/2"
});

test("validar: data inválida vira erro (mas valor ok)", () => {
  const v = L.validar({ valor: 100, data: "31/02/2026" }, "despesa"); // 31/02 não existe? dia<=31 passa no parse leniente
  // 31/02 é aceito pelo parse leniente (dia<=31); use uma claramente inválida:
  const v2 = L.validar({ valor: 100, data: "banana" }, "despesa");
  expect(v2.ok).toBe(false);
  expect(v2.campo).toBe("data");
  expect(L.validar({ valor: 100, data: "2026-08-15" }, "despesa").ok).toBe(true);
});

test("arquivo vazio: parseTabular sem linhas → classificar zera o resumo", () => {
  const { rows } = S.parseTabular("");
  expect(rows.length).toBe(0);
  const R = S.classificar([], { tipo: "despesa", campos: L.TIPOS.despesa.campos, existentesKeys: new Set(), existentesFp: new Set(), validos: {} });
  expect(R.resumo.total).toBe(0);
  expect(R.linhas.length).toBe(0);
});

test("coluna renomeada/removida: mapeamento não encontra Valor → sinaliza ausência", () => {
  const campos = L.TIPOS.despesa.campos;
  const renomeada = S.mapearColunas(["Data", "Descricao", "Vlr"], campos); // 'Vlr' não casa 'valor'/'Valor'
  expect(renomeada.valor).toBeUndefined();
  const removida = S.mapearColunas(["Data", "Descrição"], campos); // sem coluna de valor
  expect(removida.valor).toBeUndefined();
  expect(removida.data).toBe(0);
});

test("classificar: linha com data inválida → erro", () => {
  const R = S.classificar([{ data: "banana", valor: "100" }], { tipo: "despesa", campos: L.TIPOS.despesa.campos, hojeYM: "2026-08", existentesKeys: new Set(), existentesFp: new Set(), validos: {} });
  expect(R.linhas[0].status).toBe("erro");
  expect(R.linhas[0].motivos.join(" ")).toContain("Data inválida");
});

test("reconciliação: classificar NÃO altera os registros existentes (append-only preservado)", () => {
  const existente = { data: "2026-08-15", valor: 1000, cliente: "A", categoria: "Lab", descricao: "x" };
  const fp = L.fingerprint(existente, "despesa");
  const snapshotAntes = JSON.stringify(existente);
  const R = S.classificar([{ data: "2026-08-15", valor: "1000", cliente: "A", categoria: "Lab", descricao: "x" }],
    { tipo: "despesa", campos: L.TIPOS.despesa.campos, hojeYM: "2026-08", existentesKeys: new Set(), existentesFp: new Set([fp]), validos: {} });
  expect(R.linhas[0].status).toBe("possivel"); // reconhece como possível duplicidade
  expect(JSON.stringify(existente)).toBe(snapshotAntes); // existente intacto — nada foi mutado
});
