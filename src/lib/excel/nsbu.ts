/**
 * lib/excel/nsbu.ts
 *
 * НСБУ №21 — O'zbekiston Buxgalterlik hisobi Shartnomasi, 1-qism:
 * hisoblar rejasi va hisoblar nomlari.
 *
 * Nima uchun bu kerak:
 *  "Задача№1" da `Бух.счет` (B) ustuni BERILGAN — 1000, 2010, 2910, ...
 *  `Номи` (C) ustuni BO'SH. Bu hisob emas — bu **bilim testi**: hisob
 *  raqamiga to'g'ri nom yozish kerak.
 *
 *  AI bu yerda oldin "assa", "anklar", "Moliyaviyatijalar" kabi so'zlar
 *  yozardi — chunki u nomlarni TUSHUNMAGAN. Endi u ro'yxatdan qat'iy
 *  qidiradi: hisob raqami topilmasa — katak bo'sh qoladi.
 */

export type NsbuAccount = {
  code: string;
  uz: string;
  ru: string;
};

/** НСБУ №21 — asosiy hisoblar rejasi. */
export const NSBU_ACCOUNTS: NsbuAccount[] = [
  { code: "1000", uz: "Materiallar", ru: "Материалы" },
  { code: "2010", uz: "Asosiy ishlab chiqarish", ru: "Основное производство" },
  { code: "2910", uz: "Omborxonadagi tovarlar", ru: "Товары на складах" },
  { code: "4010", uz: "Xaridorlar va buyurtmachilardan olinadigan schetlar", ru: "Счета к получению от покупателей и заказчиков" },
  { code: "4210", uz: "Xodimlarga berilgan bo'naklar (avanslar)", ru: "Авансы, выданные работникам" },
  { code: "4310", uz: "Yetkazib beruvchilar va pudratchilarga berilgan bo'naklar", ru: "Авансы, выданные поставщикам и подрядчикам" },
  { code: "5010", uz: "Milliy valutadagi kassa", ru: "Касса в национальной валюте" },
  { code: "5110", uz: "Hisob-kitob scheti", ru: "Расчетный счет" },
  { code: "5710", uz: "Yo'ldagi pul o'tkazmalari (pul hujjatlari)", ru: "Переводы в пути" },
  { code: "6410", uz: "Byudjetga to'lovlar bo'yicha qarz (soliqlar)", ru: "Задолженность по платежам в бюджет" },
  { code: "6510", uz: "Sug'urta bo'yicha qarz", ru: "Задолженность по страхованию" },
  { code: "6710", uz: "Mehnatga haq to'lash bo'yicha xodimlar bilan hisoblashuvlar", ru: "Расчеты с персоналом по оплате труда" },
  { code: "6890", uz: "Boshqa majburiyatlar", ru: "Другие обязательства" },
  { code: "9000", uz: "Tayyor mahsulot (tovar, ish, xizmat)larni sotishdan tushum", ru: "Доходы от реализации готовой продукции (товаров, работ, услуг)" },
  { code: "9100", uz: "Sotilgan tayyor mahsulot (tovar, ish, xizmat)larning tannarxi", ru: "Себестоимость реализованной готовой продукции (товаров, работ, услуг)" },
  { code: "9300", uz: "Boshqa operatsion daromadlar", ru: "Прочие операционные доходы" },
  { code: "9400", uz: "Davr xarajatlari", ru: "Расходы периода" },
  { code: "9500", uz: "Moliyaviy faoliyat bo'yicha daromadlar", ru: "Доходы от финансовой деятельности" },
  { code: "9600", uz: "Moliyaviy faoliyat bo'yicha xarajatlar", ru: "Расходы по финансовой деятельности" },
];

/** Hisob raqamini topadi. */
export function findNsbu(code: string): NsbuAccount | undefined {
  const c = String(code).trim().replace(/\D/g, "");
  return NSBU_ACCOUNTS.find((a) => a.code === c);
}

/** AI prompt'ga qo'shiladigan qoidalar. */
export const NSBU_RULES = [
  `БУХГАЛТЕРСКИЕ СЧЕТА — НСБУ №21 (План счетов Республики Узбекистан).`,
  ``,
  `Jadvalda "Бух.счет" (raqam) va "Номи" (nom) bo'lsa — bu BILIM TESTI.`,
  `Hisob raqami ALMASHDA berilgan. Uning nomini TO'G'RI yozish kerak.`,
  ``,
  `TO'G'RI NOMLAR (rasmiy, НСБУ №21):`,
  ...NSBU_ACCOUNTS.map((a) => `  ${a.code} = ${a.uz}`),
  ``,
  `QOIDALAR:`,
  `1. Nom faqat ushbu ro'yxatdan — boshqa so'z YOZMA.`,
  `2. Ro'yxatda yo'q hisob bo'lsa — katakni BO'SH QOLDIR.`,
  `3. Nomni O'ZBEK tilida yoz (masalan: Materiallar, Asosiy ishlab chiqarish).`,
  `4. "assa", "anklar", "Moliyaviyatijalar" kabi so'zlar TO'G'RI EMAS.`,
].join("\n");

/**
 * "Nomi" / "Наименование" kabi sarlavhali ustun — BILIM ustuni.
 * Bu ustun matn bo'lsa ham to'ldiriladi, chunki unda so'z yoziladi.
 */
// "Номи", "Ном", "Наименование", "Наименование счета", "Account name"
const NAME_WORDS = /^\s*номи?\s*$|наименование|account\s*name|hisob\s*nomi/i;

/** Bu sarlavha nom yoziladigan bilim ustuni ekanini tekshiradi. */
export function isNameHeader(v: string): boolean {
  return NAME_WORDS.test(String(v).toLowerCase().replace(/\s+/g, " "));
}

/** "Бух.счет" kabi hisob raqami ustunining sarlavhasi. */
export function isCodeHeader(v: string): boolean {
  return /бух\.?\s*счет|hisob\s*(raqam|raqami|tomer)|schet|account\s*(no|number)/i.test(
    String(v).replace(/\s+/g, " ").trim(),
  );
}

/** Rejaga qo'yish uchun umumiy ko'rinish. */
export function nsbuTable(): string {
  return NSBU_ACCOUNTS.map((a) => `${a.code}\t${a.uz}`).join("\n");
}