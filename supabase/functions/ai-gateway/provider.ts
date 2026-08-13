// AI provider abstraction (Fase FOUNDATION + READ TOOLS).
// Contrato mínimo que qualquer provedor de LLM deve cumprir. Mantém o gateway
// independente do fornecedor — trocar de provider não muda o gateway.

export type ChatRole = "user" | "assistant";

/** Blocos de conteúdo (formato compatível com a Messages API da Anthropic). */
export interface TextBlock {
  type: "text";
  text: string;
}
export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}
export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface ChatMessage {
  role: ChatRole;
  /** string (texto simples) ou blocos (tool_use/tool_result). */
  content: string | ContentBlock[];
}

/** Especificação de uma tool exposta ao modelo (só schema, sem handler). */
export interface ToolSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ProviderRequest {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  timeoutMs: number;
  /** Tools READ desta fase. Ausente = sem tools (fase FOUNDATION). */
  tools?: ToolSpec[];
}

export interface ProviderResult {
  /** Texto concatenado dos blocos de texto (pode ser vazio num turno de tool). */
  text: string;
  /** Blocos crus retornados pelo assistente (para ecoar no loop de tools). */
  content: ContentBlock[];
  /** Chamadas de tool pedidas neste turno. */
  toolUses: ToolUseBlock[];
  inputTokens: number;
  outputTokens: number;
  model: string;
  stopReason: string;
}

/** Erro estruturado do provedor, com status HTTP a devolver ao cliente. */
export class ProviderError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  /** Uma única passada de conclusão (pode pedir tools; o gateway faz o loop). */
  complete(req: ProviderRequest): Promise<ProviderResult>;
}
