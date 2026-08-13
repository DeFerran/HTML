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
    expect(["READ", "SAFE_WRITE", "SENSITIVE_WRITE"]).toContain(def.nivel);
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

// ---------------------------------------------------------------- MEMÓRIA

const MEM_SAMPLE = {
  ai_memory: [
    { entity_type: "cliente", entity_id: "Fazenda Boa Vista", memory_type: "preferencia", content: "Prefere relatório em PDF.", confidence: 0.9, status: "VALIDATED" },
    { entity_type: "geral", entity_id: null, memory_type: "fato", content: "Reunião mensal na primeira segunda.", confidence: 0.7, status: "VALIDATED" },
    { entity_type: "talhao", entity_id: "T1", memory_type: "recomendacao_agronomica", content: "Aplicar 2t/ha de calcário.", confidence: 0.8, status: "PENDING_REVIEW" },
  ],
};

test("recall_memory: só devolve memória VALIDATED", async () => {
  const { db } = makeDb(MEM_SAMPLE);
  const r = await runReadTool(db, "recall_memory", {}, CTX);
  expect(r.encontrado).toBe(true);
  const d = r.dados as { memorias: Array<Record<string, unknown>> };
  expect(d.memorias.length).toBe(2); // a pendente agronômica fica de fora
  expect(d.memorias.every((m) => String(m.content).length > 0)).toBe(true);
});

test("recall_memory: filtra por consulta (ilike no conteúdo)", async () => {
  const { db } = makeDb(MEM_SAMPLE);
  const r = await runReadTool(db, "recall_memory", { consulta: "PDF" }, CTX);
  const d = r.dados as { memorias: Array<Record<string, unknown>> };
  expect(d.memorias.length).toBe(1);
  expect(String(d.memorias[0].content)).toContain("PDF");
});

test("recall_memory: sem memória validada → encontrado=false", async () => {
  const { db } = makeDb({ ai_memory: [] });
  const r = await runReadTool(db, "recall_memory", {}, CTX);
  expect(r.encontrado).toBe(false);
});

test("propose_memory: chama proposeMemory injetado e nunca oficializa", async () => {
  const calls: unknown[] = [];
  const ctx = {
    ...CTX,
    proposeMemory: (m: unknown) => {
      calls.push(m);
      return Promise.resolve({ id: "m1", status: "PENDING_REVIEW", exige_validacao: true });
    },
  };
  const { db } = makeDb(MEM_SAMPLE);
  const r = await runReadTool(db, "propose_memory", { memory_type: "preferencia", content: "gosta de X" }, ctx);
  expect(r.encontrado).toBe(true);
  expect((r.dados as { status: string }).status).toBe("PENDING_REVIEW");
  expect(calls.length).toBe(1);
});

test("propose_memory: agronômico traz aviso de validação humana", async () => {
  const ctx = {
    ...CTX,
    proposeMemory: () => Promise.resolve({ id: "m2", status: "PENDING_REVIEW", exige_validacao: true }),
  };
  const { db } = makeDb(MEM_SAMPLE);
  const r = await runReadTool(db, "propose_memory", { memory_type: "recomendacao_agronomica", content: "aplicar calcário" }, ctx);
  expect(String(r.aviso)).toContain("agronômica");
});

test("propose_memory: sem proposeMemory no contexto → disponivel=false", async () => {
  const { db } = makeDb(MEM_SAMPLE);
  const r = await runReadTool(db, "propose_memory", { memory_type: "fato", content: "x" }, CTX);
  expect(r.disponivel).toBe(false);
});

// ---------------------------------------------------------------- ACTION TOOLS

function ctxActions(calls: Array<Record<string, unknown>>, ok = true, data: Record<string, unknown> = { ok: true }) {
  return {
    ...CTX,
    callActions: (b: Record<string, unknown>) => { calls.push(b); return Promise.resolve({ ok, status: ok ? 200 : 403, data }); },
  };
}

test("create_task (SAFE_WRITE) → encaminha execute_safe", async () => {
  const { db } = makeDb(SAMPLE);
  const calls: Array<Record<string, unknown>> = [];
  const r = await runReadTool(db, "create_task", { titulo: "Ligar para cliente" }, ctxActions(calls, true, { ok: true, id: "t1" }));
  expect(r.encontrado).toBe(true);
  expect(calls[0].action).toBe("execute_safe");
  expect(calls[0].tool).toBe("create_task");
});

test("create_internal_alert e generate_report_draft usam execute_safe", async () => {
  const { db } = makeDb(SAMPLE);
  const calls: Array<Record<string, unknown>> = [];
  const ctx = ctxActions(calls);
  await runReadTool(db, "create_internal_alert", { mensagem: "estoque baixo" }, ctx);
  await runReadTool(db, "generate_report_draft", { conteudo: "rascunho" }, ctx);
  expect(calls.map((c) => c.action)).toEqual(["execute_safe", "execute_safe"]);
  expect(calls.map((c) => c.tool)).toEqual(["create_internal_alert", "generate_report_draft"]);
});

test("send_external_whatsapp_message (SENSITIVE) só PROPÕE, nunca executa", async () => {
  const { db } = makeDb(SAMPLE);
  const calls: Array<Record<string, unknown>> = [];
  const r = await runReadTool(db, "send_external_whatsapp_message", { to: "5511", text: "oi" }, ctxActions(calls, true, { ok: true, approval_id: "ap1" }));
  expect(r.encontrado).toBe(true);
  expect(calls[0].action).toBe("propose"); // nunca execute_safe/execute
  expect(calls[0].tool).toBe("send_external_whatsapp_message");
  expect((r.dados as { status: string }).status).toBe("pendente");
  expect(String(r.aviso)).toContain("aguarda");
});

test("action tools sem callActions no contexto → disponivel=false", async () => {
  const { db } = makeDb(SAMPLE);
  const r = await runReadTool(db, "create_task", { titulo: "x" }, CTX);
  expect(r.disponivel).toBe(false);
});

test("nivel das action tools no registro", () => {
  expect(READ_TOOLS_BY_NAME.get("create_internal_alert")?.nivel).toBe("SAFE_WRITE");
  expect(READ_TOOLS_BY_NAME.get("create_task")?.nivel).toBe("SAFE_WRITE");
  expect(READ_TOOLS_BY_NAME.get("generate_report_draft")?.nivel).toBe("SAFE_WRITE");
  expect(READ_TOOLS_BY_NAME.get("send_external_whatsapp_message")?.nivel).toBe("SENSITIVE_WRITE");
});
