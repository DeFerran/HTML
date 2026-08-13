// READ TOOLS — as 7 primeiras ferramentas somente-leitura.
//
// Invariantes (CLAUDE.md + docs/ai/03-MAPA-DE-TOOLS.md):
//  - Cada tool é uma CONSULTA PARAMETRIZADA FIXA. Nunca SQL vindo do modelo.
//  - O `db` já vem escopado pelo JWT do usuário → a RLS (user_id = auth.uid()
//    + is_membro_ativo()) é a barreira de tenant. As tools NUNCA filtram por
//    user_id/empresa vindos dos argumentos do modelo (isso é ignorado).
//  - Fonte de leitura = tabelas bi_* (nunca painel_estado, nunca o blob JSON).
//  - Tool sem dado real → NÃO inventa: retorna { disponivel:false, motivo }.
//
// Cobertura pedida nesta fase:
//   get_client, get_season, get_costs, get_collection_status  → dados reais
//   get_farm, get_field, get_soil_analysis                    → stub honesto

import {
  Db,
  KnowledgeHit,
  ToolContext,
  ToolDef,
  ToolHandler,
  ToolResult,
} from "./types.ts";
import { isCriticalMemory } from "./memory_rules.ts";

// ---- helpers -----------------------------------------------------------

function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

function str(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  return typeof v === "string" ? v.trim() : "";
}

function intOrNull(args: Record<string, unknown>, key: string): number | null {
  const v = args[key];
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(+v)) {
    return Math.trunc(+v);
  }
  return null;
}

// Escapa curingas de ILIKE para casar o nome como literal (defesa a fundo;
// não é SQL do modelo — é um valor parametrizado pelo PostgREST).
function likeLiteral(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

const NOT_AVAILABLE = (motivo: string): ToolResult => ({
  disponivel: false,
  encontrado: false,
  motivo,
});

// ---- get_client --------------------------------------------------------

const getClient: ToolHandler = async (db, args) => {
  const nome = str(args, "nome");
  if (!nome) {
    return { disponivel: true, encontrado: false, motivo: "Informe o nome do cliente." };
  }

  const { data: cli, error } = await db
    .from("bi_clientes")
    .select("nome, grupo, receita, ha")
    .ilike("nome", `%${likeLiteral(nome)}%`)
    .order("receita", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`bi_clientes: ${error.message}`);
  if (!cli) {
    return {
      disponivel: true,
      encontrado: false,
      motivo: `Nenhum cliente encontrado para "${nome}".`,
    };
  }
  const c = cli as Record<string, unknown>;
  const nomeReal = String(c.nome ?? nome);

  // visitas (mesmo cliente)
  const { data: vis } = await db
    .from("bi_visitas")
    .select("visitas, relatorios, km")
    .eq("cliente", nomeReal)
    .limit(1)
    .maybeSingle() as unknown as { data: Record<string, unknown> | null };

  // serviços marcados no cross-sell
  const csRows = await db
    .from("bi_cross_sell")
    .select("servico, marcado")
    .eq("cliente", nomeReal)
    .then((r) => (r.error ? [] : (r.data ?? [])) as Record<string, unknown>[]);
  const servicos_marcados = csRows
    .filter((r) => num(r.marcado) > 0)
    .map((r) => String(r.servico));

  return {
    disponivel: true,
    encontrado: true,
    dados: {
      nome: nomeReal,
      grupo: c.grupo ?? null,
      receita: num(c.receita),
      ha: num(c.ha),
      visitas: vis ? num(vis.visitas) : 0,
      relatorios: vis ? num(vis.relatorios) : 0,
      km: vis ? num(vis.km) : 0,
      servicos_marcados,
    },
  };
};

// ---- get_season (safra é rótulo GLOBAL, não por talhão) ----------------

const SEASON_COLS: Record<string, { ha: string; rec: string; cli: string }> = {
  "25/26": { ha: "ha2526", rec: "rec2526", cli: "cli2526" },
  "26/27": { ha: "ha2627", rec: "rec2627", cli: "cli2627" },
};

const getSeason: ToolHandler = async (db, args) => {
  const safra = str(args, "safra");
  if (!safra) {
    return { disponivel: true, encontrado: false, motivo: "Informe a safra (ex.: 26/27)." };
  }

  const { data: sf, error } = await db
    .from("bi_safras")
    .select("safra_label, receita, custo_competencia")
    .eq("safra_label", safra)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`bi_safras: ${error.message}`);
  if (!sf) {
    return {
      disponivel: true,
      encontrado: false,
      motivo: `Safra "${safra}" não encontrada. Disponíveis: 24/25, 25/26, 26/27, 27/28.`,
    };
  }
  const s = sf as Record<string, unknown>;

  // serviços da safra: só existem colunas para 25/26 e 26/27.
  const cols = SEASON_COLS[safra];
  let servicos: Array<Record<string, number | string>> = [];
  let aviso: string | undefined;
  if (cols) {
    const rows = await db
      .from("bi_servicos")
      .select(`nome, ${cols.ha}, ${cols.rec}, ${cols.cli}`)
      .then((r) => (r.error ? [] : (r.data ?? [])) as Record<string, unknown>[]);
    servicos = rows
      .map((r) => ({
        nome: String(r.nome),
        ha: num(r[cols.ha]),
        receita: num(r[cols.rec]),
        clientes: num(r[cols.cli]),
      }))
      .filter((r) => r.ha > 0 || r.receita > 0 || r.clientes > 0);
  } else {
    aviso = `Não há detalhamento de serviços por safra para ${safra} (apenas 25/26 e 26/27).`;
  }

  return {
    disponivel: true,
    encontrado: true,
    aviso,
    dados: {
      safra: String(s.safra_label),
      receita: num(s.receita),
      custo: num(s.custo_competencia),
      servicos,
    },
  };
};

// ---- get_costs ---------------------------------------------------------

const getCosts: ToolHandler = async (db, args) => {
  const ano = intOrNull(args, "ano");
  const categoria = str(args, "categoria");

  // por categoria (agregado anual)
  let catQ = db.from("bi_custo_categoria").select("ano, categoria, valor");
  if (ano !== null) catQ = catQ.eq("ano", ano);
  if (categoria) catQ = catQ.ilike("categoria", `%${likeLiteral(categoria)}%`);
  const catRows = await catQ.then((r) =>
    (r.error ? [] : (r.data ?? [])) as Record<string, unknown>[]
  );
  const por_categoria = catRows.map((r) => ({
    ano: r.ano ?? null,
    categoria: String(r.categoria),
    valor: num(r.valor),
  }));

  // por mês (real) — bi_custos_mensais
  const mesRows = await db
    .from("bi_custos_mensais")
    .select("mes, idx, valor")
    .then((r) => (r.error ? [] : (r.data ?? [])) as Record<string, unknown>[]);
  const mesMap = new Map<string, { idx: number; valor: number }>();
  for (const r of mesRows) {
    const mes = String(r.mes);
    const cur = mesMap.get(mes) ?? { idx: num(r.idx), valor: 0 };
    cur.valor += num(r.valor);
    mesMap.set(mes, cur);
  }
  const por_mes = [...mesMap.entries()]
    .map(([mes, v]) => ({ mes, idx: v.idx, valor: v.valor }))
    .sort((a, b) => a.idx - b.idx)
    .map(({ mes, valor }) => ({ mes, valor }));

  const total_real = por_mes.reduce((s, m) => s + m.valor, 0);

  // projetado — bi_proj_gastos
  const projRows = await db
    .from("bi_proj_gastos")
    .select("gasto")
    .then((r) => (r.error ? [] : (r.data ?? [])) as Record<string, unknown>[]);
  const total_projetado = projRows.reduce((s, r) => s + num(r.gasto), 0);

  const encontrado = por_categoria.length > 0 || por_mes.length > 0;
  if (!encontrado) {
    return {
      disponivel: true,
      encontrado: false,
      motivo: ano !== null || categoria
        ? "Nenhum custo encontrado para os filtros informados."
        : "Nenhum custo cadastrado.",
    };
  }

  return {
    disponivel: true,
    encontrado: true,
    dados: {
      total: total_real,
      por_categoria,
      por_mes,
      real_vs_projetado: {
        real: total_real,
        projetado: total_projetado,
        diferenca: total_real - total_projetado,
      },
    },
  };
};

// ---- get_collection_status (só agregado — sem ponto/amostra) -----------

const getCollectionStatus: ToolHandler = async (db) => {
  const sitRows = await db
    .from("bi_operacao_situacao")
    .select("situacao, valor")
    .then((r) => (r.error ? [] : (r.data ?? [])) as Record<string, unknown>[]);
  const etapaRows = await db
    .from("bi_operacao_etapas")
    .select("etapa, andamento, concluido, pendente")
    .then((r) => (r.error ? [] : (r.data ?? [])) as Record<string, unknown>[]);

  const situacoes = sitRows.map((r) => ({
    situacao: String(r.situacao),
    valor: num(r.valor),
  }));
  const etapas = etapaRows.map((r) => ({
    etapa: String(r.etapa),
    andamento: num(r.andamento),
    concluido: num(r.concluido),
    pendente: num(r.pendente),
  }));

  if (situacoes.length === 0 && etapas.length === 0) {
    return {
      disponivel: true,
      encontrado: false,
      motivo: "Sem dados de operação/coleta no momento.",
    };
  }

  return {
    disponivel: true,
    encontrado: true,
    aviso:
      "Cobertura apenas AGREGADA (situação/etapas). Esta plataforma não tem coleta por ponto/amostra nem por talhão.",
    dados: { situacoes, etapas },
  };
};

// ---- search_knowledge (RAG) --------------------------------------------
// Recuperação semântica na Base de Conhecimento. Só retorna trechos de
// documentos APROVADos e INDEXADos do próprio usuário (RLS via ctx.retrieve).
// Sempre informa quais documentos (fontes) foram usados.

const searchKnowledge: ToolHandler = async (_db, args, ctx) => {
  const consulta = str(args, "consulta");
  const limite = Math.min(Math.max(intOrNull(args, "limite") ?? 5, 1), 10);
  if (!consulta) {
    return { disponivel: true, encontrado: false, motivo: "Informe a consulta." };
  }
  if (!ctx.retrieve) {
    return {
      disponivel: false,
      encontrado: false,
      motivo: "Recuperação de conhecimento indisponível neste contexto.",
    };
  }

  let hits: KnowledgeHit[];
  try {
    hits = await ctx.retrieve(consulta, limite);
  } catch (e) {
    throw new Error(`retrieve: ${(e as Error).message}`);
  }

  if (!hits.length) {
    return {
      disponivel: true,
      encontrado: false,
      motivo:
        "Nenhum documento aprovado da Base de Conhecimento é relevante para essa pergunta.",
    };
  }

  // fontes únicas (para citar quais documentos foram utilizados).
  const fontesMap = new Map<string, { doc_id: string; titulo: string; fonte: string | null }>();
  for (const h of hits) {
    if (!fontesMap.has(h.doc_id)) {
      fontesMap.set(h.doc_id, { doc_id: h.doc_id, titulo: h.titulo, fonte: h.fonte });
    }
  }

  return {
    disponivel: true,
    encontrado: true,
    dados: {
      trechos: hits.map((h) => ({
        trecho: h.trecho,
        fonte: { doc_id: h.doc_id, titulo: h.titulo, fonte: h.fonte, idx: h.idx },
      })),
      fontes: [...fontesMap.values()],
    },
  };
};

// ---- recall_memory (READ) — só memória VALIDADA ------------------------
// Recupera memória contextual JÁ VALIDADA do próprio usuário (RLS). Nunca
// devolve PENDING_REVIEW/INVALIDATED — o que não é oficial não vira contexto.

const recallMemory: ToolHandler = async (db, args) => {
  const consulta = str(args, "consulta");
  const entity_id = str(args, "entity_id");
  const limite = Math.min(Math.max(intOrNull(args, "limite") ?? 8, 1), 20);

  let q = db
    .from("ai_memory")
    .select("entity_type, entity_id, memory_type, content, confidence")
    .eq("status", "VALIDATED");
  if (consulta) q = q.ilike("content", `%${likeLiteral(consulta)}%`);
  if (entity_id) q = q.eq("entity_id", entity_id);

  const rows = await q
    .order("confidence", { ascending: false })
    .limit(limite)
    .then((r) => (r.error ? [] : (r.data ?? [])) as Record<string, unknown>[]);

  if (!rows.length) {
    return {
      disponivel: true,
      encontrado: false,
      motivo: "Nenhuma memória validada relevante.",
    };
  }
  return {
    disponivel: true,
    encontrado: true,
    dados: {
      memorias: rows.map((r) => ({
        entity_type: r.entity_type ?? null,
        entity_id: r.entity_id ?? null,
        memory_type: String(r.memory_type),
        content: String(r.content),
        confidence: num(r.confidence),
      })),
    },
  };
};

// ---- propose_memory (SAFE_WRITE) — a IA PROPÕE, nunca oficializa --------
// Grava uma memória como PENDING_REVIEW. Tipos agronômicos críticos e toda
// proposta da IA exigem validação humana (regra + trigger no banco).

const proposeMemory: ToolHandler = async (_db, args, ctx) => {
  const memory_type = str(args, "memory_type");
  const content = str(args, "content");
  const entity_type = str(args, "entity_type") || null;
  const entity_id = str(args, "entity_id") || null;
  const confRaw = intOrNull(args, "confidence");
  const confidence = confRaw === null ? 0.5 : Math.min(Math.max(confRaw / 100, 0), 1);

  if (!memory_type || !content) {
    return {
      disponivel: true,
      encontrado: false,
      motivo: "Informe memory_type e content.",
    };
  }
  if (!ctx.proposeMemory) {
    return {
      disponivel: false,
      encontrado: false,
      motivo: "Escrita de memória indisponível neste contexto.",
    };
  }

  const res = await ctx.proposeMemory({
    memory_type,
    content,
    entity_type,
    entity_id,
    confidence,
  });
  return {
    disponivel: true,
    encontrado: true,
    aviso: isCriticalMemory(memory_type)
      ? "Memória agronômica: fica PENDENTE até validação humana."
      : "Proposta registrada como PENDENTE — não é usada até ser validada.",
    dados: {
      id: res.id,
      status: res.status,
      exige_validacao: res.exige_validacao,
    },
  };
};

// ---- stubs honestos: entidades sem fonte de dados nesta plataforma -----

const STUB_MOTIVO: Record<string, string> = {
  get_farm:
    "Esta plataforma não possui cadastro de fazendas (não há tabela de fazendas). Trabalhamos por CLIENTE e por SAFRA (rótulo global).",
  get_field:
    "Esta plataforma não possui cadastro de talhões/campos (não há tabela de talhões). A análise fina por talhão não está disponível.",
  get_soil_analysis:
    "Esta plataforma não possui resultados de análise de solo (não há tabela de análises). Nenhum valor de solo pode ser fornecido.",
};

function stubHandler(name: string): ToolHandler {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (_db, _args, _ctx) =>
    Promise.resolve(NOT_AVAILABLE(STUB_MOTIVO[name]));
}

// ---- registry ----------------------------------------------------------

export const READ_TOOLS: ToolDef[] = [
  {
    name: "get_client",
    description:
      "Dados de um cliente da carteira DF AGRO (receita, hectares, grupo, visitas, serviços marcados). Fonte: bi_clientes/bi_visitas/bi_cross_sell.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome (ou parte) do cliente." },
      },
      required: ["nome"],
      additionalProperties: false,
    },
    nivel: "READ",
    handler: getClient,
  },
  {
    name: "get_season",
    description:
      "Visão de uma safra (receita, custo, serviços). Safra é um rótulo GLOBAL (24/25…27/28), não por talhão. Fonte: bi_safras/bi_servicos.",
    input_schema: {
      type: "object",
      properties: {
        safra: { type: "string", description: "Rótulo da safra, ex.: 26/27." },
      },
      required: ["safra"],
      additionalProperties: false,
    },
    nivel: "READ",
    handler: getSeason,
  },
  {
    name: "get_costs",
    description:
      "Custos por período/categoria: total real, por categoria, por mês e real vs projetado. Fonte: bi_custos_mensais/bi_custo_categoria/bi_proj_gastos.",
    input_schema: {
      type: "object",
      properties: {
        ano: { type: "integer", description: "Ano (opcional), ex.: 2026." },
        categoria: { type: "string", description: "Categoria (opcional)." },
      },
      required: [],
      additionalProperties: false,
    },
    nivel: "READ",
    handler: getCosts,
  },
  {
    name: "get_collection_status",
    description:
      "Situação AGREGADA das operações/coleta (por situação e por etapa). Não há dado por ponto/amostra nem por talhão. Fonte: bi_operacao_situacao/bi_operacao_etapas.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    nivel: "READ",
    handler: getCollectionStatus,
  },
  {
    name: "search_knowledge",
    description:
      "Busca semântica na Base de Conhecimento (documentos técnicos aprovados). Use para perguntas conceituais/procedimentais. Retorna trechos e as FONTES (documentos) usadas — cite-as na resposta.",
    input_schema: {
      type: "object",
      properties: {
        consulta: { type: "string", description: "Pergunta ou termos a buscar." },
        limite: { type: "integer", description: "Máx. de trechos (1–10, padrão 5)." },
      },
      required: ["consulta"],
      additionalProperties: false,
    },
    nivel: "READ",
    handler: searchKnowledge,
  },
  {
    name: "recall_memory",
    description:
      "Recupera MEMÓRIA VALIDADA (fatos/preferências confirmados) do usuário para contextualizar a resposta. Nunca traz memória pendente ou invalidada.",
    input_schema: {
      type: "object",
      properties: {
        consulta: { type: "string", description: "Termos a buscar no conteúdo (opcional)." },
        entity_id: { type: "string", description: "Entidade (ex.: nome do cliente) (opcional)." },
        limite: { type: "integer", description: "Máx. de itens (1–20, padrão 8)." },
      },
      required: [],
      additionalProperties: false,
    },
    nivel: "READ",
    handler: recallMemory,
  },
  {
    name: "propose_memory",
    description:
      "PROPÕE uma nova memória (fato/preferência) para revisão humana. NÃO oficializa nada: fica PENDING_REVIEW. Informações agronômicas exigem validação. Use quando o usuário confirmar algo digno de lembrar.",
    input_schema: {
      type: "object",
      properties: {
        memory_type: { type: "string", description: "Ex.: preferencia, fato, conhecimento, recomendacao_agronomica." },
        content: { type: "string", description: "O que lembrar (texto)." },
        entity_type: { type: "string", description: "Ex.: cliente, safra, servico (opcional)." },
        entity_id: { type: "string", description: "Ex.: nome do cliente (opcional)." },
        confidence: { type: "integer", description: "Confiança 0–100 (opcional)." },
      },
      required: ["memory_type", "content"],
      additionalProperties: false,
    },
    nivel: "SAFE_WRITE",
    handler: proposeMemory,
  },
  {
    name: "get_farm",
    description:
      "Dados de uma fazenda. INDISPONÍVEL nesta plataforma (não há cadastro de fazendas). Sempre retorna disponivel=false.",
    input_schema: {
      type: "object",
      properties: { nome: { type: "string" } },
      required: [],
      additionalProperties: false,
    },
    nivel: "READ",
    handler: stubHandler("get_farm"),
  },
  {
    name: "get_field",
    description:
      "Dados de um talhão/campo. INDISPONÍVEL nesta plataforma (não há cadastro de talhões). Sempre retorna disponivel=false.",
    input_schema: {
      type: "object",
      properties: { nome: { type: "string" } },
      required: [],
      additionalProperties: false,
    },
    nivel: "READ",
    handler: stubHandler("get_field"),
  },
  {
    name: "get_soil_analysis",
    description:
      "Resultados de análise de solo. INDISPONÍVEL nesta plataforma (não há dados de análise de solo). Sempre retorna disponivel=false.",
    input_schema: {
      type: "object",
      properties: { talhao: { type: "string" } },
      required: [],
      additionalProperties: false,
    },
    nivel: "READ",
    handler: stubHandler("get_soil_analysis"),
  },
];

export const READ_TOOLS_BY_NAME: Map<string, ToolDef> = new Map(
  READ_TOOLS.map((t) => [t.name, t]),
);

/** Nível de permissão de uma tool (READ por padrão se desconhecida). */
export function toolNivel(name: string): "READ" | "SAFE_WRITE" {
  return READ_TOOLS_BY_NAME.get(name)?.nivel ?? "READ";
}

/** Especificações no formato Anthropic (sem os handlers). */
export function toolSpecs() {
  return READ_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

/**
 * Executa uma tool pelo nome, com o db JÁ escopado pelo usuário.
 * NUNCA recebe/aceita SQL do modelo — só o nome + args do schema.
 */
export async function runReadTool(
  db: Db,
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const def = READ_TOOLS_BY_NAME.get(name);
  if (!def) {
    return {
      disponivel: false,
      encontrado: false,
      motivo: `Ferramenta desconhecida: ${name}.`,
    };
  }
  return await def.handler(db, args ?? {}, ctx);
}
