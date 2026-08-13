// Testes da lógica do Approval Engine (bun test).
import { expect, test } from "bun:test";
import {
  ACTION_TOOLS,
  canDecide,
  canExecuteSafe,
  canPropose,
  decisionToStatus,
  defaultRisk,
  isForbiddenAction,
  toolClass,
} from "./approval_logic.ts";

test("classes das ferramentas", () => {
  expect(toolClass("create_internal_alert")).toBe("SAFE_WRITE");
  expect(toolClass("create_task")).toBe("SAFE_WRITE");
  expect(toolClass("generate_report_draft")).toBe("SAFE_WRITE");
  expect(toolClass("send_external_whatsapp_message")).toBe("SENSITIVE_WRITE");
  expect(toolClass("ferramenta_inexistente")).toBe(null);
});

test("ações proibidas nunca são permitidas", () => {
  expect(isForbiddenAction("delete_cliente")).toBe(true);
  expect(isForbiddenAction("apagar_lancamento")).toBe(true);
  expect(isForbiddenAction("alterar_financeiro")).toBe(true);
  expect(isForbiddenAction("recomendacao_agronomica_final")).toBe(true);
  expect(toolClass("delete_cliente")).toBe(null);
  expect(isForbiddenAction("create_task")).toBe(false);
});

test("permissões: SAFE_WRITE = editor/admin; decidir = só admin", () => {
  expect(canExecuteSafe("editor")).toBe(true);
  expect(canExecuteSafe("admin")).toBe(true);
  expect(canExecuteSafe("leitor")).toBe(false);
  expect(canPropose("editor")).toBe(true);
  expect(canPropose("leitor")).toBe(false);
  expect(canDecide("admin")).toBe(true);
  expect(canDecide("editor")).toBe(false);
  expect(canDecide("leitor")).toBe(false);
});

test("risco padrão e máquina de estados da decisão", () => {
  expect(defaultRisk("send_external_whatsapp_message")).toBe("alto");
  expect(defaultRisk("create_task")).toBe("medio");
  expect(decisionToStatus("reject")).toBe("rejeitado");
  expect(decisionToStatus("edit")).toBe("pendente");
  expect(decisionToStatus("approve", true)).toBe("executado");
  expect(decisionToStatus("approve", false)).toBe("erro");
});

test("registro só contém ações desta fase (sem sensíveis proibidas)", () => {
  const nomes = Object.keys(ACTION_TOOLS);
  expect(nomes.length).toBe(4);
  expect(nomes.some((n) => isForbiddenAction(n))).toBe(false);
});
