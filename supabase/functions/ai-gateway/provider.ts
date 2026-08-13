// AI provider abstraction (Fase FOUNDATION).
// Contrato mínimo que qualquer provedor de LLM deve cumprir. Mantém o gateway
// independente do fornecedor — trocar de provider não muda o gateway.

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ProviderRequest {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  timeoutMs: number;
}

export interface ProviderResult {
  text: string;
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
  /** Uma única passada de conclusão (sem tools nesta fase). */
  complete(req: ProviderRequest): Promise<ProviderResult>;
}
