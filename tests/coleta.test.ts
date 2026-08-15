// Testes do tipo COLETA no serviço central + staging (prova de que a arquitetura escala).
// Rodar: bun test tests/coleta.test.ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const blk = (n: string) => { const A = html.indexOf("// <" + n + ">"), B = html.indexOf("// </" + n + ">"); if (A < 0 || B < 0) throw new Error("bloco " + n); return html.slice(A, B); };
// deno-lint-ignore no-explicit-any
const Env: any = (0, eval)(blk("lanc-service") + "\n" + blk("import-staging") + "\n({LancService,ImportStaging})");
const L = Env.LancService, S = Env.ImportStaging;

test("coleta registrada e aponta para caminho aninhado", () => {
  expect(L.TIPOS.coleta).toBeTruthy();
  expect(L.TIPOS.coleta.array).toBe("opColeta.lancamentos");
});

test("normalizar coleta: colaboradores 'Nome: pontos | ...' vira array", () => {
  const r = L.normalizar({ data: "2026-08-15", colaboradores: "Fulano: 40 | Ciclano: 30" }, "coleta", {});
  expect(r.colaboradores).toEqual([{ nome: "Fulano", pontos: 40 }, { nome: "Ciclano", pontos: 30 }]);
});

test("normalizar coleta: status rótulo → código; fator numérico", () => {
  const r = L.normalizar({ data: "2026-08-15", status: "Em andamento", fator: "3" }, "coleta", {});
  expect(r.status).toBe("andamento");
  expect(r.fator).toBe(3);
  const r2 = L.normalizar({ data: "2026-08-15", status: "Finalizada" }, "coleta", {});
  expect(r2.status).toBe("finalizada");
  // status desconhecido → andamento (soft, como no import CSV antigo)
  expect(L.normalizar({ data: "x", status: "qualquer" }, "coleta", {}).status).toBe("andamento");
});

test("validar coleta: data obrigatória", () => {
  expect(L.validar({ data: "2026-08-15" }, "coleta").ok).toBe(true);
  const v = L.validar({ data: "" }, "coleta");
  expect(v.ok).toBe(false);
  expect(v.campo).toBe("data");
});

test("fingerprint coleta: inclui colaboradores; ordem não muda o resultado", () => {
  const a = L.fingerprint(L.normalizar({ data: "2026-08-15", cliente: "A", fazenda: "F", talhao: "T1", colaboradores: "Fulano: 40 | Ciclano: 30" }, "coleta", {}), "coleta");
  const b = L.fingerprint(L.normalizar({ data: "2026-08-15", cliente: "A", fazenda: "F", talhao: "T1", colaboradores: "Ciclano: 30 | Fulano: 40" }, "coleta", {}), "coleta");
  expect(a).toBe(b); // mesmo conjunto de colaboradores/pontos → mesmo fingerprint
});

test("classificar coleta: nova, erro sem data, status softLista não trava", () => {
  const campos = L.TIPOS.coleta.campos;
  const recs = [
    { data: "2026-08-15", cliente: "Danilo Ferrarezi", fazenda: "F1", colaboradores: "Fulano: 40", status: "qualquer coisa" }, // status inválido NÃO vira erro (softLista)
    { data: "", cliente: "Danilo Ferrarezi" }, // erro: sem data
    { data: "2026-08-16", cliente: "Inexistente" }, // erro: cliente não encontrado
  ];
  const R = S.classificar(recs, { tipo: "coleta", campos, hojeYM: "2026-08", existentesKeys: new Set(), existentesFp: new Set(),
    validos: { clientes: ["Danilo Ferrarezi"], COLETA_STATUS: ["Planejada", "Em andamento", "Finalizada", "Não trabalhado"] } });
  expect(R.linhas[0].status).toBe("nova"); // status livre não bloqueia
  expect(R.linhas[1].status).toBe("erro");
  expect(R.linhas[2].status).toBe("erro");
  expect(R.resumo.nova).toBe(1);
});
