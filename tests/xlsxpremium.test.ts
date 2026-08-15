// Testes do GERADOR DE XLSX PREMIUM (núcleo puro OOXML + zip).
// Extrai o bloco <xlsx-premium> do index.html.
// Rodar: bun test tests/xlsxpremium.test.ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const A = html.indexOf("// <xlsx-premium>");
const B = html.indexOf("// </xlsx-premium>");
if (A < 0 || B < 0) throw new Error("marcadores <xlsx-premium> não encontrados");
// deno-lint-ignore no-explicit-any
const X: any = (0, eval)(html.slice(A, B) + "\nXlsxPremium");

test("crc32: vetor padrão '123456789' = 0xCBF43926", () => {
  const bytes = new TextEncoder().encode("123456789");
  expect(X.crc32(bytes) >>> 0).toBe(0xcbf43926);
});

test("colName: 1→A, 26→Z, 27→AA, 52→AZ, 53→BA", () => {
  expect(X.colName(1)).toBe("A");
  expect(X.colName(26)).toBe("Z");
  expect(X.colName(27)).toBe("AA");
  expect(X.colName(52)).toBe("AZ");
  expect(X.colName(53)).toBe("BA");
});

test("xmlEsc: escapa & < > \" '", () => {
  expect(X.xmlEsc('a & b < c > d " e \' f')).toBe("a &amp; b &lt; c &gt; d &quot; e &apos; f");
});

test("zipStore/build: gera um zip válido (assinaturas PK e EOCD)", () => {
  const spec = { sheets: [{ name: "Aba1", rows: [[{ v: "x", t: "s", s: 0 }]] }] };
  const out = X.build(spec);
  expect(out instanceof Uint8Array).toBe(true);
  expect(out.length).toBeGreaterThan(200);
  // local file header signature "PK\x03\x04"
  expect([out[0], out[1], out[2], out[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  // End Of Central Directory signature 0x06054b50 nos últimos 22 bytes
  const tail = out.slice(out.length - 22);
  expect([tail[0], tail[1], tail[2], tail[3]]).toEqual([0x50, 0x4b, 0x05, 0x06]);
});

test("sheetXml: congelamento, autofiltro, proteção e validação (dropdown)", () => {
  const xml = X.sheetXml({
    rows: [[{ v: "Cliente", t: "s", s: 1 }], [{ s: 3 }]],
    freezeRow: 1, autofilter: "A1:A1", protect: true,
    validations: [{ sqref: "A2:A201", formula1: "Lista_Clientes" }],
  });
  expect(xml).toContain('state="frozen"');
  expect(xml).toContain('<autoFilter ref="A1:A1"/>');
  expect(xml).toContain("<sheetProtection");
  expect(xml).toContain('type="list"');
  expect(xml).toContain("<formula1>Lista_Clientes</formula1>");
  // célula vazia estilizada não emite valor
  expect(xml).toContain('<c r="A2" s="3"/>');
});

test("workbookXml: nomes de abas + intervalos nomeados (definedNames)", () => {
  const xml = X.workbookXml(["01_INSTRUÇÕES", "02_LANÇAMENTOS"], [{ name: "Lista_Clientes", ref: "'03_REFERÊNCIAS'!$A$2:$A$5" }]);
  expect(xml).toContain('name="02_LANÇAMENTOS"');
  expect(xml).toContain("<definedNames>");
  expect(xml).toContain('name="Lista_Clientes"');
});

test("stylesXml: identidade verde DF AGRO e formatos de moeda/data", () => {
  const s = X.stylesXml();
  expect(s).toContain("0A6A30"); // verde institucional
  expect(s).toContain("164"); // numFmt moeda
  expect(s).toContain("dd/mm/yyyy"); // numFmt data
  expect(s).toContain('locked="0"'); // células de entrada destravadas p/ edição sob proteção
});

test("cell inlineStr: string vai como inlineStr escapada", () => {
  const xml = X.sheetXml({ rows: [[{ v: "A & B", t: "s", s: 0 }]] });
  expect(xml).toContain('t="inlineStr"');
  expect(xml).toContain("A &amp; B");
});

// destrincha um zip STORE (sem compressão) lendo o diretório central
function readStoreZip(u8: Uint8Array) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const eo = u8.length - 22; // EOCD sem comentário
  const count = dv.getUint16(eo + 10, true);
  const cdOff = dv.getUint32(eo + 16, true);
  const files: Record<string, { data: Uint8Array; crc: number }> = {};
  let p = cdOff;
  for (let i = 0; i < count; i++) {
    const crc = dv.getUint32(p + 16, true);
    const usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.slice(p + 46, p + 46 + nlen));
    const lnlen = dv.getUint16(lho + 26, true);
    const lelen = dv.getUint16(lho + 28, true);
    const dataStart = lho + 30 + lnlen + lelen;
    files[name] = { data: u8.slice(dataStart, dataStart + usize), crc };
    p += 46 + nlen + elen + clen;
  }
  return files;
}

test("container completo: partes obrigatórias presentes e CRC íntegro", () => {
  // mini-spec com a mesma forma do modelo real (4 abas, definedNames, proteção/validação)
  const spec = {
    definedNames: [{ name: "Lista_Clientes", ref: "'03_REFERÊNCIAS'!$A$2:$A$3" }],
    sheets: [
      { name: "01_INSTRUÇÕES", rows: [[{ v: "DF AGRO", t: "s", s: X.S.TITLE }]] },
      { name: "02_LANÇAMENTOS", rows: [[{ v: "Cliente", t: "s", s: X.S.HEADER }], [{ s: X.S.IN_TEXT }]],
        freezeRow: 1, autofilter: "A1:A1", protect: true, validations: [{ sqref: "A2:A201", formula1: "Lista_Clientes" }] },
      { name: "03_REFERÊNCIAS", rows: [[{ v: "Clientes", t: "s", s: X.S.REFH }], [{ v: "A", t: "s", s: 0 }]] },
      { name: "04_EXEMPLO", rows: [[{ v: "Cliente", t: "s", s: X.S.HEADER }]] },
    ],
  };
  const out = X.build(spec);
  const files = readStoreZip(out);
  // partes obrigatórias do pacote OOXML
  ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml",
   "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml", "xl/worksheets/sheet3.xml", "xl/worksheets/sheet4.xml"]
    .forEach((n) => expect(files[n]).toBeTruthy());
  // integridade: CRC gravado == CRC recalculado de cada parte
  Object.keys(files).forEach((n) => { expect(X.crc32(files[n].data) >>> 0).toBe(files[n].crc >>> 0); });
  // conteúdo da aba de lançamentos
  const sheet2 = new TextDecoder().decode(files["xl/worksheets/sheet2.xml"].data);
  expect(sheet2).toContain('state="frozen"');
  expect(sheet2).toContain("<sheetProtection");
  expect(sheet2).toContain('type="list"');
  // content-types referencia todas as 4 abas
  const ct = new TextDecoder().decode(files["[Content_Types].xml"].data);
  expect(ct).toContain("sheet4.xml");
});
