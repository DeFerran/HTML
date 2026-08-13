// Testes das READ TOOLS (bun test).
//
// Provam, sem rede, as duas garantias exigidas nesta fase:
//   (A) acesso cross-tenant é impossível pela via da tool — o handler NUNCA
//       aplica filtro de user_id/empresa vindo dos argumentos do modelo; o
//       escopo é 100% da RLS sobre o `db` já autenticado.
//   (B) dados inexistentes → nunca inventa: retorna encontrado=false / motivo.
//
// Rodar: bun test supabase/functions/ai-gateway/tools/read_tools.test.ts

import { expect, test } from "bun:test";
import type { Db, QueryBuilder } from "./types.ts";
import { READ_TOOLS_BY_NAME, runReadTool } from "./read_tools.ts";

const CTX = { userId: "user-A", empresa: "DF AGRO" };

// registro global de todos os .eq() emitidos, para o teste cross-tenant.
type EqCall = { table: string; col: string; val: unknown };

function makeDb(tables: Record<string, Record<string, unknown>[]>) {
  const eqCalls: EqCall[] = [];
  const fromTables: string[] = [];

  function builder(table: string, rows: Record<string, unknown>[]): QueryBuilder {
    let cur = rows.slice();
    const b: QueryBuilder = {
      select() {
        return b;
      },
      eq(col, val) {
        eqCalls.push({ table, col, val });
        cur = cur.filter((r) => r[col] === val);
        return b;
      },
      ilike(col, pattern) {
        const needle = String(pattern)
          .replace(/^%|%$/g, "")
          .replace(/\\(.)/g, "$1")
          .toLowerCase();
        cur = cur.filter((r) =>
          String(r[col] ?? "").toLowerCase().includes(needle)
        );
        return b;
      },
      order() {
        return b;
      },
      limit(n) {
        cur = cur.slice(0, n);
        return b;
      },
      maybeSingle() {
        return Promise.resolve({ data: cur[0] ?? null, error: null });
      },
      then(onfulfilled) {
        return Promise.resolve(onfulfilled({ data: cur, error: null }));
      },
    };
    return b;
  }

  const db: Db = {
    from(table) {
      fromTables.push(table);
      return builder(table, tables[table] ?? []);
    },
  };
  return { db, eqCalls, fromTables };
}

const SAMPLE = {
  bi_clientes: [
    { nome: "Fazenda Boa Vista", grupo: "Grupo A", receita: 120000, ha: 3000 },
    { nome: "Sítio das Águas", grupo: "Grupo B", receita: 50000, ha: 800 },
  ],
  bi_visitas: [
    { cliente: "Fazenda Boa Vista", visitas: 4, relatorios: 2, km: 320 },
  ],
  bi_cross_sell: [
    { cliente: "Fazenda Boa Vista", servico: "Mapeamento", marcado: 1 },
    { cliente: "Fazenda Boa Vista", servico: "Calagem", marcado: 0 },
  ],
  bi_safras: [
    { safra_label: "26/27", receita: 900000, custo_competencia: 400000 },
  ],
  bi_servicos: [
    { nome: "Mapeamento", ha2627: 1000, rec2627: 200000, cli2627: 5 },
  ],
  bi_custo_categoria: [
    { ano: 2026, categoria: "Combustível", valor: 30000 },
  ],
  bi_custos_mensais: [
    { mes: "Jan", idx: 0, valor: 10000 },
    { mes: "Fev", idx: 1, valor: 12000 },
  ],
  bi_proj_gastos: [{ gasto: 25000 }],
  bi_operacao_situacao: [{ situacao: "Concluído", valor: 12 }],
  bi_operacao_etapas: [
    { etapa: "Coleta", andamento: 3, concluido: 8, pendente: 1 },
  ],
};

// ---------------------------------------------------------------- (A)

test("get_client: retorna estrutura tipada quando encontra", async () => {
  const { db } = makeDb(SAMPLE);
  const r = await runReadTool(db, "get_client", { nome: "Boa Vista" }, CTX);
  expect(r.disponivel).toBe(true);
  expect(r.encontrado).toBe(true);
  const d = r.dados as Record<string, unknown>;
  expect(d.nome).toBe("Fazenda Boa Vista");
  expect(d.receita).toBe(120000);
  expect(d.visitas).toBe(4);
  expect(d.servicos_marcados).toEqual(["Mapeamento"]); // marcado=0 fica de fora
});

test("cross-tenant: args maliciosos (user_id/empresa) são IGNORADos", async () => {
  const { db, eqCalls } = makeDb(SAMPLE);
  await runReadTool(
    db,
    "get_client",
    { nome: "Boa Vista", user_id: "user-B", empresa: "OUTRA", nome_tabela: "x" },
    CTX,
  );
  // nenhuma query pode filtrar por user_id/empresa vindos do modelo.
  const leaked = eqCalls.filter(
    (c) => c.col === "user_id" || c.col === "empresa",
  );
  expect(leaked).toEqual([]);
  // e nenhum valor malicioso foi usado como filtro em lugar nenhum.
  const usedEvil = eqCalls.some(
    (c) => c.val === "user-B" || c.val === "OUTRA",
  );
  expect(usedEvil).toBe(false);
});

test("nunca há SQL do modelo: schema não aceita campos livres perigosos", () => {
  for (const def of READ_TOOLS_BY_NAME.values()) {
    expect(def.input_schema.additionalProperties).toBe(false);
    expect(def.nivel).toBe("READ");
  }
});

// ---------------------------------------------------------------- (B)

test("get_client: cliente inexistente → encontrado=false, sem inventar", async () => {
  const { db } = makeDb(SAMPLE);
  const r = await runReadTool(db, "get_client", { nome: "Inexistente XYZ" }, CTX);
  expect(r.disponivel).toBe(true);
  expect(r.encontrado).toBe(false);
  expect(r.dados).toBeUndefined();
  expect(typeof r.motivo).toBe("string");
});

test("get_season: safra inexistente → encontrado=false", async () => {
  const { db } = makeDb(SAMPLE);
  const r = await runReadTool(db, "get_season", { safra: "99/00" }, CTX);
  expect(r.encontrado).toBe(false);
});

test("get_season: safra real → dados + serviços", async () => {
  const { db } = makeDb(SAMPLE);
  const r = await runReadTool(db, "get_season", { safra: "26/27" }, CTX);
  expect(r.encontrado).toBe(true);
  const d = r.dados as Record<string, unknown>;
  expect(d.receita).toBe(900000);
  expect(Array.isArray(d.servicos)).toBe(true);
});

test("get_costs: agrega por mês/categoria e compara real vs projetado", async () => {
  const { db } = makeDb(SAMPLE);
  const r = await runReadTool(db, "get_costs", {}, CTX);
  expect(r.encontrado).toBe(true);
  const d = r.dados as Record<string, any>;
  expect(d.total).toBe(22000); // 10000 + 12000
  expect(d.real_vs_projetado.projetado).toBe(25000);
});

test("get_costs: sem dados → encontrado=false", async () => {
  const { db } = makeDb({});
  const r = await runReadTool(db, "get_costs", {}, CTX);
  expect(r.encontrado).toBe(false);
});

test("get_collection_status: só agregado, com aviso explícito", async () => {
  const { db } = makeDb(SAMPLE);
  const r = await runReadTool(db, "get_collection_status", {}, CTX);
  expect(r.encontrado).toBe(true);
  expect(String(r.aviso)).toContain("AGREGADA");
});

// ---------------------------------------------------------------- stubs

for (const name of ["get_farm", "get_field", "get_soil_analysis"]) {
  test(`${name}: stub honesto — disponivel=false e não toca o banco`, async () => {
    const { db, fromTables } = makeDb(SAMPLE);
    const r = await runReadTool(db, name, { nome: "qualquer" }, CTX);
    expect(r.disponivel).toBe(false);
    expect(r.encontrado).toBe(false);
    expect(typeof r.motivo).toBe("string");
    expect(fromTables).toEqual([]); // nenhuma consulta ao banco
  });
}

test("tool desconhecida → disponivel=false", async () => {
  const { db } = makeDb(SAMPLE);
  const r = await runReadTool(db, "drop_tables", {}, CTX);
  expect(r.disponivel).toBe(false);
});

// ---------------------------------------------------------------- RAG

const HITS = [
  { doc_id: "d1", titulo: "Manual de Calagem", fonte: "manual.md", idx: 0, trecho: "Aplicar calcário conforme V%.", distancia: 0.12 },
  { doc_id: "d1", titulo: "Manual de Calagem", fonte: "manual.md", idx: 1, trecho: "Considerar PRNT do produto.", distancia: 0.20 },
  { doc_id: "d2", titulo: "Guia de Amostragem", fonte: "guia.txt", idx: 3, trecho: "Coletar 15 subamostras por gleba.", distancia: 0.25 },
];

test("search_knowledge: retorna trechos e FONTES únicas dos docs usados", async () => {
  const { db, fromTables } = makeDb(SAMPLE);
  const ctx = { ...CTX, retrieve: (_q: string, _n: number) => Promise.resolve(HITS) };
  const r = await runReadTool(db, "search_knowledge", { consulta: "calagem" }, ctx);
  expect(r.encontrado).toBe(true);
  const d = r.dados as { trechos: unknown[]; fontes: Array<{ doc_id: string }> };
  expect(d.trechos.length).toBe(3);
  // fontes deduplicadas por documento (d1, d2).
  expect(d.fontes.map((f) => f.doc_id).sort()).toEqual(["d1", "d2"]);
  // a tool NÃO acessa o banco diretamente: o escopo (RLS) vem do retrieve injetado.
  expect(fromTables).toEqual([]);
});

test("search_knowledge: sem resultados → encontrado=false, sem inventar", async () => {
  const { db } = makeDb(SAMPLE);
  const ctx = { ...CTX, retrieve: () => Promise.resolve([]) };
  const r = await runReadTool(db, "search_knowledge", { consulta: "tema inexistente" }, ctx);
  expect(r.encontrado).toBe(false);
  expect(r.dados).toBeUndefined();
});

test("search_knowledge: sem retrieve no contexto → disponivel=false", async () => {
  const { db } = makeDb(SAMPLE);
  const r = await runReadTool(db, "search_knowledge", { consulta: "x" }, CTX);
  expect(r.disponivel).toBe(false);
});

test("search_knowledge: consulta vazia → encontrado=false", async () => {
  const { db } = makeDb(SAMPLE);
  const ctx = { ...CTX, retrieve: () => Promise.resolve(HITS) };
  const r = await runReadTool(db, "search_knowledge", { consulta: "  " }, ctx);
  expect(r.encontrado).toBe(false);
});
