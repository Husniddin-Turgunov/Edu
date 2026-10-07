/**
 * lib/excel/engine.ts
 *
 * Elektron jadval dvigoteli: xaritalarni o'qish, formulalarni hisoblash,
 * to'g'ri javoblarni ajratib olish.
 *
 * Nima uchun o'zim yozdim: bu yerda hamma narsa bitta maqsadga xizmat qiladi —
 * testda "buxgalter" katagi. Kerakli funksiyalar kichik to'plam:
 *   arifmetika: + - * / ^ % , qavs (), manfiy belgi
 *   katak: A1, $B$2, Sheet!A1
 *   diapazon: A1:A9
 *   funksiya: SUM, AVERAGE, MIN, MAX, COUNT, ROUND, ABS, IF, SQRT, PRODUCT
 *
 * To'g'ri javob (answer key) faqat BIR marta — fayl birinchi kiritilganda —
 * hisoblanadi va serverga saqlanadi. Test vaqtida model chaqirilmaydi.
 */

export type CellType = "n" | "s" | "b";
export type Cell = { t: CellType; v: number | string | boolean; f?: string };
export type Sheet = { name: string; rows: number; cols: number; cells: Record<string, Cell> };

/** "B5" → {col: 1 (0-based), row: 4} */
export function parseRef(ref: string): { col: number; row: number } | null {
  const m = /^\$?([A-Za-z]+)\$?(\d+)$/.exec(ref.trim());
  if (!m) return null;
  let col = 0;
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col: col - 1, row: Number(m[2]) - 1 };
}

/** {col,row} → "B5" */
export function toRef(col: number, row: number): string {
  let s = "";
  let c = col + 1;
  while (c > 0) {
    const r = (c - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    c = Math.floor((c - 1) / 26);
  }
  return `${s}${row + 1}`;
}

type Token =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "ref"; v: string }
  | { k: "range"; a: string; b: string }
  | { k: "fn"; v: string }
  | { k: "op"; v: string }
  | { k: "lp" }
  | { k: "rp" }
  | { k: "comma" };

/** Formulani tokenlarga bo'ladi. Excel kabi, lekin sodda. */
function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const s = src.replace(/\s+/g, "");
  while (i < s.length) {
    const ch = s[i];
    if (ch === "(") { out.push({ k: "lp" }); i++; continue; }
    if (ch === ")") { out.push({ k: "rp" }); i++; continue; }
    if (ch === "," || ch === ";") { out.push({ k: "comma" }); i++; continue; }
    if ("+-*/^%".includes(ch)) { out.push({ k: "op", v: ch }); i++; continue; }
    if (ch === '"') {
      let j = i + 1, v = "";
      while (j < s.length && s[j] !== '"') { v += s[j]; j++; }
      out.push({ k: "str", v });
      i = j + 1;
      continue;
    }
    if (ch === "=" || ch === "<" || ch === ">" || ch === "!" || ch === ":") {
      // "=" faqat boshlanishda; qolganlari operator/ref ichida
      if (ch === "=" && out.length === 0) { i++; continue; }
      if ((ch === "<" || ch === ">") && i + 1 < s.length && s[i + 1] === "=") {
        out.push({ k: "op", v: ch + "=" });
        i += 2;
        continue;
      }
      if (ch === "<" && i + 1 < s.length && s[i + 1] === ">") {
        out.push({ k: "op", v: "<>" });
        i += 2;
        continue;
      }
      out.push({ k: "op", v: ch });
      i++;
      continue;
    }
    // son / funksiya / katak / diapazon
    const m = /^(?:'([^']+)'|([A-Za-z_][\w.]*))!(\$?[A-Za-z]+\$?\d+)/.exec(s.slice(i));
    if (m) {
      const sheet = (m[1] || m[2] || "") + "!";
      out.push({ k: "ref", v: sheet + m[3] });
      i += m[0].length;
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (num) { out.push({ k: "num", v: Number(num[0]) }); i += num[0].length; continue; }
    const rng = /^(\$?[A-Za-z]+\$?\d+):(\$?[A-Za-z]+\$?\d+)/.exec(s.slice(i));
    if (rng) { out.push({ k: "range", a: rng[1], b: rng[2] }); i += rng[0].length; continue; }
    const fn = /^([A-Za-z]+)\(/.exec(s.slice(i));
    if (fn) { out.push({ k: "fn", v: fn[1].toUpperCase() }); i += fn[0].length; continue; }
    const cell = /^(\$?[A-Za-z]+\$?\d+)/.exec(s.slice(i));
    if (cell) { out.push({ k: "ref", v: cell[1] }); i += cell[0].length; continue; }
    const bare = /^[A-Za-z]+/.exec(s.slice(i));
    if (bare) { out.push({ k: "str", v: bare[0] }); i += bare[0].length; continue; }
    i++;
  }
  return out;
}

type Ctx = { sheets: Sheet[]; sheet: Sheet; visiting: Set<string> };

function sheetByName(ctx: Ctx, name?: string): Sheet {
  if (!name) return ctx.sheet;
  return ctx.sheets.find((s) => s.name.toLowerCase() === name.toLowerCase()) || ctx.sheet;
}

/** Bitta katakning qiymati (formula bo'lsa — rekursiv hisoblanadi). */
export function cellValue(ctx: Ctx, ref: string): number | string | boolean {
  const clean = ref.replace(/\$/g, "");
  const parts = clean.includes("!") ? clean.split("!") : ["", clean];
  const sheetPart = parts[0] || "";
  const refPart = parts[1] || "";
  const target = sheetByName(ctx, sheetPart || undefined);
  const cell = target.cells[refPart];
  if (!cell) return 0;
  if (cell.f) {
    const key = `${target.name}!${refPart}`;
    if (ctx.visiting.has(key)) return 0; // halqa — 0 qaytaramiz
    ctx.visiting.add(key);
    try {
      const v = evaluate(target, cell.f.slice(1), ctx);
      return v;
    } catch {
      return 0;
    } finally {
      ctx.visiting.delete(key);
    }
  }
  return cell.v;
}

function numeric(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(String(v ?? "").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Diapazon qiymatlari (funksiya argumenti sifatida). */
function rangeValues(ctx: Ctx, a: string, b: string): (number | string | boolean)[] {
  const ca = parseRef(a.replace(/\$/g, ""));
  const cb = parseRef(b.replace(/\$/g, ""));
  if (!ca || !cb) return [];
  const vals: (number | string | boolean)[] = [];
  for (let r = Math.min(ca.row, cb.row); r <= Math.max(ca.row, cb.row); r++) {
    for (let c = Math.min(ca.col, cb.col); c <= Math.max(ca.col, cb.col); c++) {
      vals.push(cellValue(ctx, toRef(c, r)));
    }
  }
  return vals;
}

type Arg = {
  /** Funksiya uchun yassiq sonlar (SUM/MIN/MAX uchun). */
  values: number[];
  /** Operatorlar uchun bitta qiymat. */
  scalar: number | string | boolean;
};

/** Formulani hisoblaydi. `formula` — `=` belgisiz. */
export function evaluate(sheet: Sheet, formula: string, outer?: Ctx): number | string | boolean {
  const ctx: Ctx = outer || { sheets: [sheet], sheet, visiting: new Set() };
  if (!outer) ctx.sheets = [sheet];
  const toks = tokenize(formula);
  let pos = 0;

  const peek = () => toks[pos];
  const eat = () => toks[pos++];

  // ——— Qiyoslash: eng past daraja ———
  function parseCompare(): number | string | boolean {
    let left = parseExpr();
    for (;;) {
      const t = peek();
      if (!t || t.k !== "op") return left;
      if (t.v === "=" || t.v === "<" || t.v === ">" || t.v === "<=" || t.v === ">=" || t.v === "<>") {
        eat();
        const right = parseExpr();
        const a = left, b = right;
        const cmp = compareValues(a, b);
        switch (t.v) {
          case "=": left = cmp === 0; break;
          case "<>": left = cmp !== 0; break;
          case "<": left = cmp < 0; break;
          case ">": left = cmp > 0; break;
          case "<=": left = cmp <= 0; break;
          case ">=": left = cmp >= 0; break;
        }
        continue;
      }
      return left;
    }
  }

  function parseExpr(): number | string | boolean {
    let left = parseUnary();
    for (;;) {
      const t = peek();
      if (t && t.k === "op" && (t.v === "+" || t.v === "-")) {
        eat();
        const right = parseCompare();
        left = numeric(left) + (t.v === "+" ? 1 : -1) * numeric(right);
        continue;
      }
      return left;
    }
  }

  function parseUnary(): number | string | boolean {
    const t = peek();
    if (t && t.k === "op" && (t.v === "-" || t.v === "+")) {
      eat();
      const v = parseUnary();
      return t.v === "-" ? -numeric(v) : numeric(v);
    }
    return parseTerm();
  }

  function parseTerm(): number | string | boolean {
    let left = parsePower();
    for (;;) {
      const t = peek();
      if (t && t.k === "op" && (t.v === "*" || t.v === "/")) {
        eat();
        const right = parsePower();
        const l = numeric(left), r = numeric(right);
        if (t.v === "*") left = l * r;
        else left = r === 0 ? 0 : l / r;
        continue;
      }
      if (t && t.k === "op" && t.v === "%") {
        eat();
        left = numeric(left) / 100;
        continue;
      }
      return left;
    }
  }

  function parsePower(): number | string | boolean {
    const base = parseAtom();
    const t = peek();
    if (t && t.k === "op" && t.v === "^") {
      eat();
      return Math.pow(numeric(base), numeric(parsePower()));
    }
    return base;
  }

  /** Diapazonni YASSIQ qilib yoyadi — SUM(A1:A9) shu ishlaydi. */
  function parseArg(): Arg {
    const t = peek();
    if (t && t.k === "range") {
      eat();
      const vals = rangeValues(ctx, t.a, t.b);
      return { values: vals.map(numeric), scalar: vals[0] ?? 0 };
    }
    // MUHIM: argument — TO'LIQ ifoda bo'lishi kerak, bir atom emas.
    // Aks holda `ROUND(B1*0.12,2)` → faqat `B1` o'qilib, `*0.12` tashlab
    // qolardi (va `ABS(0-15)` ham, `IF(B1>1000000,...)` ham noto'g'ri bo'lardi).
    const v = parseCompare();
    return { values: [numeric(v)], scalar: v };
  }

  function parseAtom(): number | string | boolean {
    const t = eat();
    if (!t) return 0;
    if (t.k === "num") return t.v;
    if (t.k === "str") return t.v;
    if (t.k === "ref") return cellValue(ctx, t.v);
    if (t.k === "range") {
      const vals = rangeValues(ctx, t.a, t.b);
      return vals[0] ?? 0;
    }
    // QAVS — token turi `lp` (tokenizer alohida belgilaydi)
    if (t.k === "lp") {
      const v = parseExpr();
      if (peek()?.k === "rp") eat();
      return v;
    }
    if (t.k === "fn") {
      if (peek()?.k === "lp") eat();
      const args: Arg[] = [];
      for (;;) {
        const cur = peek();
        if (!cur || cur.k === "rp") { eat(); break; }
        if (cur.k === "comma") { eat(); continue; }
        args.push(parseArg());
      }
      return callFn(t.v, args);
    }
    return 0;
  }

  return parseCompare();
}

/** -1 / 0 / 1 */
function compareValues(a: unknown, b: unknown): number {
  const na = typeof a === "number" ? a : null;
  const nb = typeof b === "number" ? b : null;
  if (na !== null && nb !== null) return na === nb ? 0 : na < nb ? -1 : 1;
  const x = String(a ?? "").toLowerCase();
  const y = String(b ?? "").toLowerCase();
  return x === y ? 0 : x < y ? -1 : 1;
}

function callFn(name: string, args: Arg[]): number | string | boolean {
  const flat = args.flatMap((a) => a.values);
  const scalar = (i: number) => args[i]?.scalar ?? 0;
  switch (name) {
    case "SUM": return flat.reduce((a, b) => a + b, 0);
    case "PRODUCT": return flat.length ? flat.reduce((a, b) => a * b, 1) : 0;
    case "AVERAGE": return flat.length ? flat.reduce((a, b) => a + b, 0) / flat.length : 0;
    case "MIN": return flat.length ? Math.min(...flat) : 0;
    case "MAX": return flat.length ? Math.max(...flat) : 0;
    case "COUNT": return flat.length;
    case "ROUND": {
      const d = args.length > 1 ? Math.round(numeric(args[1].scalar)) : 0;
      const p = Math.pow(10, d);
      return Math.round(numeric(args[0].scalar) * p) / p;
    }
    case "ABS": return Math.abs(numeric(scalar(0)));
    case "SQRT": return Math.sqrt(Math.max(0, numeric(scalar(0))));
    case "IF": {
      const cond = scalar(0);
      const truthy = typeof cond === "boolean" ? cond : cond !== "" && numeric(cond) !== 0;
      return truthy ? scalar(1) : scalar(2);
    }
    default: return scalar(0);
  }
}

/** Bitta katakni qiymatga aylantiradi (formula bo'lsa — hisoblaydi). */
export function readCell(sheets: Sheet[], sheetName: string, ref: string) {
  const ctx: Ctx = { sheets, sheet: sheetByName({ sheets, sheet: sheets[0], visiting: new Set() }, sheetName), visiting: new Set() };
  return cellValue(ctx, ref);
}

/**
 * To'g'ri javoblar ro'yxati — faqat FORMULA yozilgan kataklar.
 *
 * Nima uchun aynan formula kataklari: faylda bo'sh (`?`) kataklar — foydalanuvchi
 * to'ldiradigan joylar. Agar AI/administrator shu katakka formula yozsa, u
 * avtomatik ravishda to'g'ri javob bo'ladi.
 */
export function computeAnswerKey(sheets: Sheet[]): Record<string, Record<string, number | string | boolean>> {
  const key: Record<string, Record<string, number | string | boolean>> = {};
  for (const sheet of sheets) {
    const ctx: Ctx = { sheets, sheet, visiting: new Set() };
    const per: Record<string, number | string | boolean> = {};
    for (const [ref, cell] of Object.entries(sheet.cells)) {
      if (!cell.f) continue;
      try {
        const v = evaluate(sheet, cell.f.slice(1), { ...ctx, visiting: new Set() });
        per[ref] = typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v;
      } catch {
        /* formulani hisoblab bo'lmasa — javobga qo'shmaymiz */
      }
    }
    if (Object.keys(per).length) key[sheet.name] = per;
  }
  return key;
}

/** Ikki qiymat tengmi (raqamda 0.01 aniqlik, matnda bo'sh joy hisobga olmasdan). */
export function valuesMatch(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  if (typeof a === "number" || typeof b === "number") {
    const x = numeric(a), y = numeric(b);
    return Math.abs(x - y) < 0.01;
  }
  return String(a).trim().toLowerCase().replace(/\s+/g, " ") === String(b).trim().toLowerCase().replace(/\s+/g, " ");
}