// Anthropic provider (Fase FOUNDATION + READ TOOLS).
// Fala com a Messages API por fetch cru (sem SDK) — simples e sem dependências
// no runtime edge. A API key vem SOMENTE do ambiente do backend (Deno.env).

import {
  AIProvider,
  ContentBlock,
  ProviderError,
  ProviderRequest,
  ProviderResult,
  ToolUseBlock,
} from "./provider.ts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  readonly model: string;
  #apiKey: string;

  constructor(apiKey: string, model: string) {
    if (!apiKey) {
      throw new ProviderError(
        503,
        "not_configured",
        "ANTHROPIC_API_KEY não configurada no backend.",
      );
    }
    this.#apiKey = apiKey;
    this.model = model;
  }

  async complete(req: ProviderRequest): Promise<ProviderResult> {
    const payload: Record<string, unknown> = {
      model: this.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    };
    if (req.tools && req.tools.length > 0) payload.tools = req.tools;

    let resp: Response;
    try {
      resp = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.#apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(req.timeoutMs),
      });
    } catch (e) {
      // Timeout (AbortSignal.timeout) ou falha de rede.
      const timeout = e instanceof DOMException && e.name === "TimeoutError";
      throw new ProviderError(
        timeout ? 504 : 502,
        timeout ? "timeout" : "network_error",
        timeout
          ? "O modelo demorou demais para responder (timeout)."
          : `Falha de rede ao chamar o provedor: ${(e as Error).message}`,
      );
    }

    if (!resp.ok) {
      let detail = "";
      try {
        const j = await resp.json();
        detail = j?.error?.message ?? JSON.stringify(j);
      } catch {
        detail = await resp.text().catch(() => "");
      }
      // 401/403 = configuração; 429 = limite; demais = upstream.
      const status = resp.status === 429
        ? 429
        : resp.status === 401 || resp.status === 403
        ? 503
        : 502;
      const code = resp.status === 429
        ? "provider_rate_limited"
        : status === 503
        ? "not_configured"
        : "provider_error";
      throw new ProviderError(
        status,
        code,
        `Anthropic ${resp.status}: ${detail}`.slice(0, 500),
      );
    }

    const data = await resp.json();

    // Refusal: o modelo declinou por segurança (HTTP 200).
    if (data.stop_reason === "refusal") {
      throw new ProviderError(
        422,
        "refusal",
        "O modelo recusou responder a esta solicitação.",
      );
    }

    const rawBlocks = (data.content ?? []) as Array<Record<string, unknown>>;
    const content: ContentBlock[] = rawBlocks.map((b) => {
      if (b.type === "tool_use") {
        return {
          type: "tool_use",
          id: String(b.id),
          name: String(b.name),
          input: (b.input ?? {}) as Record<string, unknown>,
        } as ToolUseBlock;
      }
      return { type: "text", text: String(b.text ?? "") };
    });

    const text = content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const toolUses = content.filter(
      (b): b is ToolUseBlock => b.type === "tool_use",
    );

    return {
      text,
      content,
      toolUses,
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      model: data.model ?? this.model,
      stopReason: data.stop_reason ?? "end_turn",
    };
  }
}
