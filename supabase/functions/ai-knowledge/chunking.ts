// Chunking da Base de Conhecimento (Fase RAG).
// Puro (sem runtime Deno) → testável fora do Edge (bun/node).
//
// Estratégia simples e determinística: normaliza o texto, quebra em parágrafos
// e agrupa parágrafos até um alvo de caracteres, com sobreposição para não
// perder contexto na fronteira. Cada chunk carrega seu índice de ordem.

export interface Chunk {
  idx: number;
  trecho: string;
}

export interface ChunkOptions {
  maxChars?: number;
  overlap?: number;
}

/** Normaliza quebras de linha e espaços redundantes, preservando parágrafos. */
export function normalizeText(input: string): string {
  return (input ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}

/**
 * Divide o texto em chunks. Determinístico: a mesma entrada dá a mesma saída.
 * Um parágrafo maior que `maxChars` é fatiado por tamanho (com overlap).
 */
export function chunkText(input: string, opts: ChunkOptions = {}): Chunk[] {
  const maxChars = Math.max(200, opts.maxChars ?? 900);
  const overlap = Math.min(Math.max(0, opts.overlap ?? 150), Math.floor(maxChars / 2));

  const text = normalizeText(input);
  if (!text) return [];

  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  const pieces: string[] = [];
  let buf = "";
  const flush = () => {
    const t = buf.trim();
    if (t) pieces.push(t);
    buf = "";
  };

  for (const para of paras) {
    if (para.length > maxChars) {
      // parágrafo grande: fecha o buffer e fatia por tamanho com overlap.
      flush();
      let start = 0;
      while (start < para.length) {
        const end = Math.min(start + maxChars, para.length);
        pieces.push(para.slice(start, end).trim());
        if (end >= para.length) break;
        start = end - overlap;
      }
      continue;
    }
    if (buf && (buf.length + 2 + para.length) > maxChars) flush();
    buf = buf ? `${buf}\n\n${para}` : para;
  }
  flush();

  return pieces
    .map((trecho) => trecho.trim())
    .filter(Boolean)
    .map((trecho, idx) => ({ idx, trecho }));
}
