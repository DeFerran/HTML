// Action Tools + Approval Engine — lógica PURA (Fase APPROVALS). Testável (bun).
// Classes de ação e regras de permissão/decisão, sem efeitos colaterais.

export type ActionClass = "READ" | "SAFE_WRITE" | "SENSITIVE_WRITE";

export interface ActionDef {
  classe: ActionClass;
  entity: string;
  risco?: "baixo" | "medio" | "alto";
}

/** Registro das ACTION tools desta fase (allowlist rígida). */
export const ACTION_TOOLS: Record<string, ActionDef> = {
  // SAFE_WRITE (editor/admin executam direto; reversíveis, internos)
  create_internal_alert: { classe: "SAFE_WRITE", entity: "alerta" },
  create_task: { classe: "SAFE_WRITE", entity: "tarefa" },
  generate_report_draft: { classe: "SAFE_WRITE", entity: "relatorio" },
  // SENSITIVE_WRITE (exigem aprovação humana; nunca executam sozinhas)
  send_external_whatsapp_message: { classe: "SENSITIVE_WRITE", entity: "whatsapp", risco: "alto" },
};

/** Ações proibidas nesta fase (defesa extra além da allowlist). */
const FORBIDDEN = [
  /delete|apagar|excluir|remover/i,
  /financ|pagamento|transfer|cobran/i,
  /(recomenda|agronom).*(final|oficial)/i,
];

export function isForbiddenAction(name: string): boolean {
  const n = String(name ?? "");
  if (FORBIDDEN.some((re) => re.test(n))) return true;
  return false;
}

export function toolClass(name: string): ActionClass | null {
  if (isForbiddenAction(name)) return null;
  return ACTION_TOOLS[name]?.classe ?? null;
}

export function defaultRisk(name: string): "baixo" | "medio" | "alto" {
  return ACTION_TOOLS[name]?.risco ?? "medio";
}

// ---- permissões ----
export function canExecuteSafe(papel: string): boolean {
  return papel === "admin" || papel === "editor";
}
export function canPropose(papel: string): boolean {
  return papel === "admin" || papel === "editor";
}
/** Só ADMIN decide (aprovar/editar/rejeitar) — docs/ai/02 §15. */
export function canDecide(papel: string): boolean {
  return papel === "admin";
}

export type Decision = "approve" | "edit" | "reject";
/** Status resultante ao decidir (approve depende da execução: ok=executado). */
export function decisionToStatus(decision: Decision, execOk?: boolean): string {
  if (decision === "reject") return "rejeitado";
  if (decision === "edit") return "pendente";
  if (decision === "approve") return execOk ? "executado" : "erro";
  return "pendente";
}
