// Automation Engine — lógica PURA (Fase AUTOMAÇÕES).
// Sem runtime Deno → testável fora do Edge (bun/node). Separa a decisão
// (CONDITION / retry / dedupe / schedule / resumo) dos efeitos (DB no index.ts).

export type TriggerType = "schedule" | "database_event" | "manual";
export type ActionType = "run_agent" | "create_internal_alert" | "generate_summary";

// -------- CONDITION --------
// condition vazio ({}) => sempre verdadeiro. Caso contrário {campo, op, valor}.
export function evaluateCondition(
  condition: Record<string, unknown> | null | undefined,
  ctx: Record<string, unknown>,
): boolean {
  if (!condition || Object.keys(condition).length === 0) return true;
  const campo = String(condition.campo ?? "");
  const op = String(condition.op ?? "==");
  const alvo = condition.valor;
  if (!campo) return true;
  const atual = ctx[campo];
  const an = typeof atual === "number" ? atual : parseFloat(String(atual));
  const bn = typeof alvo === "number" ? alvo : parseFloat(String(alvo));
  switch (op) {
    case ">": return an > bn;
    case ">=": return an >= bn;
    case "<": return an < bn;
    case "<=": return an <= bn;
    case "!=": return String(atual) !== String(alvo);
    case "contains": return String(atual ?? "").toLowerCase().includes(String(alvo ?? "").toLowerCase());
    case "==":
    default: return String(atual) === String(alvo);
  }
}

// -------- RETRY controlado --------
export function shouldRetry(tentativa: number, maxTentativas: number): boolean {
  return tentativa < maxTentativas;
}
/** Backoff exponencial com teto (segundos): 30, 60, 120, ... até 900. */
export function retryDelaySeconds(tentativa: number): number {
  const base = 30 * Math.pow(2, Math.max(0, tentativa - 1));
  return Math.min(base, 900);
}

// -------- DEDUPE / IDEMPOTÊNCIA --------
export function dedupeManual(ruleId: string, bucket: string): string {
  return `manual:${ruleId}:${bucket}`;
}
export function dedupeSchedule(ruleId: string, dayStr: string): string {
  return `schedule:${ruleId}:${dayStr}`;
}

// -------- SCHEDULE due? --------
// trigger_config.frequencia: 'daily' (padrão). Due se nunca executou ou se a
// última execução foi antes de hoje (comparando a data ISO yyyy-mm-dd).
export function isScheduleDue(
  triggerConfig: Record<string, unknown> | null | undefined,
  ultimaExecIso: string | null | undefined,
  nowIso: string,
): boolean {
  const freq = String((triggerConfig ?? {}).frequencia ?? "daily");
  const today = nowIso.slice(0, 10);
  if (!ultimaExecIso) return true;
  const last = String(ultimaExecIso).slice(0, 10);
  if (freq === "daily") return last < today;
  if (freq === "hourly") return String(ultimaExecIso).slice(0, 13) < nowIso.slice(0, 13);
  return last < today;
}

// -------- ACTION: resumo interno (determinístico, sem LLM, sem custo) --------
export interface DailySummaryData {
  safra: string;
  clientes: number;
  receita: number;
  custo: number;
  docsIndexados: number;
  memoriasValidadas: number;
}
export function buildDailySummary(d: DailySummaryData): string {
  const brl = (n: number) =>
    "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  const margem = (Number(d.receita) || 0) - (Number(d.custo) || 0);
  return [
    `Resumo AP — safra ${d.safra}`,
    `• Clientes na carteira: ${d.clientes}`,
    `• Receita da safra: ${brl(d.receita)}`,
    `• Custo (competência): ${brl(d.custo)}`,
    `• Margem estimada: ${brl(margem)}`,
    `• Base de conhecimento: ${d.docsIndexados} documento(s) indexado(s)`,
    `• Memória validada: ${d.memoriasValidadas} item(ns)`,
    `Resumo interno gerado automaticamente — não é recomendação nem ação financeira.`,
  ].join("\n");
}
