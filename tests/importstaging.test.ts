// Testes do MOTOR DE STAGING DE IMPORTAÇÃO (núcleo puro).
// Extrai os blocos <lanc-service> e <import-staging> do index.html.
// Rodar: bun test tests/importstaging.test.ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
function bloco(nome: string) {
  const A = html.indexOf("// <" + nome + ">");
  const B = html.indexOf("// </" + nome + ">");
  if (A < 0 || B < 0) throw new Error("marcadores <" + nome + "> não encontrados");
  return html.slice(A, B);
}
// deno-lint-ignore no-explicit-any
const S: any = (0, eval)(bloco("lanc-service") + "\n" + bloco("import-staging") + "\nImportStaging");

const CTX_BASE = {
  tipo: "despesa",
  hojeYM: "2026-08",
  existentesKeys: new Set<string>(),
  existentesFp: new Set<string>(),
  validos: {
    clientes: ["Danilo Ferrarezi", "João Silva"],
    categorias: ["Laboratório", "Combustível"],
    centrosCusto: [], colaboradores: [], servicos: [], veiculos: [],
    NATUREZAS: ["Custo operacional direto"], FORMAS_PGTO: ["Pix"], STATUS_LANC: ["Pago"],
  },
};

test("parseTabular: TSV (colado do Excel) com cabeçalho + linhas, ignora vazias", () => {
  const t = "Data\tValor\tCliente\n2026-08-15\t1000\tDanilo Ferrarezi\n\n2026-08-16\t500\tJoão Silva\n";
  const { headers, rows } = S.parseTabular(t);
  expect(headers).toEqual(["Data", "Valor", "Cliente"]);
  expect(rows.length).toBe(2);
  expect(rows[1]).toEqual(["2026-08-16", "500", "João Silva"]);
});

test("parseTabular: CSV com ; e aspas", () => {
  const t = 'Data;Valor;Descrição\n2026-08-15;1000;"Diesel; Hilux"\n';
  const { rows } = S.parseTabular(t);
  expect(rows[0][2]).toBe("Diesel; Hilux");
});

test("mapearColunas: casa por label e por key, acento/caixa-insensível", () => {
  const campos = [{ key: "data", label: "Data" }, { key: "valor", label: "Valor" }, { key: "cliente", label: "Cliente" }];
  const map = S.mapearColunas(["DATA", "valor", "CLIENTE"], campos);
  expect(map).toEqual({ data: 0, valor: 1, cliente: 2 });
});

test("linhaParaRec: converte 1.234,56 → 1234.56", () => {
  const rec = S.linhaParaRec(["2026-08-15", "1.234,56", "Danilo Ferrarezi"], { data: 0, valor: 1, cliente: 2 });
  expect(rec.valor).toBe("1234.56");
});

test("classificar: linha nova (sem correspondência)", () => {
  const { linhas, resumo } = S.classificar([{ data: "2026-08-15", valor: "1000", cliente: "Danilo Ferrarezi", categoria: "Laboratório" }], CTX_BASE);
  expect(linhas[0].status).toBe("nova");
  expect(resumo.nova).toBe(1);
  expect(resumo.total).toBe(1);
});

test("classificar: já existente por chave (reupload)", () => {
  const rec = { data: "2026-08-15", valor: "1000", cliente: "Danilo Ferrarezi", categoria: "Laboratório", __rowKey: "K-001" };
  const ctx = { ...CTX_BASE, existentesKeys: new Set(["K-001"]) };
  const { linhas } = S.classificar([rec], ctx);
  expect(linhas[0].status).toBe("existente");
});

test("classificar: possível duplicidade por fingerprint (mesmo conteúdo já no banco)", () => {
  // fingerprint canônico do mesmo lançamento já existente
  const L = (0, eval)(bloco("lanc-service") + "\nLancService");
  const fp = L.fingerprint({ data: "2026-08-15", valor: 1000, cliente: "Danilo Ferrarezi", categoria: "Laboratório" }, "despesa");
  const ctx = { ...CTX_BASE, existentesFp: new Set([fp]) };
  const { linhas } = S.classificar([{ data: "2026-08-15", valor: "1000", cliente: "Danilo Ferrarezi", categoria: "Laboratório" }], ctx);
  expect(linhas[0].status).toBe("possivel");
});

test("classificar: erro por valor <= 0", () => {
  const { linhas } = S.classificar([{ data: "2026-08-15", valor: "0", cliente: "Danilo Ferrarezi" }], CTX_BASE);
  expect(linhas[0].status).toBe("erro");
  expect(linhas[0].motivos.join(" ")).toContain("valor");
});

test("classificar: erro por cliente inexistente, com sugestão de typo", () => {
  const { linhas } = S.classificar([{ data: "2026-08-15", valor: "100", cliente: "Joao Silva" }], CTX_BASE);
  expect(linhas[0].status).toBe("erro");
  expect(linhas[0].motivos.join(" ")).toContain("João Silva"); // sugestão do nome correto
});

test("classificar: NÃO cria cadastro — nome quase-igual só sugere, marca erro", () => {
  const { linhas } = S.classificar([{ data: "2026-08-15", valor: "100", categoria: "Combustivel" }], CTX_BASE);
  expect(linhas[0].status).toBe("erro");
  expect(linhas[0].motivos.join(" ")).toContain("Combustível");
});

test("classificar: duplicidade DENTRO do arquivo → atenção", () => {
  const linha = { data: "2026-08-15", valor: "100", cliente: "Danilo Ferrarezi", categoria: "Laboratório" };
  const { linhas, resumo } = S.classificar([linha, { ...linha }], CTX_BASE);
  expect(linhas[0].status).toBe("nova");
  expect(linhas[1].status).toBe("atencao");
  expect(resumo.atencao).toBe(1);
});

test("classificar: linha totalmente vazia é ignorada", () => {
  const { linhas, resumo } = S.classificar([{ data: "", valor: "", cliente: "" }, { data: "2026-08-15", valor: "100", cliente: "Danilo Ferrarezi", categoria: "Laboratório" }], CTX_BASE);
  expect(resumo.total).toBe(1);
  expect(linhas.length).toBe(1);
});

test("reconciliação: soma dos status == total classificado", () => {
  const recs = [
    { data: "2026-08-15", valor: "100", cliente: "Danilo Ferrarezi", categoria: "Laboratório" }, // nova
    { data: "2026-08-15", valor: "0", cliente: "Danilo Ferrarezi" }, // erro
    { data: "2026-08-16", valor: "200", cliente: "Fulano Inexistente" }, // erro
    { data: "", valor: "", cliente: "" }, // ignorada
  ];
  const { resumo } = S.classificar(recs, CTX_BASE);
  expect(resumo.total).toBe(3); // vazia não conta
  expect(resumo.nova + resumo.existente + resumo.possivel + resumo.erro + resumo.atencao).toBe(resumo.total);
});
