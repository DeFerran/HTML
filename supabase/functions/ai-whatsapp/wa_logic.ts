// WhatsApp — lógica PURA (Fase WHATSAPP). Sem runtime Deno → testável (bun).
// Faz o parsing do webhook, a verificação HMAC da assinatura e utilidades.

export interface InboundMessage {
  wa_message_id: string;
  from: string;
  name: string | null;
  tipo: string;
  texto: string;
  ts: string | null;
}

/** Extrai mensagens de TEXTO recebidas do payload do WhatsApp Cloud API. */
export function parseInboundMessages(body: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const b = body as {
    entry?: Array<{ changes?: Array<{ value?: Record<string, unknown> }> }>;
  };
  for (const entry of b?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = (change?.value ?? {}) as Record<string, unknown>;
      const contacts = (value.contacts ?? []) as Array<Record<string, unknown>>;
      const nameByWa = new Map<string, string>();
      for (const c of contacts) {
        const waId = String(c.wa_id ?? "");
        const nome = (c.profile as { name?: string } | undefined)?.name ?? "";
        if (waId) nameByWa.set(waId, nome);
      }
      const messages = (value.messages ?? []) as Array<Record<string, unknown>>;
      for (const m of messages) {
        const tipo = String(m.type ?? "");
        const from = String(m.from ?? "");
        const id = String(m.id ?? "");
        if (!id || !from) continue;
        let texto = "";
        if (tipo === "text") texto = String((m.text as { body?: string } | undefined)?.body ?? "");
        else if (tipo === "button") texto = String((m.button as { text?: string } | undefined)?.text ?? "");
        else if (tipo === "interactive") {
          const it = m.interactive as { button_reply?: { title?: string }; list_reply?: { title?: string } } | undefined;
          texto = String(it?.button_reply?.title ?? it?.list_reply?.title ?? "");
        }
        out.push({
          wa_message_id: id,
          from,
          name: nameByWa.get(from) ?? null,
          tipo,
          texto,
          ts: m.timestamp ? String(m.timestamp) : null,
        });
      }
    }
  }
  return out;
}

/** HMAC-SHA256 hex (Web Crypto — funciona em Deno e bun). */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verifica a assinatura do webhook: header `sha256=<hex>` = HMAC(appSecret, rawBody).
 * Comparação em tempo constante. Sem segredo ou header → false (rejeita).
 */
export async function verifySignature(
  appSecret: string,
  rawBody: string,
  signatureHeader: string | null | undefined,
): Promise<boolean> {
  if (!appSecret || !signatureHeader) return false;
  const expected = "sha256=" + await hmacSha256Hex(appSecret, rawBody);
  if (signatureHeader.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= signatureHeader.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** Verificação do handshake GET (hub.verify_token). */
export function verifyChallenge(
  params: URLSearchParams,
  expectedToken: string,
): string | null {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode === "subscribe" && token && expectedToken && token === expectedToken) {
    return challenge ?? "";
  }
  return null;
}

export function clampText(s: string, max = 900): string {
  const t = (s ?? "").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}
