// Testa a preservação de cadastros manuais na importação da planilha GESTÃO_AP.
// mergeImport() copia de `prev` (estado atual) para `fresh` (planilha) as chaves
// que NÃO existem na planilha — senão hydrate() as recria vazias e apaga o
// trabalho manual (Controle Operacional, metas/preços por safra, etc.).
// Rodar: bun test tests/importmerge.test.ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
// extrai _temDados + mergeImport (funções puras, sem DOM/D)
const A = html.indexOf("function _temDados(");
const B = html.indexOf("function loadFile(");
if (A < 0 || B < 0) throw new Error("não achei _temDados/mergeImport");
// deno-lint-ignore no-explicit-any
const mergeImport: any = (0, eval)(html.slice(A, B) + "\nmergeImport");

test("preserva Controle Operacional (não está na planilha) numa importação", () => {
  const prev = {
    opColeta: { lancamentos: [{ id: "opc1", data: "2026-08-01" }], hectaresFator: 3 },
    opAmostras: { remessas: [{ id: "opa1", dataEnvio: "2026-08-01" }], prazoDias: 15 },
    opEntregas: { linhas: [{ id: "ope1", cliente: "Casari" }], mibPadrao: 20 },
  };
  const fresh: any = { safras: {}, servicos: [] }; // o que a planilha reconstrói
  const out = mergeImport(prev, fresh);
  expect(out.opColeta.lancamentos).toHaveLength(1);
  expect(out.opAmostras.remessas[0].id).toBe("opa1");
  expect(out.opEntregas.linhas[0].cliente).toBe("Casari");
});

test("preserva metas e preços por safra (edições manuais por safra)", () => {
  const prev = {
    metasSafra: { "26/27": { receita: 999, area: 111, receitaReal: 500, areaReal: 60 } },
    precosSafra: { "26/27": { "Fertilidade Grid 3": { preco: 90, custo: 40, un: "ha" } } },
  };
  const fresh: any = { metas: { receitaMeta: 0 } };
  const out = mergeImport(prev, fresh);
  expect(out.metasSafra["26/27"].receita).toBe(999);
  expect(out.precosSafra["26/27"]["Fertilidade Grid 3"].preco).toBe(90);
});

test("não sobrescreve com dados vazios: chave vazia em prev deixa a da planilha", () => {
  const prev = { opColeta: { lancamentos: [] } }; // sem lançamentos → _temDados falso p/ objeto? (tem hectaresFator?)
  const fresh: any = { clientes: [{ nome: "novo da planilha" }] };
  const out = mergeImport(prev, fresh);
  // clientes não existe em prev → mantém o da planilha
  expect(out.clientes[0].nome).toBe("novo da planilha");
});

test("continua preservando os cadastros originais (lançamentos, funil, clientes...)", () => {
  const prev = {
    lancamentos: [{ id: 1 }],
    funil: [{ cliente: "X" }],
    clientes: [{ nome: "Y" }],
    equipe: [{ nome: "Z" }],
  };
  const fresh: any = { lancamentos: [], funil: [], clientes: [], equipe: [] };
  const out = mergeImport(prev, fresh);
  expect(out.lancamentos).toHaveLength(1);
  expect(out.funil[0].cliente).toBe("X");
  expect(out.clientes[0].nome).toBe("Y");
  expect(out.equipe[0].nome).toBe("Z");
});
