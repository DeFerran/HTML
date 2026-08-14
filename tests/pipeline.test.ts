// Testes do motor PURO do Pipeline operacional de AP.
// Extrai o bloco `// <pipeline-calc> ... // </pipeline-calc>` do index.html.
// Rodar: bun test tests/pipeline.test.ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const A = html.indexOf("// <pipeline-calc>");
const B = html.indexOf("// </pipeline-calc>");
if (A < 0 || B < 0) throw new Error("marcadores <pipeline-calc> não encontrados");
// deno-lint-ignore no-explicit-any
const P: any = (0, eval)(html.slice(A, B) + "\nPipelineCalc");

// helper: evento de mudança de etapa
const ev = (etapaPara: string, em: string, extra: any = {}) => ({ tipo: "ETAPA", etapaPara, em, ...extra });

// projeto "feliz": pedido → planejamento → coleta → laboratório → resultado → ... → concluído
const projOK = {
  criadoEm: "2026-08-01T12:00:00.000Z",
  concluidoEm: "2026-08-21T10:00:00.000Z",
  status: "concluido",
  etapaAtual: "CONCLUIDO",
  responsaveis: { COLETA: "Bruno" },
  eventos: [
    ev("PEDIDO", "2026-08-01T12:00:00.000Z"),
    ev("PLANEJAMENTO", "2026-08-02T10:30:00.000Z"),
    ev("COLETA", "2026-08-04T07:10:00.000Z"),
    ev("LABORATORIO", "2026-08-07T09:00:00.000Z"),
    ev("PROCESSAMENTO", "2026-08-12T09:00:00.000Z"),
    ev("MAPAS", "2026-08-14T09:00:00.000Z"),
    ev("APRESENTACAO", "2026-08-17T09:00:00.000Z"),
    ev("REGULAGEM", "2026-08-19T09:00:00.000Z"),
    ev("ACOMPANHAMENTO", "2026-08-20T09:00:00.000Z"),
    ev("CONCLUIDO", "2026-08-21T10:00:00.000Z"),
  ],
};

test("diasEntre: floor de dias; datas iguais = 0; inválida = null", () => {
  expect(P.diasEntre("2026-08-01T00:00:00Z", "2026-08-21T00:00:00Z")).toBe(20);
  expect(P.diasEntre("2026-08-01T12:00:00Z", "2026-08-01T20:00:00Z")).toBe(0); // mesmo dia
  expect(P.diasEntre("2026-08-01", "2026-08-01")).toBe(0);
  expect(P.diasEntre("", "2026-08-01")).toBeNull();
  expect(P.diasEntre("lixo", "2026-08-01")).toBeNull();
});

test("marcos: primeira data de entrada em cada etapa", () => {
  const m = P.marcos(projOK);
  expect(m.PEDIDO).toBe("2026-08-01T12:00:00.000Z");
  expect(m.COLETA).toBe("2026-08-04T07:10:00.000Z");
  expect(m.LABORATORIO).toBe("2026-08-07T09:00:00.000Z");
  expect(m.CONCLUIDO).toBe("2026-08-21T10:00:00.000Z");
});

test("tempoEntreMarcos: pedido→coleta, coleta→lab, lab→resultado(processamento)", () => {
  expect(P.tempoEntreMarcos(projOK, "PEDIDO", "COLETA")).toBe(3); // 01 → 04
  expect(P.tempoEntreMarcos(projOK, "COLETA", "LABORATORIO")).toBe(3); // 04 → 07
  expect(P.tempoEntreMarcos(projOK, "LABORATORIO", "PROCESSAMENTO")).toBe(5); // 07 → 12
  expect(P.tempoEntreMarcos(projOK, "MAPAS", "APRESENTACAO")).toBe(3); // 14 → 17
  expect(P.tempoEntreMarcos(projOK, "APRESENTACAO", "REGULAGEM")).toBe(2); // 17 → 19
});

test("tempoEntreMarcos: null quando alguma etapa não ocorreu", () => {
  expect(P.tempoEntreMarcos(projOK, "PEDIDO", "INEXISTENTE")).toBeNull();
});

test("leadTime: pedido → conclusão", () => {
  expect(P.leadTime(projOK, "2026-08-25T00:00:00Z")).toBe(20); // 01 → 21 (usa concluidoEm)
});

test("leadTime: em aberto usa 'agora'", () => {
  const aberto = { criadoEm: "2026-08-01T00:00:00Z", eventos: [ev("COLETA", "2026-08-04T00:00:00Z")], etapaAtual: "COLETA" };
  expect(P.leadTime(aberto, "2026-08-10T00:00:00Z")).toBe(9);
});

test("temposEntreEtapas: durações consecutivas", () => {
  const t = P.temposEntreEtapas(projOK);
  expect(t[0]).toEqual({ de: "PEDIDO", para: "PLANEJAMENTO", dias: 1 });
  expect(t[1]).toEqual({ de: "PLANEJAMENTO", para: "COLETA", dias: 2 });
  expect(t.length).toBe(9);
});

test("aging: dias na etapa atual = desde o último movimento", () => {
  const aberto = { criadoEm: "2026-08-01T00:00:00Z", etapaAtual: "LABORATORIO",
    eventos: [ev("COLETA", "2026-08-04T00:00:00Z"), ev("LABORATORIO", "2026-08-07T00:00:00Z")] };
  expect(P.diasNaEtapa(aberto, "2026-08-16T00:00:00Z")).toBe(9); // 9 dias no laboratório
});

test("slaStatus: verde/amarelo/vermelho/sem", () => {
  expect(P.slaStatus(3, 5)).toBe("verde"); // 60%
  expect(P.slaStatus(4, 5)).toBe("verde"); // 80%
  expect(P.slaStatus(5, 5)).toBe("amarelo"); // 100% = atenção
  expect(P.slaStatus(7, 5)).toBe("vermelho"); // atrasado
  expect(P.slaStatus(9, 0)).toBe("sem"); // sem prazo definido
  expect(P.slaStatus(null, 5)).toBe("sem"); // sem data
});

test("etapa PULADA: marcos ignora etapas não visitadas", () => {
  const pulou = { criadoEm: "2026-08-01T00:00:00Z", etapaAtual: "MAPAS",
    eventos: [ev("PEDIDO", "2026-08-01T00:00:00Z"), ev("COLETA", "2026-08-03T00:00:00Z"), ev("MAPAS", "2026-08-10T00:00:00Z")] };
  const m = P.marcos(pulou);
  expect(m.PLANEJAMENTO).toBeUndefined();
  expect(m.LABORATORIO).toBeUndefined();
  expect(P.tempoEntreMarcos(pulou, "COLETA", "MAPAS")).toBe(7);
});

test("evento DUPLICADO: marcos mantém a PRIMEIRA entrada", () => {
  const dup = { criadoEm: "2026-08-01T00:00:00Z", etapaAtual: "COLETA",
    eventos: [ev("COLETA", "2026-08-04T00:00:00Z"), ev("COLETA", "2026-08-06T00:00:00Z")] };
  expect(P.marcos(dup).COLETA).toBe("2026-08-04T00:00:00Z");
});

test("eventos fora de ordem são ordenados por 'em'", () => {
  const desordem = { criadoEm: "2026-08-01T00:00:00Z", etapaAtual: "LABORATORIO",
    eventos: [ev("LABORATORIO", "2026-08-07T00:00:00Z"), ev("COLETA", "2026-08-04T00:00:00Z")] };
  const t = P.temposEntreEtapas(desordem);
  expect(t[0]).toEqual({ de: "COLETA", para: "LABORATORIO", dias: 3 });
});

test("agg: contagem por etapa, WIP, backlog, concluídos, cancelados, atrasados, sem responsável", () => {
  const now = "2026-08-20T00:00:00Z";
  const projetos = [
    { status: "ativo", etapaAtual: "PLANEJAMENTO", responsaveis: {}, criadoEm: "2026-08-18T00:00:00Z",
      eventos: [ev("PLANEJAMENTO", "2026-08-19T00:00:00Z")] }, // backlog, sem resp
    { status: "ativo", etapaAtual: "LABORATORIO", responsaveis: { LABORATORIO: "Ana" },
      eventos: [ev("LABORATORIO", "2026-08-05T00:00:00Z")] }, // 15 dias no lab, SLA 7 → atrasado
    { status: "concluido", etapaAtual: "CONCLUIDO", eventos: [] },
    { status: "cancelado", etapaAtual: "COLETA", eventos: [] },
  ];
  const r = P.agg(projetos, { slaPorEtapa: { LABORATORIO: 7, PLANEJAMENTO: 3 }, nowISO: now });
  expect(r.total).toBe(4);
  expect(r.wip).toBe(2);
  expect(r.ativos).toBe(2);
  expect(r.concluidos).toBe(1);
  expect(r.cancelados).toBe(1);
  expect(r.backlog).toBe(1); // só o de planejamento
  expect(r.atrasados).toBe(1); // o do laboratório
  expect(r.semResp).toBe(1); // o de planejamento
  expect(r.porEtapa.LABORATORIO).toBe(1);
  expect(r.porEtapa.PLANEJAMENTO).toBe(1);
  expect(r.porEtapa.COLETA).toBe(0); // cancelado não conta na etapa
});

test("projeto CANCELADO não entra em WIP nem em etapa", () => {
  const r = P.agg([{ status: "cancelado", etapaAtual: "COLETA", eventos: [] }], { nowISO: "2026-08-20T00:00:00Z" });
  expect(r.wip).toBe(0);
  expect(r.cancelados).toBe(1);
  expect(r.porEtapa.COLETA).toBe(0);
});

test("datas IGUAIS: lead time e aging = 0, sem erro", () => {
  const mesmo = { criadoEm: "2026-08-01T08:00:00Z", concluidoEm: "2026-08-01T18:00:00Z", status: "concluido",
    etapaAtual: "CONCLUIDO", eventos: [ev("CONCLUIDO", "2026-08-01T18:00:00Z")] };
  expect(P.leadTime(mesmo, "2026-08-02T00:00:00Z")).toBe(0);
  expect(P.diasNaEtapa(mesmo, "2026-08-01T20:00:00Z")).toBe(0);
});

test("SLA VENCIDO no aging da etapa atual", () => {
  const atrasado = { criadoEm: "2026-08-01T00:00:00Z", etapaAtual: "LABORATORIO",
    eventos: [ev("LABORATORIO", "2026-08-05T00:00:00Z")] };
  const dias = P.diasNaEtapa(atrasado, "2026-08-14T00:00:00Z"); // 9 dias
  expect(dias).toBe(9);
  expect(P.slaStatus(dias, 5)).toBe("vermelho"); // SLA 5, +4 dias
});

test("SEM eventos: aging cai para criadoEm; sem crash", () => {
  const semEv = { criadoEm: "2026-08-10T00:00:00Z", etapaAtual: "PEDIDO", eventos: [] };
  expect(P.diasNaEtapa(semEv, "2026-08-13T00:00:00Z")).toBe(3);
  expect(P.marcos(semEv)).toEqual({});
  expect(P.temposEntreEtapas(semEv)).toEqual([]);
});

test("REABERTURA: sequência com volta de etapa é preservada nos movimentos", () => {
  const reab = { criadoEm: "2026-08-01T00:00:00Z", etapaAtual: "PROCESSAMENTO",
    eventos: [ev("MAPAS", "2026-08-10T00:00:00Z"), ev("PROCESSAMENTO", "2026-08-12T00:00:00Z", { obs: "reaberto: revisar interpolação" })] };
  const t = P.temposEntreEtapas(reab);
  expect(t[0]).toEqual({ de: "MAPAS", para: "PROCESSAMENTO", dias: 2 });
  // marcos guarda a PRIMEIRA vez de cada etapa (MAPAS ficou registrado)
  expect(P.marcos(reab).MAPAS).toBe("2026-08-10T00:00:00Z");
});
