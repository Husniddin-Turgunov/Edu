/**
 * lib/excel/uzbek-rules.ts
 *
 * O'zbekiston hisob-kitobi qoidalari — AI va foydalanuvchiga BIR XIL
 * qo'llanadigan standart.
 *
 * ASOSIY MUAMMO: hisob varaqalarida QQS (QQSH / НДС) ikki xil usulda
 * aralashib ketadi:
 *
 *   1-usul (SUMMA × 12%) — net narx ustiga QQS qo'shiladi.
 *      100 000 → QQS = 12 000, to'lovchi to'laydi 112 000.
 *
 *   2-usul (SUMMA / 1.12) — YAKUNIY narx (shartnoma summasi) QQS bilan
 *      BIRGA kelishilgan. QQS summa ICHIDAN ajratiladi:
 *      100 000 → net = 89 285.71, QQS = 10 714.29.
 *
 * O'zbekiston amaliyotida schyot-faktura, chek va shartnomada 2-usul
 * to'g'ri hisoblanadi. Bitta jadvalda aralash usul qo'llash — xato.
 * Shu sababli bu qoidalar bitta joyda saqlanadi va AI prompt'iga ham,
 * serverdagi qayta hisoblashga ham ulanadi.
 */

/** Standart QQS stavkasi — 12%. */
export const VAT_RATE = 0.12;

/** 2-usul: yakuniy summa QQS ichida → net narx. */
export function netFromGross(gross: number, rate = VAT_RATE): number {
  return gross / (1 + rate);
}

/** 2-usul: yakuniy summadan QQS ajratilgan miqdori. */
export function vatFromGross(gross: number, rate = VAT_RATE): number {
  return gross - gross / (1 + rate);
}

/** 1-usul: net narx ustiga QQS qo'shiladi. */
export function vatFromNet(net: number, rate = VAT_RATE): number {
  return net * rate;
}

/**
 * Ustun sarlavhasidan usulni aniqlaydi.
 * "сумма без НДС" / "Сумма без НДС" → 2-usul (ichidan)
 * "12% НДС сумма" → 2-usul (chunki boshqa ustun "без НДС" bo'ladi)
 */
export function methodForColumns(headers: { net?: string; vat?: string }): "gross" | "net" {
  // "Сумма без НДС" ustuni mavjud bo'lsa — bu 2-usul: QQS ichidan
  return headers.net ? "gross" : "net";
}

/** AI prompt'ga qo'shiladigan qoidalar. */
export const UZBEK_ACCOUNTING_RULES = [
  `O'ZBEKISTON QQS (НДС) QOIDASI — BARCHA QATORLARDA BIR XIL USUL:`,
  ``,
  `2-USUL (TO'G'RI — hujjatlar, schyot-faktura, chek, shartnoma uchun):`,
  `  QQS YAKUNIY SUMMADAN ICHIDAN ajratiladi:`,
  `    net narx  = SUMMA / 1.12`,
  `    QQS       = SUMMA - net narx`,
  `  Masalan: 100 000 so'm bo'lsa → net = 89 285.71, QQS = 10 714.29`,
  `            (mijoz 100 000 to'laydi, chunki uning ichida QQS bor)`,
  ``,
  `1-USUL (BU JADVALDA ISHLATILMAYDI):`,
  `  QQS = net × 0.12  — bu faqat "shartnomaga ustiga QQS qo'shiladi"`,
  `  deb yozilgan hujjatlarda qo'llaniladi. Oddiy hisob varaqasida`,
  `  aralash usul ishlatish XATO.`,
  ``,
  `QO'LLASH QOIDASI:`,
  `  1. Agar jadvalda "Сумма без НДС" yoki "сумма без НДС" degan USTUN bo'lsa —`,
  `     bu 2-USIL: har bir qator uchun QQS = B × 0.12 EMAS,`,
  `     net = B / 1.12 va QQS = B - (B / 1.12).`,
  `  2. "12% НДС сумма" ustuni = shu net qiymat, "Сумма без НДС" ustuni = shu QQS.`,
  `  3. Barcha qatorlarda BIR XIL usul — hech qachon aralashtirma.`,
  `  4. O'zbekcha sarlavhani ham, ruscha sarlavhani ham bir xil tushun.`,
].join("\n");

/**
 * ISH HAQI (O'QITGAN) HISOBLARI.
 *
 * "ЗАдача №2" da uchta ustun bir xil nomlangan — `Налог`. Bu modelni
 * chalkashtiradi va u taxmin qiladi. Aniq tartib:
 *
 *   1-`Налог` (C) → НДФЛ 12%  — shaxsiy daromad solig'i
 *   2-`Налог` (D) → ИНПС 1%   — ijtimoiy sug'urta solig'i
 *   3-`Налог` (E) → boshqa ushlanma / mablag'
 *   `к выдаче` (F) → qo'lda olishga tegadigan sof summa
 *
 * Ustunlar ketma-ket joylashgani uchun tartib BU YERDA qat'iylashtiriladi.
 */
export const PAYROLL_RULES = [
  `ISHLONCHI SOLIQLARI (bir xil nomlangan "Налог" ustunlari uchun ANIQ tartib):`,
  ``,
  `  1-"Налог" (birinchi, C) → НДФЛ = 12%`,
  `     =B5*0.12`,
  `  2-"Налог" (ikkinchi, D) → ИНПС = 1%`,
  `     =B5*0.01`,
  `  3-"Налог" (uchinchi, E) → boshqa ushlanma. Qanday ushlansa`,
  `     jadvalda yozilmagan — UNI BO'SH QOLDIR, o'ylab topma.`,
  `  "к выдаче" (F) → qo'lda olish: =B5-C5-D5-E5`,
  ``,
  `  "общ.сумма" qatori (8) → har bir ustun uchun JAMI:`,
  `     =SUM(B5:B7), =SUM(C5:C7), =SUM(D5:D7), =SUM(E5:E7), =SUM(F5:F7)`,
  ``,
  `  Muhim: "к выдача" ustuni HAM hisoblanadi — uni bo'sh qoldirma.`,
].join("\n");

/** Ustun sarlavhalarini chuqur tahlil qilib, QQS ustunlarini topadi. */
export function detectVatColumns(headers: Record<string, string>): {
  netCol: string | null;
  vatCol: string | null;
  grossCol: string | null;
} {
  let netCol: string | null = null;
  let vatCol: string | null = null;
  let grossCol: string | null = null;
  for (const [col, raw] of Object.entries(headers)) {
    const h = raw.toLowerCase().replace(/\s+/g, " ").trim();
    if (/без\s*ндс|net/.test(h)) netCol = col;
    else if (/ндс|qqs|налог|vat|12\s*%/.test(h)) vatCol = col;
    else if (/общая сумма|сумма|summa|total/.test(h)) grossCol = col;
  }
  return { netCol, vatCol, grossCol };
}