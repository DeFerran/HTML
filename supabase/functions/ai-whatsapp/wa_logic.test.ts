// Testes da lógica WhatsApp (bun test).
// Rodar: bun test supabase/functions/ai-whatsapp/wa_logic.test.ts

import { expect, test } from "bun:test";
import {
  clampText,
  hmacSha256Hex,
  parseInboundMessages,
  verifyChallenge,
  verifySignature,
} from "./wa_logic.ts";

const SAMPLE = {
  object: "whatsapp_business_account",
  entry: [{
    id: "WABA_ID",
    changes: [{
      value: {
        messaging_product: "whatsapp",
        metadata: { display_phone_number: "5599999999", phone_number_id: "PNID" },
        contacts: [{ profile: { name: "João Produtor" }, wa_id: "5511988887777" }],
        messages: [{ from: "5511988887777", id: "wamid.ABC123", timestamp: "1699999999", type: "text", text: { body: "Qual a receita da safra 26/27?" } }],
      },
      field: "messages",
    }],
  }],
};

test("parseInboundMessages: extrai id, remetente, nome e texto", () => {
  const msgs = parseInboundMessages(SAMPLE);
  expect(msgs.length).toBe(1);
  expect(msgs[0].wa_message_id).toBe("wamid.ABC123");
  expect(msgs[0].from).toBe("5511988887777");
  expect(msgs[0].name).toBe("João Produtor");
  expect(msgs[0].texto).toContain("receita da safra");
});

test("parseInboundMessages: payload sem mensagens (status) => vazio", () => {
  expect(parseInboundMessages({ entry: [{ changes: [{ value: { statuses: [{}] } }] }] })).toEqual([]);
  expect(parseInboundMessages({})).toEqual([]);
});

test("verifyChallenge: só valida com token correto", () => {
  const ok = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "segredo", "hub.challenge": "123" });
  expect(verifyChallenge(ok, "segredo")).toBe("123");
  const bad = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "errado", "hub.challenge": "123" });
  expect(verifyChallenge(bad, "segredo")).toBe(null);
});

test("verifySignature: aceita assinatura correta e rejeita as demais", async () => {
  const secret = "app_secret_123";
  const raw = JSON.stringify(SAMPLE);
  const good = "sha256=" + await hmacSha256Hex(secret, raw);
  expect(await verifySignature(secret, raw, good)).toBe(true);
  expect(await verifySignature(secret, raw, "sha256=deadbeef")).toBe(false);
  expect(await verifySignature(secret, raw, null)).toBe(false);
  expect(await verifySignature(secret, raw + "x", good)).toBe(false); // corpo adulterado
  expect(await verifySignature("", raw, good)).toBe(false); // sem segredo
});

test("clampText: trunca com reticências", () => {
  expect(clampText("abc", 10)).toBe("abc");
  expect(clampText("a".repeat(20), 10).length).toBe(10);
});
