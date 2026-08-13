// Regras de domínio da memória (Fase MEMÓRIA). Puro/testável (sem runtime).
//
// Princípio: nada vira "verdade oficial" (VALIDATED) sozinho.
//  - Tipos AGRONÔMICOS críticos SEMPRE exigem validação humana → PENDING_REVIEW.
//  - Toda proposta da IA (source='ia') nasce PENDING_REVIEW.
//  - Só criação MANUAL do usuário, de tipo não-crítico, pode nascer VALIDATED.
// (O trigger ai_memory_guard aplica o mesmo no banco — defesa em profundidade.)

export type MemoryStatus = "VALIDATED" | "PENDING_REVIEW" | "INVALIDATED";

/** Tipos agronômicos importantes que exigem validação (regra definida). */
export const CRITICAL_MEMORY_TYPES = [
  "recomendacao_agronomica",
  "analise_solo",
  "manejo",
  "dose_aplicacao",
  "fertilidade",
  "calagem",
];

export function isCriticalMemory(memoryType: string): boolean {
  return CRITICAL_MEMORY_TYPES.includes((memoryType ?? "").trim().toLowerCase());
}

/**
 * Status inicial de uma memória recém-criada.
 * @param source 'usuario' | 'ia' | 'import'
 * @param requestValidated intenção de já validar (só vale p/ manual não-crítico)
 */
export function initialMemoryStatus(
  memoryType: string,
  source: string,
  requestValidated: boolean,
): MemoryStatus {
  if (isCriticalMemory(memoryType)) return "PENDING_REVIEW";
  if ((source ?? "").toLowerCase() === "ia") return "PENDING_REVIEW";
  return requestValidated ? "VALIDATED" : "PENDING_REVIEW";
}
