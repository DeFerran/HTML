// READ TOOLS — tipos e contrato (Fase READ TOOLS).
// Só tipos: este arquivo não importa nada de runtime, para que os handlers
// possam ser testados fora do Deno (bun/node) com um Db falso.

/** Subconjunto do query builder do supabase-js que as tools usam. */
export interface QueryBuilder {
  select(cols: string): QueryBuilder;
  eq(col: string, val: unknown): QueryBuilder;
  ilike(col: string, val: string): QueryBuilder;
  order(col: string, opts?: { ascending?: boolean }): QueryBuilder;
  limit(n: number): QueryBuilder;
  maybeSingle(): Promise<{ data: unknown; error: { message: string } | null }>;
  then<R>(
    onfulfilled: (
      v: { data: unknown[] | null; error: { message: string } | null },
    ) => R,
  ): Promise<R>;
}

/** Cliente de banco já ESCOPADO pelo JWT do usuário (a RLS é a barreira). */
export interface Db {
  from(table: string): QueryBuilder;
}

/** Um trecho recuperado da base de conhecimento (RAG). */
export interface KnowledgeHit {
  doc_id: string;
  titulo: string;
  fonte: string | null;
  idx: number;
  trecho: string;
  distancia: number;
}

/** Proposta de memória feita pela IA (nunca nasce validada). */
export interface ProposeMemoryInput {
  memory_type: string;
  content: string;
  entity_type?: string | null;
  entity_id?: string | null;
  confidence?: number;
}
export interface ProposeMemoryResult {
  id: string;
  status: string;
  exige_validacao: boolean;
}

/**
 * Contexto de execução da tool. Vem do gateway (nunca do modelo).
 * A IA JAMAIS fornece user_id/empresa — eles saem do JWT + config do backend.
 */
export interface ToolContext {
  userId: string;
  empresa: string;
  /** Papel do usuário (leitor/editor/admin) — gate de SAFE_WRITE. */
  papel?: string;
  /**
   * Recuperação semântica (RAG). Injetada pelo gateway (embed + RPC sob RLS).
   * Ausente em contexto sem RAG. Só lê documentos aprovados/indexados do usuário.
   */
  retrieve?: (consulta: string, limite: number) => Promise<KnowledgeHit[]>;
  /**
   * Proposta de memória (SAFE_WRITE). Injetada pelo gateway; grava em ai_memory
   * como PENDING_REVIEW (nunca oficial). Ausente = sem escrita de memória.
   */
  proposeMemory?: (m: ProposeMemoryInput) => Promise<ProposeMemoryResult>;
  /**
   * Encaminha ações à Edge Function ai-actions (fonte única de execução SAFE_WRITE
   * e de propostas SENSITIVE_WRITE, com allowlist/guarda/auditoria e RLS).
   */
  callActions?: (
    body: Record<string, unknown>,
  ) => Promise<{ ok: boolean; status: number; data: Record<string, unknown> }>;
}

/** Resultado padronizado de toda READ tool. */
export interface ToolResult {
  /** false quando a plataforma ainda não tem essa fonte de dados. */
  disponivel: boolean;
  /** false quando a entidade consultada não foi encontrada. */
  encontrado?: boolean;
  /** mensagem clara de ausência de dado (req. 9). */
  motivo?: string;
  /** payload tipado específico da tool (só quando disponivel && encontrado). */
  dados?: unknown;
  /** avisos não-fatais (ex.: "apenas nível agregado"). */
  aviso?: string;
}

export type ToolHandler = (
  db: Db,
  args: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<ToolResult>;

/** Definição de uma tool exposta ao modelo (schema Anthropic + handler). */
export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema dos parâmetros (Anthropic `input_schema`). */
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
  /** Nível: READ (todos) · SAFE_WRITE (editor/admin) · SENSITIVE_WRITE (aprovação admin). */
  nivel: "READ" | "SAFE_WRITE" | "SENSITIVE_WRITE";
  handler: ToolHandler;
}
