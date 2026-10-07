/**
 * lib/excel/analyze.ts
 *
 * JADVAL TUZILMASINI TAHLIL QILADI — qaysi katakka yozish kerak,
 * qaysiga YOZMAYDIGINI aniqlaydi.
 *
 * ASOSIY QOIDA (bu yerda hamma nima kelib chiqadi):
 *   Ustunda SARLAVHA bor va UNING OSTIDA ma'lumot YO'Q → shu ustun
 *   hisoblash uchun BO'SH. Aynan shu kataklar to'ldiriladi.
 *   Ustunda ma'lumot bor → u BERILGAN, tegilmaydi.
 *   Ustunda sarlavha ham, ma'lumot ham yo'q (masalan A) → HECH QACHON
 *   tegilmaydi. Shu sababli AI xaritalarga tasodif raqamlar yozmaydi.
 *
 * Eski yondashuv "qatorida biror narsa bor bo'sh katak" degan qoidani
 * ishlatardi — u A5, A6 kabi xaritalarga ham javob deb qarardi va
 * `A5=1`, `A6=2` kabi TAXMIN qilgan javoblar yozilardi.
 */

import type { Sheet } from "./engine";
import { isCodeHeader, isNameHeader, findNsbu } from "./nsbu";

export type SheetPlan = {
  headerRow: number;
  dataRows: number[];
  totalRows: number[];
  /** Hisoblash uchun bo'sh — sarlavhasi bor, ma'lumoti yo'q. */
  fillableColumns: string[];
  /** Berilgan — ma'lumati bor. */
  givenColumns: string[];
  /** Hech qachon tegilmaydi — sarlavhasi ham, ma'lumoti ham yo'q. */
  lockedColumns: string[];
  /** Sarlavhasi bor lekin MATN ustuni ("Номи", "Бух.счет") — tegilmaydi. */
  textOnlyColumns: string[];
  marked: string[];
  answerCells: string[];
  reason: string;
};

function colName(index: number): string {
  let s = "";
  let c = index + 1;
  while (c > 0) {
    const r = (c - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    c = Math.floor((c - 1) / 26);
  }
  return s;
}

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const code = ch.charCodeAt(0) - 64;
    if (code < 1 || code > 26) break;
    n = n * 26 + code;
  }
  return n - 1;
}

function rowOf(ref: string): number {
  return Number(ref.replace(/^[A-Z]+/, ""));
}

const TOTAL_WORDS = /итого|общ|жами|barary|total/i;

/** Yozma izoh: bitta katak, uzun matn, nolon o'qi bor. */
function isNoteRow(list: string[], cells: Record<string, { v: any }>): boolean {
  if (list.length !== 1) return false;
  const v = String(cells[list[0]]?.v ?? "").trim();
  return v.length > 24 && /\s/.test(v) && /[:.]/.test(v);
}

/** Sarlavha deb hisoblanadigan matnmi? */
function isLabel(v: any): boolean {
  const s = String(v ?? "").trim();
  if (!s || s === "?") return false;
  return !/^[\d\s.,-]+$/.test(s);
}

/**
 * HISOBLANADIGAN ustun sarlavhasi.
 *
 * Faqat shu so'zlar bilan ifodalangan ustunlar to'ldiriladi. Boshqalari
 * — matn yoki tavsif ustuni — HECH QACHON tegilmaydi.
 *
 * Sabab: "Номи" (nom), "Бух.счет" (hisob raqami) kabi ustunlarda
 * hisob YO'Q. Ular berilgan ma'lumot yoki imtihon savolining matni.
 * AI ularga `assa`, `anklar` kABI TASODIFI so'zlar yozib qo'yardi —
 * bu chalkashlikning belgisi, javob emas.
 */
const COMPUTE_WORDS =
  /сумма|итого|жами|нало|ндс|ндфл|инпс| qqsh|qqs|vat|tax|foiz|%|кол-во|миқдор|price|narx|цена|сум|total|sum|amount|net|gross|разница|foizda|всего|qoldiq|остаток|выдач|к выдаче|to'lash|тўлов|to'lov|qo'yadi/i;

function isComputeHeader(v: string): boolean {
  // "Номи" — BILIM ustuni: hisob raqami berilgan, uning nomi yoziladi.
  if (isNameHeader(v)) return true;
  return COMPUTE_WORDS.test(v.toLowerCase().replace(/\s+/g, " "));
}

export function analyzeSheet(sheet: Sheet): SheetPlan {
  const cells = sheet.cells;
  const refs = Object.keys(cells);

  const rowRefs = new Map<number, string[]>();
  for (const ref of refs) {
    const r = rowOf(ref);
    const list = rowRefs.get(r) || [];
    list.push(ref);
    rowRefs.set(r, list);
  }
  const usedRows = [...rowRefs.keys()].sort((a, b) => a - b);

  // — SARLAVHA QATORI: birinchi qatorlarda eng ko'p MATN (yoki `?`) bor qator
  let headerRow = 0;
  if (usedRows.length) {
    const window = usedRows.filter((r) => r <= usedRows[0] + 6);
    let best = 0;
    for (const r of window) {
      const list = rowRefs.get(r) || [];
      const score = list.filter((ref) => isLabel(cells[ref].v)).length;
      if (score > best) {
        best = score;
        headerRow = r;
      }
    }
    if (best < 2) headerRow = 0;
  }

  // — USTUNLAR: sarlavha va ma'lumotni ajratamiz
  const colHeader = new Map<number, string>();
  /**
 * BO'SH KATAK BELGILARI — bular ma'lumot EMAS.
 *
 * `?` — aniq "shu katakni to'ldir" buyrug'i.
 * `0` — bo'sh katak belgisi (ko'p hisob varaqalarida shunday qoladi).
 * Ular ma'lumot deb hisoblansa, ustun "to'ldirilgan" bo'lib qoladi va
 * unga hech narsa yozilmaydi — aynan shu "Номи" ustunida bo'ldi.
 */
function isPlaceholder(v: any): boolean {
  const s = String(v ?? "").trim();
  return s === "?" || s === "0";
}

const colHasData = new Map<number, boolean>();
  for (const ref of refs) {
    const ci = colIndex(ref);
    const isHeaderRow = headerRow > 0 && rowOf(ref) <= headerRow;
    if (isHeaderRow) {
      if (isLabel(cells[ref].v)) colHeader.set(ci, String(cells[ref].v).trim());
    } else if (headerRow > 0) {
      // `?` va `0` — bu MA'LUMOT EMAS, bu "shu katakni to'ldir" belgisi.
      // Agar ularni ma'lumot deb hisoblansa, ustun "berilgan" bo'lib qoladi
      // va unga hech narsa yozilmaydi (bu holatda "Номи" ustuni bo'sh qoldi).
      if (!isPlaceholder(cells[ref].v)) colHasData.set(ci, true);
    } else {
      colHasData.set(ci, true);
    }
  }

  // ——— "Номи" USTUNI MAXSUS QOIDA ———
//
// Bu ustunda hisob raqamining nomi yoziladi. Faylda NOM BOR — lekin u
// NСБУ №21 bo'yicha TO'G'RI emas bo'lishi mumkin:
//   "ateriali lar" → "Materiallar"
//   "sosiyishlabchiqarish" → "Asosiy ishlab chiqarish"
//   "ug", "yudjetgato", "0" → to'liq bosh
//
// Bunday qiymat "berilgan ma'lumot" EMAS — bu XATO javob, va uni to'ldirish
// katagi bo'lishi kerak. Aks holda ustun "berilgan" bo'lib qoladi va
// hech narsa tuzatilmaydi (bu holatda shunday bo'ldi).
const nameHeaders = [...colHeader.entries()].filter(([, h]) => isNameHeader(h)).map(([ci]) => ci);
for (const ci of nameHeaders) {
  const codeColCi = [...colHeader.entries()].find(([c, h]) => c !== ci && isCodeHeader(h))?.[0];
  if (codeColCi === undefined) continue;

  let needsFix = false;
  for (const ref of refs) {
    if (colIndex(ref) !== ci) continue;
    const rowN = rowOf(ref);
    if (headerRow && rowN <= headerRow) continue;
    const acc = findNsbu(String(cells[`${colName(codeColCi)}${rowN}`]?.v ?? ""));
    if (!acc) continue;
    const written = String(cells[ref].v ?? "").trim();
    // Qiymat yo'q yoki NSBU nomiga MOS KELMAYDI → bu javob katagi
    if (!written || written.toLowerCase() !== acc.uz.toLowerCase()) {
      needsFix = true;
      break;
    }
  }
  if (needsFix) {
    colHasData.delete(ci);
    // ustun endi "to'ldiriladigan" bo'lishi uchun sarlavhani ham qayta o'rnatamiz
    const idx = [...colHeader.keys()].indexOf(ci);
    if (idx >= 0) colHeader.set(ci, colHeader.get(ci) || "Номи");
  }
}

const fillable: string[] = [];
  const given: string[] = [];
  const locked: string[] = [];
  // Sarlavhasi bor, lekin hisoblanmaydigan matn ustunlari (masalan "Номи")
  const textOnly: string[] = [];
  for (let ci = 0; ci < sheet.cols; ci++) {
    const name = colName(ci);
    const hasHeader = colHeader.has(ci);
    const hasData = colHasData.get(ci) === true;
    // Faqat sarlavhasi HISOBLANADIGAN bo'lgan bo'sh ustun to'ldiriladi.
    // "Номи", "Бух.счет" kabi matn ustunlari — tegilmaydi.
    if (hasData) given.push(name);
    else if (hasHeader && isComputeHeader(colHeader.get(ci)!)) fillable.push(name);
    else if (hasHeader) textOnly.push(name);
    else locked.push(name);
  }

  // — MA'LUMOT QATORLARI va YAKUNIY qatorlar
  const dataRows: number[] = [];
  const totalRows: number[] = [];
  for (const r of usedRows) {
    if (headerRow && r <= headerRow) continue;
    const list = rowRefs.get(r) || [];
    if (isNoteRow(list, cells)) continue;
    if (list.some((ref) => TOTAL_WORDS.test(String(cells[ref].v ?? "")))) totalRows.push(r);
    dataRows.push(r);
  }

  // `?` bilan ANIQ belgilangan kataklar
  const marked = refs.filter((ref) => String(cells[ref].v ?? "").trim() === "?");

  // — JAVOB KATAKLARI: faqat to'ldiriladigan ustunlardagi bo'sh kataklar
  const answer: string[] = [];
  const seen = new Set<string>();
  const push = (ref: string) => {
    if (seen.has(ref)) return;
    seen.add(ref);
    answer.push(ref);
  };
  for (const ref of marked) push(ref);

  // `0` bilan belgilangan kataklar HAM javob katagi — "0" bo'sh katak
  // belgisi, ma'lumot emas (aks holda ustun "berilgan" bo'lib qoladi)
  for (const ref of refs) {
    const col = colIndex(ref);
    if (!fillable.includes(colName(col))) continue;
    if (String(cells[ref].v ?? "").trim() !== "0") continue;
    if (!dataRows.includes(rowOf(ref))) continue;
    push(`${colName(col)}${rowOf(ref)}`);
  }

  for (const r of dataRows) {
    for (const name of fillable) {
      const ref = `${name}${r}`;
      if (cells[ref]) continue;
      push(ref);
    }
  }

  const reason =
    `sarlavha ${headerRow || "-"} · ma'lumot qatorlari ${dataRows.length} · ` +
    `HISOBLANADI: ${fillable.join(", ") || "yo'q"} · ` +
    `berilgan: ${given.join(", ") || "yo'q"} · ` +
    `matn (tegilmaydi): ${textOnly.join(", ") || "yo'q"} · ` +
    `bo'sh (tegilmaydi): ${locked.join(", ") || "yo'q"} · ` +
    `javob kataklari: ${answer.length}`;

  return { headerRow, dataRows, totalRows, fillableColumns: fillable, givenColumns: given, lockedColumns: locked, textOnlyColumns: textOnly, marked, answerCells: answer, reason };
}

export function analyzeAll(sheets: Sheet[]): Record<string, SheetPlan> {
  const out: Record<string, SheetPlan> = {};
  for (const s of sheets) out[s.name] = analyzeSheet(s);
  return out;
}