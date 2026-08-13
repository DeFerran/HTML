// ai-knowledge (Edge Function) — Fase RAG.
// Ingestão e busca da Base de Conhecimento. Embeddings via modelo NATIVO do
// Supabase Edge (gte-small, 384 dim) — sem chave externa, sem custo extra.
//
// Segurança:
//   - verify_jwt=true + auth.getUser() + is_membro_ativo() (mesmo RBAC do painel).
//   - todas as leituras/escritas usam o JWT do usuário → a RLS é a barreira de tenant.
//   - só processa documentos do próprio usuário; a busca só devolve docs APROVADos.
//   - NÃO indexa nada automaticamente: processa apenas o doc_id que o usuário pediu.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { chunkText, normalizeText } from "./chunking.ts";

const EMPRESA = "DF AGRO";
const MAX_DOC_CHARS = 200_000; // teto por documento (validação)
const MAX_CHUNKS = 400; // teto de chunks por documento
const EMB_MODEL = "gte-small"; // 384 dim (nativo do Edge Runtime)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
function err(code: string, message: string) {
  return { error: { code, message } };
}

// deno-lint-ignore no-explicit-any
const SB_AI = (globalThis as any).Supabase?.ai;

async function embed(text: string): Promise<number[]> {
  if (!SB_AI) throw new Error("Supabase.ai indisponível no runtime.");
  const session = new SB_AI.Session(EMB_MODEL);
  const out = await session.run(text, { mean_pool: true, normalize: true });
  return out as number[];
}

function vecLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, err("method_not_allowed", "Use POST."));

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json(401, err("unauthorized", "Token ausente."));

  const sb = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await sb.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return json(401, err("unauthorized", "Sessão inválida."));

  const { data: ativo, error: ativoErr } = await sb.rpc("is_membro_ativo");
  if (ativoErr) return json(500, err("rbac_error", "Falha ao verificar acesso."));
  if (ativo !== true) {
    return json(403, err("forbidden", "Acesso não liberado pelo administrador."));
  }

  let body: { action?: unknown; doc_id?: unknown; consulta?: unknown; limite?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, err("bad_request", "Corpo JSON inválido."));
  }
  const action = typeof body.action === "string" ? body.action : "";

  try {
    // -------- PROCESS (ingestão/reprocessamento de UM documento) --------
    if (action === "process") {
      const docId = typeof body.doc_id === "string" ? body.doc_id : "";
      if (!docId) return json(400, err("bad_request", "doc_id é obrigatório."));

      const { data: doc, error: docErr } = await sb
        .from("ai_knowledge_docs")
        .select("id, titulo, fonte, conteudo, status")
        .eq("id", docId)
        .maybeSingle();
      if (docErr) throw new Error(docErr.message);
      if (!doc) return json(404, err("not_found", "Documento não encontrado."));

      const conteudo = normalizeText(String(doc.conteudo ?? ""));
      if (!conteudo) {
        await sb.from("ai_knowledge_docs")
          .update({ status: "erro", erro: "Documento sem conteúdo.", atualizado_em: new Date().toISOString() })
          .eq("id", docId);
        return json(422, err("empty", "Documento sem conteúdo para processar."));
      }
      if (conteudo.length > MAX_DOC_CHARS) {
        return json(413, err("too_large", `Documento excede ${MAX_DOC_CHARS} caracteres.`));
      }

      await sb.from("ai_knowledge_docs")
        .update({ status: "processando", erro: null, atualizado_em: new Date().toISOString() })
        .eq("id", docId);

      // reprocesso: limpa chunks anteriores (RLS garante que são do usuário).
      await sb.from("ai_knowledge_chunks").delete().eq("doc_id", docId);

      const chunks = chunkText(conteudo).slice(0, MAX_CHUNKS);
      if (!chunks.length) {
        await sb.from("ai_knowledge_docs")
          .update({ status: "erro", erro: "Não foi possível gerar chunks.", atualizado_em: new Date().toISOString() })
          .eq("id", docId);
        return json(422, err("no_chunks", "Não foi possível gerar chunks."));
      }

      const rows = [];
      for (const c of chunks) {
        const v = await embed(c.trecho);
        rows.push({
          doc_id: docId,
          empresa: EMPRESA,
          idx: c.idx,
          trecho: c.trecho,
          // metadados suficientes para identificar a fonte de cada chunk.
          metadados: { doc_id: docId, titulo: doc.titulo, fonte: doc.fonte ?? null, idx: c.idx },
          embedding: vecLiteral(v),
        });
      }

      const { error: insErr } = await sb.from("ai_knowledge_chunks").insert(rows);
      if (insErr) throw new Error(insErr.message);

      await sb.from("ai_knowledge_docs")
        .update({ status: "indexado", n_chunks: rows.length, erro: null, atualizado_em: new Date().toISOString() })
        .eq("id", docId);

      return json(200, { ok: true, doc_id: docId, n_chunks: rows.length });
    }

    // -------- SEARCH (recuperação semântica) --------
    if (action === "search") {
      const consulta = typeof body.consulta === "string" ? body.consulta.trim() : "";
      const limite = Math.min(Math.max(Number(body.limite) || 5, 1), 20);
      if (!consulta) return json(400, err("bad_request", "consulta é obrigatória."));

      const qv = await embed(consulta);
      const { data: hits, error: rpcErr } = await sb.rpc("match_ai_knowledge", {
        query_embedding: vecLiteral(qv),
        match_count: limite,
      });
      if (rpcErr) throw new Error(rpcErr.message);

      const resultados = (hits ?? []) as Array<Record<string, unknown>>;
      const fontesMap = new Map<string, { doc_id: string; titulo: string; fonte: string | null }>();
      for (const h of resultados) {
        const id = String(h.doc_id);
        if (!fontesMap.has(id)) {
          fontesMap.set(id, { doc_id: id, titulo: String(h.titulo), fonte: (h.fonte as string) ?? null });
        }
      }
      return json(200, {
        ok: true,
        resultados,
        fontes: [...fontesMap.values()],
      });
    }

    return json(400, err("bad_request", "action inválida (use 'process' ou 'search')."));
  } catch (e) {
    return json(500, err("internal", (e as Error).message ?? "erro"));
  }
});
