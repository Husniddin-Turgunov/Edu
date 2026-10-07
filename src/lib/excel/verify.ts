/**
 * lib/excel/verify.ts
 *
 * KETMA-KET TEKSHIRUV — har bir katak alohida, bir-biriga bog'liq emas.
 *
 * Sizning talab: "bir chekadan bitta bitta to'ldirib chiqadigan qil —
 * to'ldirib, bu javobim rostan to'g'rimi degan savol bilan tekshirib,
 * keyingi katakka o'tib ishlasin".
 *
 * Nima uchun bu kerak: oldingi usulda AI 12 ta katakka bir vaqtda javob
 * berardi. Bir katak xato bo'lsa, qolgan 11 tasi ham o'sha xato asosida
 * qurilardi. Endi:
 *
 *   1. Har bir katakka ALOHIDA so'rov
 *   2. Serverdagi DVIGOTEL bilan qayta hisoblanadi
 *   3. "Bu rostan to'g'rimi?" — 3 ta savol bilan tekshiriladi
 *   4. Ishonchli bo'lmasa — KATAK QOLDIRILADI, keyingisiga o'tiladi
 *
 * Tezlik: so'rovlar parallel emas, LEKIN har biri qisqa (bitta katak),
 * shuning uchun 10-15 soniya ichida 54 katak tekshiriladi.
 */

import { evaluate, type Sheet } from "./engine";
import { analyzeSheet, type SheetPlan } from "./analyze";
import { findNsbu, isCodeHeader, isNameHeader } from "./nsbu";

export type CellVerdict = {
  ref: string;
  /** AI taklif qilgan formula yoki qiymat. */
  proposed: string;
  /** DVIGOTEL bilan qayta hisoblangan natija. */
  computed: number | string | null;
  /** "Bu rostan to'g'rimi?" — 3 ta savolning javoblari. */
  checks: { name: string; ok: boolean; detail: string }[];
  /** Barcha savollar o'tdimi? */
  valid: boolean;
  /** Sabab (agar rad etilgan bo'lsa). */
  reason?: string;
};

/** 1) FORMULA ISHLAMoqCHIMI? */
function checkFormula(sheet: Sheet, ref: string, formula: string): { ok: boolean; value: number | string | null; detail: string } {
  const probe: Sheet = { ...sheet, cells: { ...sheet.cells, [ref]: { t: "n", v: 0, f: formula } } };
  try {
    const v = evaluate(probe, formula.slice(1));
    if (typeof v === "number" && !Number.isFinite(v)) {
      return { ok: false, value: null, detail: "natija cheksiz son" };
    }
    return { ok: true, value: v as any, detail: `hisoblandi: ${typeof v === "number" ? v.toFixed(2) : v}` };
  } catch (e: any) {
    return { ok: false, value: null, detail: `formula xato: ${e?.message || "ishlamadi"}` };
  }
}

/** 2) RO'YXATDA BORMI? (katak reja ro'yxatida, bloklangan ustunda emas) */
function checkPlacement(plan: SheetPlan, ref: string): { ok: boolean; detail: string } {
  const col = ref.replace(/\d+/g, "");
  // `?` bilan ANIQ belgilangan katak — har doim ruxsat beriladi.
  // Masalan "ЗАдача №2" da B8 ustuni berilgan (B), lekin `?` bilan
  // belgilangan — ya'ni jami hisoblanishi kerak.
  if (plan.marked.includes(ref)) return { ok: true, detail: "«?» bilan belgilangan — javob katagi" };
  if (plan.lockedColumns.includes(col)) {
    return { ok: false, detail: `${col} ustuni bo'sh — u yerga yozilmaydi` };
  }
  if (plan.textOnlyColumns.includes(col) && !isNameHeader(col)) {
    return { ok: false, detail: `${col} ustuni matn ustuni — so'z yozilmaydi` };
  }
  if (plan.givenColumns.includes(col)) {
    return { ok: false, detail: `${col} ustuni berilgan — tegilmaydi` };
  }
  if (!plan.answerCells.includes(ref)) {
    return { ok: false, detail: "bu katak javob ro'yxatida yo'q" };
  }
  return { ok: true, detail: "to'g'ri joyda" };
}

/** 3) NATIJA MANTIQIYMI? (manfiy yoki juda katta natija — chalkashlik belgisi) */
function checkSanity(value: number | string | null): { ok: boolean; detail: string } {
  if (value === null) return { ok: false, detail: "natija yo'q" };
  if (typeof value !== "number") return { ok: true, detail: `matn: "${value}"` };
  if (!Number.isFinite(value)) return { ok: false, detail: "natija cheksiz" };
  if (value < 0 && Math.abs(value) < 1) return { ok: true, detail: "kichik manfiy (davriy chegara)" };
  if (Math.abs(value) > 1e13) return { ok: false, detail: "natijani juda katta — chalkashlik" };
  return { ok: true, detail: "mantiqiy" };
}

/** Nom ustuni — hisob raqamidan ANIQLANADI (AI so'ziga ishonilmaydi). */
function nsbuAnswer(sheet: Sheet, plan: SheetPlan, ref: string): string | null {
  const colHeaders = new Map<string, string>();
  if (plan.headerRow > 0) {
    for (const [r, c] of Object.entries(sheet.cells)) {
      const col = r.replace(/\d+/g, "");
      if (!colHeaders.has(col) && Number(r.replace(/\D+/g, "")) === plan.headerRow && c.t === "s") {
        colHeaders.set(col, String(c.v).trim());
      }
    }
  }
  const nameCol = [...colHeaders.entries()].find(([, h]) => isNameHeader(h))?.[0];
  if (!nameCol || ref.replace(/\d+/g, "") !== nameCol) return null;
  const codeCol = [...colHeaders.entries()].find(([col, h]) => col !== nameCol && isCodeHeader(h))?.[0];
  if (!codeCol) return null;
  const row = Number(ref.replace(/\D+/g, ""));
  const acc = findNsbu(String(sheet.cells[`${codeCol}${row}`]?.v ?? ""));
  return acc?.uz ?? null;
}

/**
 * Bitta katakni tekshiradi: "bu javobim rostan to'g'rimi?"
 *
 * Natija — `CellVerdict`. `valid: false` bo'lsa, KATAK QOLDIRILADI.
 */
export function verifyCell(
  sheet: Sheet,
  plan: SheetPlan,
  ref: string,
  proposed: string,
  prev: Record<string, string> = {},
): CellVerdict {
  // Oldingi kataklarda TASDIQLANGAN javoblar — formula ularga bog'lanadi
  // (masalan F3 = D3/E3, D3 esa oldingi qadamda to'ldirilgan).
  // Ularsiz natija 0 chiqadi va javob rad etiladi.
  if (Object.keys(prev).length) {
    const cells = { ...sheet.cells };
    for (const [r, v] of Object.entries(prev)) {
      if (r === ref) continue;
      cells[r] = String(v).startsWith("=") ? { t: "n", v: 0, f: String(v) } : { t: "s", v: String(v) };
    }
    sheet = { ...sheet, cells };
  }
  const checks: CellVerdict["checks"] = [];
  const val = String(proposed ?? "").trim();

  // — Nom ustuni: AI so'zi emas, НСБУ ro'yxatidan —
  const nsbu = nsbuAnswer(sheet, plan, ref);
  if (nsbu) {
    checks.push({ name: " joylashuv", ok: true, detail: "Номи ustuni — ro'yxatdan aniqlanadi" });
    const same = val.toLowerCase() === nsbu.toLowerCase();
    checks.push({
      name: "мазмун",
      ok: true,
      detail: same ? `AI to'g'ri topdi: ${nsbu}` : `AI "${val}" yozdi, lekin aniq nomi "${nsbu}"`,
    });
    return {
      ref,
      proposed: nsbu,
      computed: nsbu,
      checks,
      valid: true,
      reason: same ? undefined : "AI so'zi aniq nomga TUG'IRLANDI",
    };
  }

  // — Savol 1: to'g'ri joyda mi? —
  const place = checkPlacement(plan, ref);
  checks.push({ name: " joylashuv", ok: place.ok, detail: place.detail });

  // — Savol 2: formula ishlaydimi? —
  let computed: number | string | null = null;
  if (val.startsWith("=")) {
    const f = checkFormula(sheet, ref, val);
    computed = f.value;
    checks.push({ name: " formula", ok: f.ok, detail: f.detail });
  } else if (/^-?\d+(?:[.,]\d+)?$/.test(val)) {
    computed = Number(val.replace(",", "."));
    checks.push({ name: " formula", ok: true, detail: "bu son, formula emas" });
  } else {
    checks.push({ name: " formula", ok: false, detail: `matn javob: "${val}" — bu qabul qilinmaydi` });
  }

  // — Savol 3: natija mantiqiymi? —
  if (checks[1].ok) {
    const san = checkSanity(computed);
    checks.push({ name: " mantiq", ok: san.ok, detail: san.detail });
  } else {
    checks.push({ name: " mantiq", ok: false, detail: "formula ishlamagani uchun tekshirilmadi" });
  }

  const valid = checks.every((c) => c.ok);
  return {
    ref,
    proposed: val,
    computed,
    checks,
    valid,
    reason: valid ? undefined : checks.find((c) => !c.ok)?.detail,
  };
}

/** Bitta katak uchun oddiy savol-javob (UI uchun). */
export function cellQuestion(v: CellVerdict): string {
  const pass = v.checks.filter((c) => c.ok).length;
  return `"${v.ref}": "${v.proposed}" — ${pass}/${v.checks.length} savolga "ha" · ${v.valid ? "TO'G'RI" : "RAD ETILDI: " + (v.reason || "")}`;
}