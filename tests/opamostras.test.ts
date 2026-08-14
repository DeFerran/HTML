// Testes do cálculo puro do Controle Operacional · Tela 2 (Envio de Amostras).
// Extrai o bloco `// <op-amostras-calc> ... // </op-amostras-calc>` do index.html.
// Rodar: bun test tests/opamostras.test.ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const A = html.indexOf("// <op-amostras-calc>");
const B = html.indexOf("// </op-amostras-calc>");
if (A < 0 || B < 0) throw new Error("marcadores <op-amostras-calc> não encontrados");
// deno-lint-ignore no-explicit-any
const OP: any = (0, eval)(html.slice(A, B) + "\nOpAmostrasCalc");

const HOJE = "2026-02-20";

test("toDays / diffDias: diferença civil correta (sem TZ)", () => {
  expect(OP.diffDias("2026-02-01", "2026-02-20")).toBe(19);
  expect(OP.diffDias("2026-02-28", "2026-03-01")).toBe(1); // 2026 não bissexto
  expect(OP.diffDias("2024-02-28", "2024-03-01")).toBe(2); // 2024 bissexto
  expect(OP.diffDias("bad", "2026-01-01")).toBeNull();
});

test("situacao: recebido quando há data de resultado", () => {
  expect(OP.situacao({ dataEnvio: "2026-02-01", dataResultado: "2026-02-10" }, HOJE, 7)).toBe("recebido");
});

test("situacao: atrasado só quando prazo definido e excedido", () => {
  const r = { dataEnvio: "2026-02-01", dataResultado: "" };
  expect(OP.situacao(r, HOJE, 7)).toBe("atrasado");   // 19 dias > 7
  expect(OP.situacao(r, HOJE, 30)).toBe("aguardando"); // 19 < 30
  expect(OP.situacao(r, HOJE, null)).toBe("aguardando"); // sem prazo → nunca atrasado
});

test("diasRemessa: recebido = resultado−envio; aberto = hoje−envio", () => {
  expect(OP.diasRemessa({ dataEnvio: "2026-02-01", dataResultado: "2026-02-08" }, HOJE)).toBe(7);
  expect(OP.diasRemessa({ dataEnvio: "2026-02-10", dataResultado: "" }, HOJE)).toBe(10);
});

test("agg: contagens por situação + tempo médio dos recebidos", () => {
  const remessas = [
    { dataEnvio: "2026-02-01", dataResultado: "2026-02-08" }, // recebido, 7 dias
    { dataEnvio: "2026-02-02", dataResultado: "2026-02-11" }, // recebido, 9 dias
    { dataEnvio: "2026-02-01", dataResultado: "" },            // atrasado (>7)
    { dataEnvio: "2026-02-19", dataResultado: "" },            // aguardando (1 dia)
  ];
  const a = OP.agg(remessas, HOJE, 7);
  expect(a.total).toBe(4);
  expect(a.recebido).toBe(2);
  expect(a.atrasado).toBe(1);
  expect(a.aguardando).toBe(1);
  expect(a.tempoMedio).toBeCloseTo((7 + 9) / 2, 5);
});

test("agg: sem recebidos → tempoMedio null", () => {
  const a = OP.agg([{ dataEnvio: "2026-02-19", dataResultado: "" }], HOJE, null);
  expect(a.tempoMedio).toBeNull();
  expect(a.aguardando).toBe(1);
});

test("filtra: data, fazenda, responsável e busca (fazenda/talhão/obs)", () => {
  const remessas = [
    { dataEnvio: "2026-02-03", fazendas: ["Santa Helena", "Telles Pires"], talhoes: ["TH 01"], etiquetagem: ["Álvaro"], respEnvio: "Álvaro", obs: "" },
    { dataEnvio: "2026-02-17", fazendas: ["Iracema"], talhoes: ["TH 72"], etiquetagem: ["Deivison"], respEnvio: "Bruno", obs: "urgente" },
  ];
  expect(OP.filtra(remessas, { de: "2026-02-10" }).length).toBe(1);
  expect(OP.filtra(remessas, { fazenda: "Iracema" }).length).toBe(1);
  expect(OP.filtra(remessas, { resp: "Álvaro" }).length).toBe(1);
  expect(OP.filtra(remessas, { busca: "urgente" }).length).toBe(1);
  expect(OP.filtra(remessas, { busca: "th 01" }).length).toBe(1);
});

test("situacaoInfo mapeia rótulo + classe", () => {
  expect(OP.situacaoInfo("recebido")).toEqual({ label: "Resultado recebido", cls: "op-b-ok" });
  expect(OP.situacaoInfo("atrasado").cls).toBe("op-b-late");
  expect(OP.situacaoInfo("aguardando").cls).toBe("op-b-wait");
});
