// Testes do cálculo puro do Controle Operacional · Tela 1 (Coleta de Pontos).
// Extrai o bloco `// <op-coleta-calc> ... // </op-coleta-calc>` do index.html.
// Rodar: bun test tests/opcoleta.test.ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const A = html.indexOf("// <op-coleta-calc>");
const B = html.indexOf("// </op-coleta-calc>");
if (A < 0 || B < 0) throw new Error("marcadores <op-coleta-calc> não encontrados");
// deno-lint-ignore no-explicit-any
const OP: any = (0, eval)(html.slice(A, B) + "\nOpColetaCalc");

const LANCS = [
  { id: "1", data: "2026-08-11", equipe: "Equipe 01", cliente: "Casari", fazenda: "Casari", talhao: "C413", status: "planejada", obs: "Programada", colaboradores: [{ nome: "Welinton", pontos: 0 }] },
  { id: "2", data: "2026-08-11", equipe: "Equipe 02", cliente: "Progresso", fazenda: "Progresso", talhao: "TH 01", status: "finalizada", obs: "", colaboradores: [{ nome: "Deivison", pontos: 27 }, { nome: "Emanuel", pontos: 20 }] },
  { id: "3", data: "2026-08-12", equipe: "Equipe 01", cliente: "Aliança", fazenda: "Aliança", talhao: "TH 02A", status: "andamento", obs: "Iago entrou", colaboradores: [{ nome: "Agnaldo", pontos: 29 }, { nome: "Iago", pontos: 31 }] },
  { id: "4", data: "2026-09-01", equipe: "Equipe 01", cliente: "Iracema", fazenda: "Iracema", talhao: "TH 01", status: "finalizada", obs: "", colaboradores: [{ nome: "Agnaldo", pontos: 41 }] },
];

test("totalDia soma pontos dos colaboradores", () => {
  expect(OP.totalDia(LANCS[1])).toBe(47);
  expect(OP.totalDia(LANCS[0])).toBe(0);
  expect(OP.totalDia({})).toBe(0);
});

test("agg: total, dias trabalhados (pontos>0) e média", () => {
  const a = OP.agg(LANCS);
  expect(a.totalPontos).toBe(0 + 47 + 60 + 41); // 148
  expect(a.diasTrabalhados).toBe(3); // 11/08 (47), 12/08 (60), 01/09 (41) — dia do lanç 0 não conta sozinho, mas 11/08 tem o 47
  expect(a.mediaDiaria).toBeCloseTo(148 / 3, 5);
});

test("agg: produtividade por colaborador (dias com pontos>0, soma, média)", () => {
  const a = OP.agg(LANCS);
  const agnaldo = a.produtividade.find((p: { nome: string }) => p.nome === "Agnaldo");
  expect(agnaldo.pontos).toBe(29 + 41);
  expect(agnaldo.dias).toBe(2);
  expect(agnaldo.media).toBeCloseTo(70 / 2, 5);
  const welinton = a.produtividade.find((p: { nome: string }) => p.nome === "Welinton");
  expect(welinton.pontos).toBe(0);
  expect(welinton.dias).toBe(0); // pontos 0 → não conta dia
  // ordenado por pontos desc
  expect(a.produtividade[0].pontos).toBeGreaterThanOrEqual(a.produtividade[1].pontos);
});

test("filtra: por data, cliente, equipe, status, colaborador e busca", () => {
  expect(OP.filtra(LANCS, { de: "2026-08-12" }).length).toBe(2);
  expect(OP.filtra(LANCS, { ate: "2026-08-11" }).length).toBe(2);
  expect(OP.filtra(LANCS, { equipe: "Equipe 01" }).length).toBe(3);
  expect(OP.filtra(LANCS, { status: "finalizada" }).length).toBe(2);
  expect(OP.filtra(LANCS, { colab: "Iago" }).length).toBe(1);
  expect(OP.filtra(LANCS, { busca: "iago" }).length).toBe(1);
  expect(OP.filtra(LANCS, { cliente: "Casari" }).length).toBe(1);
});

test("gruposPorMes: agrupa e soma por mês, ordenado", () => {
  const g = OP.gruposPorMes(LANCS);
  expect(g.length).toBe(2);
  expect(g[0].ym).toBe("2026-08");
  expect(g[0].total).toBe(107); // 0 + 47 + 60
  expect(g[1].ym).toBe("2026-09");
  expect(g[1].total).toBe(41);
});

test("mesLabel em pt-BR", () => {
  expect(OP.mesLabel("2026-08")).toBe("Agosto / 2026");
  expect(OP.mesLabel("2026-01")).toBe("Janeiro / 2026");
});

test("statusInfo mapeia rótulo + classe", () => {
  expect(OP.statusInfo("finalizada")).toEqual({ label: "Finalizada", cls: "op-b-ok" });
  expect(OP.statusInfo("andamento").cls).toBe("op-b-run");
  expect(OP.statusInfo("xyz").cls).toBe("op-b-none");
});

test("hectares: soma pontos×fator por lançamento; null se nenhum fator", () => {
  expect(OP.hectares([{ colaboradores: [{ pontos: 100 }] }])).toBeNull(); // sem fator
  expect(OP.hectares([{ fator: 0, colaboradores: [{ pontos: 100 }] }])).toBeNull();
  // 100 pts × 3 + 40 pts × 5 = 300 + 200 = 500 (fator varia por lançamento/cliente)
  expect(OP.hectares([
    { fator: 3, colaboradores: [{ pontos: 100 }] },
    { fator: 5, colaboradores: [{ pontos: 40 }] },
  ])).toBe(500);
  // lançamento sem fator é ignorado na soma
  expect(OP.hectares([
    { fator: 2, colaboradores: [{ pontos: 10 }] },
    { colaboradores: [{ pontos: 999 }] },
  ])).toBe(20);
});

/* ===== Fase 4 — produtividade por colaborador / equipe ===== */
const LANCS_F = [
  { data: "2026-08-11", equipe: "Equipe 01", cliente: "Casari", fazenda: "Casari", talhao: "C1", status: "finalizada", fator: 3, colaboradores: [{ nome: "Agnaldo", pontos: 30 }, { nome: "Iago", pontos: 20 }] },
  { data: "2026-08-12", equipe: "Equipe 01", cliente: "Aliança", fazenda: "Aliança", talhao: "A1", status: "andamento", fator: 5, colaboradores: [{ nome: "Agnaldo", pontos: 10 }] },
  { data: "2026-09-01", equipe: "Equipe 02", cliente: "Iracema", fazenda: "Iracema", talhao: "I1", status: "finalizada", fator: 2, colaboradores: [{ nome: "Iago", pontos: 40 }] },
];

test("porColaborador: pontos, dias, ha (pontos×fator), médias e ordenação", () => {
  const pc = OP.porColaborador(LANCS_F);
  const agn = pc.find((c: { nome: string }) => c.nome === "Agnaldo");
  expect(agn.pontos).toBe(40); // 30 + 10
  expect(agn.dias).toBe(2);
  expect(agn.ha).toBe(30 * 3 + 10 * 5); // 90 + 50 = 140
  expect(agn.mediaPontosDia).toBeCloseTo(20, 5);
  expect(agn.mediaHaDia).toBeCloseTo(70, 5);
  const iago = pc.find((c: { nome: string }) => c.nome === "Iago");
  expect(iago.ha).toBe(20 * 3 + 40 * 2); // 60 + 80 = 140
  expect(pc[0].pontos).toBeGreaterThanOrEqual(pc[1].pontos); // ordenado
});

test("porColaborador: ha null quando nenhum lançamento tem fator", () => {
  const pc = OP.porColaborador([{ data: "2026-08-11", colaboradores: [{ nome: "X", pontos: 10 }] }]);
  expect(pc[0].ha).toBeNull();
  expect(pc[0].mediaHaDia).toBeNull();
});

test("porEquipe: agrega por equipe (pontos, dias, ha, nº colaboradores)", () => {
  const pe = OP.porEquipe(LANCS_F);
  const e1 = pe.find((e: { equipe: string }) => e.equipe === "Equipe 01");
  expect(e1.pontos).toBe(50 + 10); // dia1 (30+20) + dia2 (10)
  expect(e1.dias).toBe(2);
  expect(e1.colaboradores).toBe(2); // Agnaldo, Iago
  expect(e1.ha).toBe(50 * 3 + 10 * 5); // 150 + 50 = 200
});

test("serieMensal: pontos e ha por mês", () => {
  const s = OP.serieMensal(LANCS_F);
  expect(s.length).toBe(2);
  expect(s[0].ym).toBe("2026-08");
  expect(s[0].pontos).toBe(60); // 50 + 10
  expect(s[0].ha).toBe(50 * 3 + 10 * 5); // 200
  expect(s[1].ym).toBe("2026-09");
  expect(s[1].pontos).toBe(40);
});

test("historicoColab: linhas diárias do colaborador com ha por dia", () => {
  const h = OP.historicoColab(LANCS_F, "Agnaldo");
  expect(h.length).toBe(2);
  expect(h[0].data).toBe("2026-08-11");
  expect(h[0].pontos).toBe(30);
  expect(h[0].ha).toBe(90); // 30 × 3
  expect(h[1].ha).toBe(50); // 10 × 5
});

test("resumoColeta: pontos, ha, dias, coletas abertas/concluídas, colaboradores", () => {
  const r = OP.resumoColeta(LANCS_F);
  expect(r.pontos).toBe(100); // 60 + 40
  expect(r.ha).toBe(200 + 80); // ago 200 + set 80
  expect(r.dias).toBe(3);
  expect(r.coletas).toBe(3);
  expect(r.concluidas).toBe(2); // 2 finalizadas
  expect(r.abertas).toBe(1); // 1 andamento
  expect(r.colaboradores).toBe(2); // Agnaldo, Iago
});
