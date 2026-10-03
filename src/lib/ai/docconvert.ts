/**
 * lib/ai/docconvert.ts
 *
 * DocSpec larni bir-biriga o'tkazadi (Excel ⇄ Word ⇄ PDF).
 *
 * Nima uchun kerak: `doc.recreate` vositasi mavjud faylning JSON spec'ini
 * olib, aynan shu ma'lumotdan YANGI fayl qayta quradi. Konversiya shu yerda
 * bajariladi — LLM qayta yozmaydi, shuning uchun natija har doim bir xil
 * chiqadi va modellarning "hallucinatsiyasi"ga yo'l ochilmaydi.
 *
 * Cheklov: PDF spec — jadval/ro'yxat bloklaridan iborat, shuning uchun
 * Word va PDF o'zaro to'liq o'tkaziladi. PDF → Excel uchun bloklar satr
 * sifatida tekislanadi (jadval satrlari saqlanadi).
 */

import type { ExcelSheetSpec, ExcelSpec, PdfSpec, WordBlock, WordSpec } from "./docgen";

const MAX_BLOCKS = 200;
const MAX_ROWS = 500;

function textBlocksToSheetBlocks(rows: string[][]): WordBlock[] {
  return rows.slice(0, MAX_ROWS).map((r) => ({
    type: "table" as const,
    headers: r.length ? r : ["(bo'sh)"],
    rows: [],
  }));
}

/** Excel spec → Word bloklari (har varaq: sarlavha + jadval). */
export function excelToBlocks(spec: ExcelSpec): WordBlock[] {
  const blocks: WordBlock[] = [];
  for (const sh of spec.sheets) {
    blocks.push({ type: "heading", level: 2, text: sh.name });
    const rows: string[][] = (sh.rows || []).slice(0, MAX_ROWS).map((r) => r.map((c) => (c == null ? "" : String(c))));
    blocks.push({ type: "table", headers: (sh.headers || []).map(String), rows });
    if (sh.totalsRow) {
      blocks.push({ type: "paragraph", text: `${sh.totalsRow.label}: ${sh.totalsRow.columns.map((c) => c + 1).join(", ")}` });
    }
    if (sh.chartNote) {
      blocks.push({ type: "bullet", items: [`Diagramma: "${sh.chartNote.title}" (${sh.chartNote.type}) — Excel'da Insert → Chart` ] });
    }
  }
  return blocks.slice(0, MAX_BLOCKS);
}

/** Word bloklari → Excel spec (paragraflar "Matn" varaqiga, jadvallar o'ziga). */
export function blocksToExcel(filename: string, blocks: WordBlock[]): ExcelSpec {
  const textRows: (string | number | null)[][] = [];
  const tables: ExcelSheetSpec[] = [];

  for (const b of blocks) {
    if (b.type === "table" && b.headers?.length) {
      tables.push({
        name: uniqueSheetName(tables.map((t) => t.name), `Jadval ${tables.length + 1}`),
        headers: b.headers.map((h) => String(h)),
        rows: (b.rows || []).slice(0, MAX_ROWS).map((r) => r.map((c) => String(c ?? ""))),
        autofilter: true,
        freezeHeader: true,
      });
    } else if (b.type === "heading" || b.type === "paragraph") {
      textRows.push([String(b.text)]);
    } else if (b.type === "bullet" || b.type === "numbered") {
      for (const item of (b.items || []).slice(0, MAX_ROWS)) textRows.push([String(item)]);
    }
  }

  const sheets: ExcelSheetSpec[] = [];
  if (tables.length) sheets.push(...tables.slice(0, 9));
  if (textRows.length || !sheets.length) {
    sheets.push({
      name: uniqueSheetName(sheets.map((s) => s.name), "Matn"),
      headers: ["Matn"],
      rows: textRows.slice(0, MAX_ROWS),
      autofilter: true,
      freezeHeader: true,
    });
  }
  return { kind: "excel", filename, sheets: sheets.slice(0, 10) };
}

/** PDF → Excel: PDF spec'dagi bloklar xuddi shu tuzilmada, shuning uchun
 *  `blocksToExcel` to'g'ridan-to'g'ri ishlatiladi. */
export function pdfToExcel(filename: string, spec: PdfSpec): ExcelSpec {
  return blocksToExcel(filename, spec.blocks);
}

/** PDF → Word: bloklar o'zgar maydoni emas. */
export function pdfToWord(filename: string, spec: PdfSpec, title?: string, subtitle?: string): WordSpec {
  return { kind: "word", filename, title: title || spec.title, subtitle, blocks: spec.blocks };
}

/** Word → PDF. */
export function wordToPdf(filename: string, spec: WordSpec): PdfSpec {
  return { kind: "pdf", filename, title: spec.title, blocks: spec.blocks };
}

/** Word → Word (nomni yangilash, o'zgarishsiz). */
export function wordToWord(filename: string, spec: WordSpec, title?: string): WordSpec {
  return { ...spec, filename, title: title || spec.title };
}

/** Excel → Excel. */
export function excelToExcel(filename: string, spec: ExcelSpec, title?: string): ExcelSpec {
  return { ...spec, filename, title: title || spec.title };
}

/** Varqa nomi Excel chegarasiga mos va takrorlanmasin. */
function uniqueSheetName(taken: string[], base: string) {
  let name = base.replace(/[*?:/\\[\]]/g, " ").slice(0, 31) || "Varaq";
  let i = 2;
  while (taken.includes(name)) {
    const suffix = ` ${i}`;
    name = `${name.slice(0, 31 - suffix.length)}${suffix}`;
    i++;
  }
  return name;
}

/** Konversiyani bir nuqtadan boshqaradi (tools.ts shu yerga murojaat qiladi). */
export function convertSpec(
  source: ExcelSpec | WordSpec | PdfSpec,
  target: "excel" | "word" | "pdf",
  filename: string,
): ExcelSpec | WordSpec | PdfSpec {
  if (source.kind === "excel") {
    if (target === "excel") return excelToExcel(filename, source);
    const blocks = excelToBlocks(source);
    return target === "word"
      ? { kind: "word", filename, title: source.title, blocks }
      : { kind: "pdf", filename, title: source.title, blocks };
  }
  if (source.kind === "word") {
    if (target === "word") return wordToWord(filename, source);
    if (target === "pdf") return wordToPdf(filename, source);
    return blocksToExcel(filename, source.blocks);
  }
  // source.kind === "pdf"
  if (target === "pdf") return { ...source, filename };
  if (target === "word") return pdfToWord(filename, source);
  return pdfToExcel(filename, source);
}

void textBlocksToSheetBlocks;
