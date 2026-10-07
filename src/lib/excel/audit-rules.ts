/**
 * lib/excel/audit-rules.ts
 *
 * AUDIT QOIDALARI — jadvalni tekshirish, xatoni topish va tuzatish.
 *
 * Bu sizning "Pro-Prompt"ingizning kod ko'rinishi. Prompt AI ga aytadi
 * "bunaqa ish qil"; bu modul esa XUDDI shuni bajaradi va natijani
 * tekshiriladigan qilib beradi.
 *
 * Asosiy farq: prompt — AI ga ishonch, bu modul — dalil. Har bir
 * tekshiruv serverda bajariladi, natija hisoblanib chiqadi.
 */

import { evaluate, type Sheet } from "./engine";
import { analyzeSheet, type SheetPlan } from "./analyze";
import { findNsbu, NSBU_ACCOUNTS } from "./nsbu";
import { netFromGross, vatFromGross } from "./uzbek-rules";

export type Issue = {
  severity: "error" | "warning" | "info";
  /** Qator/ustun yoki umumiy */
  at: string;
  kind: "formula" | "copy" | "math" | "terminology" | "standard";
  message: string;
  /** To'g'rilash taklifi — formula yoki qiymat. */
  fix?: string;
};

export type AuditResult = {
  sheetName: string;
  verdict: "to'g'ri" | "qisman xato" | "butunlay xato";
  issues: Issue[];
  /** Har bir katakning tekshirilgan qiymati. */
  proof: Record<string, { formula: string; value: number | string }>;
};

/** Butun sonlarni (kasr yo'q) qisqartirish. */
function fmt(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/**
 * 1) MATEMATIK TEKSHIRUV — jadvaldagi sonlarni qayta hisoblaymiz.
 *
 * "Hech qachon jadvaldagi tayyor sonlarga ishonma" — shu qoida.
 */
function auditMath(sheet: Sheet, issues: Issue[], proof: AuditResult["proof"]) {
  for (const [ref, cell] of Object.entries(sheet.cells)) {
    // Faqat FORMULA kataklarini qayta hisoblaymiz
    if (!cell.f) continue;
    const src = String(cell.v);
    try {
      const got = evaluate(sheet, String(cell.f).slice(1));
      const expect = Number(src);
      proof[ref] = { formula: cell.f, value: got as any };

      if (Number.isFinite(expect) && Number.isFinite(Number(got))) {
        const diff = Math.abs(expect - Number(got));
        // 1 so'mdan katta farq — xato
        if (diff > 1) {
          issues.push({
            severity: "error",
            at: ref,
            kind: "math",
            message: `Formula ${cell.f} → ${fmt(Number(got))}, lekin jadvalda ${fmt(expect)} yozilgan. Farq ${fmt(diff)} so'm.`,
            fix: cell.f,
          });
        }
      }
    } catch (e: any) {
      issues.push({
        severity: "error",
        at: ref,
        kind: "formula",
        message: `Formula ${cell.f} ishlamadi: ${e?.message || "xato"}`,
      });
    }
  }
}

/**
 * 2) NUSXALASH XATOSI — so'z kesilib qolganmi?
 *
 * Sizning misolingiz: "assa" → "Kassa", "anklar" → "Banklar",
 * "sosiyvositalar" → "Asosiy vositalar". Model nomlarni o'zicha
 * "tuzatib" yozib qo'yadi va bu chalkashlik belgisidir.
 *
 * Bu yerda biz buni ANIQLAYMIZ va o'zgartirmasdan RO'YXATGA SOLAMIZ —
 * chunki bu ustun "Номи" bo'lsa, javob to'g'ri nom bilan yoziladi
 * (NSBU ro'yxati orqali), "tuzatilgan" so'z emas.
 */
function detectBrokenWords(text: string): string | null {
  const t = String(text).trim();
  if (!t || t.length < 3) return null;
  // Shuning uchun so'zning ichida karkasli "u" yo'q — bu kesilish belgisi
  if (!/[uв]/.test(t) && /[a-zа-я]/.test(t) && t.length >= 5) return t;
  // Qisqa va ma'nosiz so'zlar
  if (/^(ug|ok|0|1|2|3|test|x)$/i.test(t)) return t;
  return null;
}

/** 3) BUXGALTERIYA MANTIQI — QQS usuli to'g'rimi? */
function auditVatMethod(sheet: Sheet, plan: SheetPlan, issues: Issue[], proof: AuditResult["proof"]) {
  // QQS ustunlari topilishi kerak
  const headers = new Map<string, string>();
  if (plan.headerRow > 0) {
    for (const [ref, c] of Object.entries(sheet.cells)) {
      const row = Number(ref.replace(/\D+/g, ""));
      if (row === plan.headerRow && c.t === "s") headers.set(ref.replace(/\d+/g, ""), String(c.v).toLowerCase());
    }
  }
  const netCol = [...headers.entries()].find(([, h]) => /без\s*ндс/.test(h))?.[0];
  const vatCol = [...headers.entries()].find(([, h]) => /ндс/.test(h) && !/без/.test(h))?.[0];
  const grossCol = [...headers.entries()].find(([, h]) => /общая\s*сумма|сумма|total|sum/i.test(h))?.[0];
  if (!netCol || !vatCol || !grossCol) return;

  for (const r of plan.dataRows) {
    const gross = Number(sheet.cells[`${grossCol}${r}`]?.v);
    if (!Number.isFinite(gross) || gross === 0) continue;

    const needVat = vatFromGross(gross);
    const needNet = netFromGross(gross);
    proof[`${vatCol}${r}`] = { formula: `${grossCol}${r}-${grossCol}${r}/1.12`, value: Number(needVat.toFixed(2)) };
    proof[`${netCol}${r}`] = { formula: `${grossCol}${r}/1.12`, value: Number(needNet.toFixed(2)) };

    const gotVat = Number(sheet.cells[`${vatCol}${r}`]?.v ?? sheet.cells[`${vatCol}${r}`]?.f ? sheet.cells[`${vatCol}${r}`]?.v : NaN);
    const gotNet = Number(sheet.cells[`${netCol}${r}`]?.v);

    // 1-usul bilan qilingan bo'lsa — xato
    if (Number.isFinite(gotVat) && Math.abs(gotVat - gross * 0.12) < 1 && Math.abs(gotVat - needVat) > 1) {
      issues.push({
        severity: "error",
        at: `${vatCol}${r}`,
        kind: "standard",
        message: `1-usul ishlatilgan: ${fmt(gotVat)} = ${fmt(gross)} × 12%. O'zbekiston standarti bo'yicha 2-usul kerak — ${fmt(needVat)}.`,
        fix: `=${grossCol}${r}-${grossCol}${r}/1.12`,
      });
    }
  }
}

/** 4) HISOB NOMLARI — NSBU ro'yxatiga mosligi. */
function auditAccountNames(sheet: Sheet, plan: SheetPlan, issues: Issue[], proof: AuditResult["proof"]) {
  const headers = new Map<string, string>();
  if (plan.headerRow > 0) {
    for (const [ref, c] of Object.entries(sheet.cells)) {
      const row = Number(ref.replace(/\D+/g, ""));
      if (row === plan.headerRow && c.t === "s") headers.set(ref.replace(/\d+/g, ""), String(c.v));
    }
  }
  const nameCol = [...headers.entries()].find(([, h]) => /^\s*номи?\s*$/i.test(h) || /наименование/i.test(h))?.[0];
  const codeCol = [...headers.entries()].find(([, h]) => /бух\.?\s*счет/i.test(h))?.[0];
  if (!nameCol || !codeCol) return;

  for (const r of plan.dataRows) {
    const code = String(sheet.cells[`${codeCol}${r}`]?.v ?? "").replace(/\D/g, "");
    const acc = findNsbu(code);
    const nameCell = sheet.cells[`${nameCol}${r}`];
    const written = nameCell ? String(nameCell.v ?? "").trim() : "";

    if (!acc) {
      if (code) {
        issues.push({
          severity: "warning",
          at: `${codeCol}${r}`,
          kind: "terminology",
          message: `Hisob ${code} НСБУ №21 ro'yxatida yo'q.`,
        });
      }
      continue;
    }

    proof[`${nameCol}${r}`] = { formula: `НСБУ №21 ${code} → nomi`, value: acc.uz };

    if (!written) {
      issues.push({
        severity: "info",
        at: `${nameCol}${r}`,
        kind: "terminology",
        message: `Bo'sh. Hisob ${code} → "${acc.uz}"`,
        fix: acc.uz,
      });
      continue;
    }

    const broken = detectBrokenWords(written);
    if (broken || written.toLowerCase() !== acc.uz.toLowerCase()) {
      issues.push({
        severity: "error",
        at: `${nameCol}${r}`,
        kind: broken ? "copy" : "terminology",
        message: broken
          ? `Nusxalashda kesilib qolgan: "${written}". To'g'ri nomi: "${acc.uz}".`
          : `"${written}" — НСБУ №21 bo'yicha "${acc.uz}".`,
        fix: acc.uz,
      });
    }
  }
}

/** Bitta tabni tekshiradi. */
export function auditSheet(sheet: Sheet): AuditResult {
  const plan = analyzeSheet(sheet);
  const issues: Issue[] = [];
  const proof: AuditResult["proof"] = {};

  auditMath(sheet, issues, proof);
  auditVatMethod(sheet, plan, issues, proof);
  auditAccountNames(sheet, plan, issues, proof);

  const errors = issues.filter((i) => i.severity === "error").length;
  const verdict: AuditResult["verdict"] = errors === 0 ? "to'g'ri" : errors <= 2 ? "qisman xato" : "butunlay xato";

  return { sheetName: sheet.name, verdict, issues, proof };
}

/**
 * UMUMIY XULOSA — barcha tablarni tekshirib, xulosa matnini yig'adi.
 * (AI prompt'idagi "Javob berish formati" shu yerga mos keladi.)
 */
export function auditReport(sheets: Sheet[]): {
  summary: string;
  results: AuditResult[];
  markdown: string;
} {
  const results = sheets.map(auditSheet);
  const totalErrors = results.reduce((n, r) => n + r.issues.filter((i) => i.severity === "error").length, 0);

  const summary =
    totalErrors === 0
      ? "1. UMUMIY XULOSA: To'g'ri — xatolik topilmadi."
      : `1. UMUMIY XULOSA: ${totalErrors <= 2 ? "Qisman xato" : "Butunlay xato"} — ${totalErrors} ta xato topildi.`;

  const lines: string[] = [summary, "", "2. ANIQLANGAN XATOLAR:"];
  let n = 0;
  for (const r of results) {
    const errs = r.issues.filter((i) => i.severity === "error" || i.severity === "warning");
    if (!errs.length) continue;
    lines.push(`\n"${r.sheetName}" (${r.verdict}):`);
    for (const i of errs) {
      n++;
      lines.push(`  ${n}. [${i.at}] ${i.message}${i.fix ? ` → TO'G'RILASH: ${i.fix}` : ""}`);
    }
  }
  if (!n) lines.push("  (yo'q)");

  lines.push("", "3. HISOB-KITOB ISBOTI:");
  let p = 0;
  for (const r of results) {
    const entries = Object.entries(r.proof);
    if (!entries.length) continue;
    lines.push(`\n"${r.sheetName}":`);
    for (const [ref, v] of entries.slice(0, 40)) {
      p++;
      // Qiymat son bo'lsa — ko'rsatiladi; matn bo'lsa — "=" belgisiz
      const show = typeof v.value === "number" ? `= ${fmt(v.value)}` : String(v.value);
      lines.push(`  ${p}. ${ref}: ${v.formula} → ${show}`);
    }
  }
  if (!p) lines.push("  (tekshiriladigan formula yo'q)");

  return { summary, results, markdown: lines.join("\n") };
}

/** Reja bo'yicha hisoblar ro'yxati — prompt uchun. */
export function nsbuList(): string {
  return NSBU_ACCOUNTS.map((a) => `${a.code} = ${a.uz}`).join("\n");
}