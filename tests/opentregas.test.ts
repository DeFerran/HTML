// Testes do cálculo puro do Controle Operacional · Tela 3 (Controle de Entregas).
// Extrai o bloco `// <op-entregas-calc> ... // </op-entregas-calc>` do index.html.
// Rodar: bun test tests/opentregas.test.ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const A = html.indexOf("// <op-entregas-calc>");
const B = html.indexOf("// </op-entregas-calc>");
if (A < 0 || B < 0) throw new Error("marcadores <op-entregas-calc> não encontrados");
// deno-lint-ignore no-explicit-any
const OP: any = (0, eval)(html.slice(A, B) + "\nOpEntregasCalc");

const linha = (itens: Record<string, { status: string; media?: number }>, extra = {}) => ({ cliente: "X", itens, ...extra });

test("ITENS tem os 6 entregáveis, 4 com média", () => {
  expect(OP.ITENS.length).toBe(6);
  expect(OP.ITENS.filter((i: { media: boolean }) => i.media).length).toBe(4);
});

test("progresso: concluídos / aplicáveis (ignora 'na')", () => {
  const l = linha({ propQuimicas: { status: "concluido" }, mapas: { status: "concluido" }, calcario: { status: "pendente" }, fosforo: { status: "na" } });
  const p = OP.progresso(l);
  expect(p.aplicaveis).toBe(3); // fosforo 'na' não conta
  expect(p.concluidos).toBe(2);
  expect(p.pct).toBe(Math.round((2 / 3) * 100));
});

test("progresso: tudo 'na' → 0% e 0 aplicáveis", () => {
  const p = OP.progresso(linha({}));
  expect(p.aplicaveis).toBe(0);
  expect(p.pct).toBe(0);
});

test("statusLinha: concluída (100%), andamento (≥1 concluído + falta), nao_iniciada (vazio)", () => {
  expect(OP.statusLinha(linha({ propQuimicas: { status: "concluido" }, mapas: { status: "concluido" } }))).toBe("concluida");
  expect(OP.statusLinha(linha({ propQuimicas: { status: "concluido" }, mapas: { status: "pendente" } }))).toBe("andamento");
  expect(OP.statusLinha(linha({}))).toBe("nao_iniciada");
});

test("statusLinha (D-05): linha 100% pendente NÃO é 'andamento' — é 'nao_iniciada'", () => {
  // tem itens aplicáveis, porém NADA concluído → não começou
  expect(OP.statusLinha(linha({ calcario: { status: "pendente" }, mib: { status: "pendente" } }))).toBe("nao_iniciada");
  expect(OP.statusLinha(linha({ propQuimicas: { status: "na" }, mapas: { status: "pendente" } }))).toBe("nao_iniciada");
});

test("contaPendentes / temPendente", () => {
  const l = linha({ calcario: { status: "pendente" }, mib: { status: "pendente" }, mapas: { status: "concluido" } });
  expect(OP.contaPendentes(l)).toBe(2);
  expect(OP.temPendente(l)).toBe(true);
  expect(OP.temPendente(linha({ mapas: { status: "concluido" } }))).toBe(false);
});

test("agg (D-05): baldes MUTUAMENTE EXCLUSIVOS — sem dupla contagem andamento+pendente", () => {
  const linhas = [
    linha({ propQuimicas: { status: "concluido" }, mapas: { status: "concluido" } }),           // concluída
    linha({ propQuimicas: { status: "concluido" }, mapas: { status: "pendente" } }),             // andamento (1 concluído), 1 item pendente
    linha({ calcario: { status: "pendente" }, mib: { status: "pendente" } }),                    // pendente/não iniciada, 2 itens pendentes
    linha({}),                                                                                    // 0 aplicáveis (não entra em nenhum balde)
  ];
  const a = OP.agg(linhas);
  expect(a.total).toBe(4);
  expect(a.concluidas).toBe(1);
  expect(a.emAndamento).toBe(1);   // só a linha que realmente começou
  expect(a.pendentes).toBe(1);     // a linha 100% pendente (com aplicáveis) — NÃO conta como andamento
  expect(a.itensPendentes).toBe(3);
  // invariante: cada linha com itens aplicáveis está em EXATAMENTE um balde
  expect(a.concluidas + a.emAndamento + a.pendentes).toBe(3); // a linha vazia (0 aplicáveis) fica de fora
});

test("filtra: cliente, status e pendências", () => {
  const linhas = [
    linha({ propQuimicas: { status: "concluido" }, mapas: { status: "concluido" } }, { cliente: "Edras", fazenda: "" }),
    linha({ calcario: { status: "pendente" } }, { cliente: "Lorival", fazenda: "Eldorado" }),
  ];
  expect(OP.filtra(linhas, { cliente: "Edras" }).length).toBe(1);
  expect(OP.filtra(linhas, { status: "concluida" }).length).toBe(1);
  expect(OP.filtra(linhas, { pendencias: "com" }).length).toBe(1);
  expect(OP.filtra(linhas, { pendencias: "sem" }).length).toBe(1);
  expect(OP.filtra(linhas, { busca: "eldorado" }).length).toBe(1);
});

test("marker: símbolos e classes", () => {
  expect(OP.marker("concluido")).toEqual({ s: "✓", cls: "ok" });
  expect(OP.marker("pendente").cls).toBe("wait");
  expect(OP.marker("andamento").cls).toBe("run");
  expect(OP.marker("na").s).toBe("—");
});
