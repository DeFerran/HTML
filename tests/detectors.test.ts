// Testes dos DETECTORES PROATIVOS (bun test).
// Extrai o bloco puro `// <ai-detectors> ... // </ai-detectors>` do index.html
// (fonte única — sem duplicar lógica) e o avalia isoladamente.
// Rodar: bun test tests/detectors.test.ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const A = html.indexOf("// <ai-detectors>");
const B = html.indexOf("// </ai-detectors>");
if (A < 0 || B < 0) throw new Error("marcadores <ai-detectors> não encontrados no index.html");
const src = html.slice(A, B);
// indirect eval → escopo não-estrito; a última expressão devolve o objeto.
// deno-lint-ignore no-explicit-any
const AIDetectors: any = (0, eval)(src + "\nAIDetectors");

const CAMPOS = ["o_que", "por_que", "dados", "impacto", "confianca", "proxima_acao"];

function baseState(over: Record<string, unknown> = {}) {
  return {
    safraAtual: "26/27", safraBase: "26/27", margemAlvo: 0.3,
    clientes: [], servicos: [], etapasConcluidas: [],
    ...over,
  };
}

test("estado vazio → nenhum insight", () => {
  expect(AIDetectors.runAll(baseState())).toEqual([]);
});

test("1) nova análise de laboratório disponível (fert + coleta na safra)", () => {
  const st = baseState({ clientes: [{ nome: "Faz. A", grupo: "fert", coletaNaSafra: true, ha: 100, receita: 5000 }] });
  const r = AIDetectors.detectNovaAnalise(st);
  expect(r).toHaveLength(1);
  expect(r[0].id).toBe("nova_analise");
  // sem coleta na safra → nada
  expect(AIDetectors.detectNovaAnalise(baseState({ clientes: [{ nome: "B", grupo: "fert", coletaNaSafra: false, ha: 100 }] }))).toHaveLength(0);
});

test("2) coleta/recoleta devida (ciclo vencido)", () => {
  const st = baseState({ clientes: [{ nome: "Faz. C", grupo: "fert", coletaDevida: true, receita: 8000 }] });
  const r = AIDetectors.detectColetaAtrasada(st);
  expect(r).toHaveLength(1);
  expect(r[0].id).toBe("coleta_atrasada");
  expect(r[0].nivel).toBe("aviso");
});

test("3) etapa de coleta concluída", () => {
  const st = baseState({ etapasConcluidas: [{ etapa: "Coleta Talhão 1" }] });
  const r = AIDetectors.detectColetaConcluida(st);
  expect(r).toHaveLength(1);
  expect(r[0].id).toBe("coleta_concluida");
});

test("4) custo/ha acima do parâmetro (margem < alvo OU custo>=preço)", () => {
  const abaixoAlvo = baseState({ servicos: [{ nome: "Grid 5", custoHa: 90, precoHa: 100, margemPct: 0.1 }] });
  expect(AIDetectors.detectCustoHa(abaixoAlvo)[0].id).toBe("custo_ha_alto");
  const custoMaior = baseState({ servicos: [{ nome: "X", custoHa: 120, precoHa: 100, margemPct: 0.5 }] });
  expect(AIDetectors.detectCustoHa(custoMaior)).toHaveLength(1);
  // margem saudável e custo < preço → nada
  expect(AIDetectors.detectCustoHa(baseState({ servicos: [{ nome: "Y", custoHa: 40, precoHa: 100, margemPct: 0.6 }] }))).toHaveLength(0);
});

test("5) dado importante faltante", () => {
  const st = baseState({
    clientes: [{ nome: "Sem serviço", grupo: "coleta", servico: "", vendedor: "João" },
      { nome: "Sem vend", grupo: "fert", servico: "Grid 3", vendedor: "A definir", cicloColeta: 2 }],
    servicos: [{ nome: "Serv sem área", ha: 0 }],
  });
  const r = AIDetectors.detectDadoFaltante(st);
  expect(r).toHaveLength(1);
  expect(r[0].id).toBe("dado_faltante");
  expect(r[0].confianca).toBeGreaterThan(0.9);
});

test("todo insight traz os 6 campos obrigatórios + confiança 0..1", () => {
  const st = baseState({
    clientes: [{ nome: "A", grupo: "fert", coletaNaSafra: true, ha: 50, receita: 100, servico: "Grid 2", vendedor: "A definir", cicloColeta: 0, coletaDevida: true }],
    servicos: [{ nome: "S", custoHa: 200, precoHa: 100, margemPct: -0.1, ha: 0 }],
    etapasConcluidas: [{ etapa: "E1" }],
  });
  const all = AIDetectors.runAll(st);
  expect(all.length).toBeGreaterThanOrEqual(4);
  for (const it of all) {
    for (const c of CAMPOS) expect(it[c] !== undefined && it[c] !== null).toBe(true);
    expect(Array.isArray(it.dados)).toBe(true);
    expect(it.confianca).toBeGreaterThanOrEqual(0);
    expect(it.confianca).toBeLessThanOrEqual(1);
    expect(["info", "aviso", "critico"]).toContain(it.nivel);
  }
});

test("runAll ordena por severidade (aviso antes de info) e depois confiança", () => {
  const st = baseState({
    clientes: [{ nome: "A", grupo: "fert", coletaNaSafra: true, ha: 50 }], // info (nova_analise)
    servicos: [{ nome: "S", custoHa: 200, precoHa: 100, margemPct: -0.1 }], // aviso (custo)
  });
  const all = AIDetectors.runAll(st);
  const idxAviso = all.findIndex((x: { nivel: string }) => x.nivel === "aviso");
  const idxInfo = all.findIndex((x: { nivel: string }) => x.nivel === "info");
  expect(idxAviso).toBeGreaterThanOrEqual(0);
  expect(idxInfo).toBeGreaterThan(idxAviso);
});
