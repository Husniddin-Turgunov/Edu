/**
 * lib/excel/parse.ts
 *
 * `.xlsx` faylni dvigotel uchun `Sheet[]` ko'rinishiga o'giradi.
 *
 * ExcelJS ishlatiladi (loyihada allaqachon bog'liq). Muhim nuqta:
 *  - FORMULA kataklari saqlanadi (`f`), qiymat emas — hisob bizni
 *    o'zimiz qilamiz (Excelning qanday qat'iy hisoblaganini
 *    taxmin qilishdan ko'ra ishonchli).
 *  - Merged kataklar (birlashgan) faqat yuqori-chap katakda saqlanadi.
 */

import ExcelJS from "exceljs";
import type { Cell, Sheet } from "./engine";

function toRef(col: number, row: number): string {
  let s = "";
  let c = col + 1;
  while (c > 0) {
    const r = (c - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    c = Math.floor((c - 1) / 26);
  }
  return `${s}${row + 1}`;
}

/** ExcelJS katagini bizning Cell ko'rinishiga o'giradi. */
function convert(value: any): Cell | null {
  if (value == null) return null;

  // Formula
  if (typeof value === "object") {
    const f = value.formula || value.sharedFormula;
    if (f) {
      const res = value.result;
      const t: Cell["t"] = typeof res === "number" ? "n" : typeof res === "boolean" ? "b" : "s";
      return { t, v: (res ?? "") as any, f: `=${f}` };
    }
    if (value.richText) {
      const s = value.richText.map((r: any) => r.text).join("");
      return s ? { t: "s", v: s } : null;
    }
    if (value.text !== undefined) {
      return value.text === "" ? null : { t: "s", v: String(value.text) };
    }
    if (value.error) return { t: "s", v: String(value.error) };
    if (value instanceof Date) return { t: "s", v: value.toISOString().slice(0, 10) };
    return null;
  }

  if (typeof value === "number") return { t: "n", v: value };
  if (typeof value === "boolean") return { t: "b", v: value };
  const s = String(value).trim();
  return s ? { t: "s", v: s } : null;
}

export async function parseXlsx(input: ArrayBuffer | Buffer, fileName = ""): Promise<Sheet[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(input as ArrayBuffer);
  const out: Sheet[] = [];

  for (const ws of wb.worksheets) {
    const cells: Record<string, Cell> = {};
    let maxCol = 0;
    let maxRow = 0;

    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell, colNo) => {
        const c = convert(cell.value);
        if (!c) return;
        // ExcelJS tiplari qat'iy emas — aniq raqamga o'tkazamiz
        const col = Number(colNo);
        const r = Number((cell as any).row);
        cells[toRef(col - 1, r - 1)] = c;
        if (col > maxCol) maxCol = col;
        if (r > maxRow) maxRow = r;
      });
    });

    out.push({
      name: ws.name || fileName || `Sheet${out.length + 1}`,
      rows: Math.max(maxRow, 1),
      cols: Math.max(maxCol, 1),
      cells,
    });
  }

  return out;
}

/** Sheetlarni oddiy JSON matn sifatida saqlash uchun. */
export function serializeSheets(sheets: Sheet[]): string {
  return JSON.stringify(sheets);
}

export function deserializeSheets(json: string): Sheet[] {
  try {
    const data = JSON.parse(json);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}