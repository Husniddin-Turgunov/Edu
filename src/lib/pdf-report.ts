/**
 * A4 PDF hisobotlar — bitta manba, ikki mijoz.
 *
 * `buildUserReportPdf`  — bitta hodimning BARCHA test natijalari (admin panel
 *                          va Telegram'dagi "📄 Umumiy PDF hisobot" tugmasi).
 * `buildResultReportPdf` — BITTA test natijasi, savollar bo'yicha tafsilot bilan
 *                          ("📄 N-PDF" tugmasi).
 *
 * Nima uchun alohida lib:
 *  - Telegram webhook ichida PDF'ni xotirada yig'ib, multipart orqali yuboramiz.
 *    Demak bot uchun umumiy (ochiq, kuchsiz himoyasiz) URL kerak emas — admin
 *    sessiyasi ham kerak bo'lmaydi.
 *  - API route'lar (`/api/admin/skills/*-report`) shu libdan foydalanadi, shuning
 *    uchun ikkala yo'l bir xil ko'rinishdagi hujjat chiqaradi.
 *
 * Shriftlar: avval `public/fonts` dan fayl tizimi orqali (Vercel'da
 * `outputFileTracingIncludes` orqali bundle'ga kiritilgan), keyin o'z
 * originimizdan HTTP bilan. Xotira (warm lambda) da keshda saqlanadi.
 */

import { PDFDocument, PDFFont, rgb } from "pdf-lib";
import * as fontkitNS from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { computeResultStats, type StatQuestion } from "@/lib/result-stats";

// CJS/ESM interop: ba'zi bundlerlarda fontkit `default` ostida keladi
const fontkit: any = (fontkitNS as any).default || fontkitNS;

// ====== O'lchamlar / ranglar ======

const A4W = 595.28;
const A4H = 841.89;
const M = 42;
const MAXW = A4W - M * 2;

const INK = rgb(0.13, 0.16, 0.22);
const MUT = rgb(0.42, 0.46, 0.55);
const ACC = rgb(0.05, 0.55, 0.45);
const LINE = rgb(0.88, 0.9, 0.93);
const GREEN = rgb(0.02, 0.59, 0.41);
const RED = rgb(0.86, 0.15, 0.24);
const AMBER = rgb(0.72, 0.45, 0.02);
const HEAD_BG = rgb(0.1, 0.32, 0.3);
const BOX_BG = rgb(0.97, 0.98, 0.99);
const ZEBRA = rgb(0.96, 0.98, 0.98);

// ====== Tiplar ======

export type PdfUser = {
  name?: string | null;
  surname?: string | null;
  email?: string | null;
  department?: string | null;
  position?: string | null;
};

export type PdfAttempt = {
  title: string;
  score: number | null;
  passed: boolean;
  completedAt: string | null;
  correct: number;
  wrong: number;
  total: number;
};

export type UserReportInput = {
  user: PdfUser;
  attempts: PdfAttempt[];
};

export type ResultReportInput = {
  user: PdfUser;
  testTitle: string;
  passScore: number | null;
  score: number | null;
  passed: boolean;
  completedAt: string | null;
  questions: StatQuestion[] | null | undefined;
  answersJson: string | null | undefined;
};

// ====== Shriftlar ======

const FONT_FILES = {
  regular: "NotoSans-Regular.ttf",
  bold: "NotoSans-Bold.ttf",
} as const;

type FontBytes = { regular: Uint8Array; bold: Uint8Array };
let fontBytesCache: FontBytes | null = null;

async function readFontBytes(file: string, origin?: string): Promise<Uint8Array | null> {
  // 1) Fayl tizimi (build/runtime tracing orqali keladi)
  try {
    return new Uint8Array(await readFile(path.join(process.cwd(), "public", "fonts", file)));
  } catch {
    /* keyingi yo'lga o'tamiz */
  }
  // 2) O'z originimiz orqali (public/fonts CDN da)
  if (!origin) return null;
  try {
    const res = await fetch(`${origin.replace(/\/$/, "")}/fonts/${file}`);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Noto Sans (regular + bold) baytlarini oladi. Ikkala shrift ham topilmasa
 * `null` qaytaradi — pdf-lib standart (WinAnsi) shrift bilan ishlaydi, lekin
 * o'zbek kirill harflari chiqmaydi.
 */
export async function loadPdfFonts(origin?: string): Promise<FontBytes | null> {
  if (fontBytesCache) return fontBytesCache;
  const regular = await readFontBytes(FONT_FILES.regular, origin);
  const bold = await readFontBytes(FONT_FILES.bold, origin);
  if (!regular || !bold) return null;
  fontBytesCache = { regular, bold };
  return fontBytesCache;
}

/** `PDFFont` juftligini tayyorlaydi; NotoSans topilmasa standart shrift. */
async function makeDoc(origin?: string) {
  const doc = await PDFDocument.create();
  (doc as any).registerFontkit(fontkit);
  const fonts = await loadPdfFonts(origin);
  if (fonts) {
    return {
      doc,
      regular: await doc.embedFont(fonts.regular),
      bold: await doc.embedFont(fonts.bold),
      embedded: true,
    };
  }
  const standard = await doc.embedFont("Helvetica");
  const standardBold = await doc.embedFont("Helvetica-Bold");
  return { doc, regular: standard, bold: standardBold, embedded: false };
}

// ====== Yordamchilar ======

/** Ball bo'yicha bilim darajasi (admin/skills va bot bir xil mantiqda). */
export function levelOfScore(score: number | null | undefined): string {
  const s = typeof score === "number" ? score : 0;
  if (s >= 86) return "I daraja";
  if (s >= 70) return "II daraja";
  if (s > 0) return "III daraja";
  return "Baholanmagan";
}

export function fullNameOf(user: PdfUser): string {
  return (
    [user.surname, user.name].filter(Boolean).join(" ").trim() ||
    user.email ||
    "Noma'lum"
  );
}

/** Fayl nomi uchun xavfsiz satr (Telegram va HTTP header'larida ishlatiladi). */
export function safeFileName(value: string, fallback: string): string {
  const cleaned = String(value || "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned || fallback;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const candidate = cur ? cur + " " + word : word;
    if (font.widthOfTextAtSize(candidate, size) <= width || !cur) cur = candidate;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ====== Sahifa yordamchilari ======

type PageBox = {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  page: any;
  y: number;
};

function newPage(box: PageBox) {
  box.page = box.doc.addPage([A4W, A4H]);
  box.y = A4H - M;
}

function need(box: PageBox, height: number) {
  if (box.y - height < M) newPage(box);
}

function header(box: PageBox, title: string) {
  box.page.drawText("AKELA GROUP", { x: M, y: box.y, size: 11, font: box.bold, color: ACC });
  const today = new Date().toLocaleDateString("uz-UZ");
  box.page.drawText(today, {
    x: A4W - M - box.regular.widthOfTextAtSize(today, 9) - 2,
    y: box.y,
    size: 9,
    font: box.regular,
    color: MUT,
  });
  box.y -= 22;
  box.page.drawText(title, { x: M, y: box.y, size: 17, font: box.bold, color: INK });
  box.y -= 10;
  box.page.drawLine({
    start: { x: M, y: box.y },
    end: { x: A4W - M, y: box.y },
    thickness: 1.5,
    color: ACC,
  });
  box.y -= 16;
}

/** "Kalit: qiymat" qatorlari — qiymat keng bo'lsa ikki qatorga o'tadi. */
function infoRows(box: PageBox, rows: [string, string][]) {
  for (const [label, value] of rows) {
    need(box, 16);
    box.page.drawText(label, { x: M, y: box.y, size: 10, font: box.bold, color: INK });
    const labelWidth = box.bold.widthOfTextAtSize(label, 10);
    const lines = wrap(value, box.regular, 10, MAXW - labelWidth - 8).slice(0, 2);
    for (const line of lines) {
      box.page.drawText(line, { x: M + labelWidth + 8, y: box.y, size: 10, font: box.regular, color: INK });
      box.y -= 14;
      need(box, 16);
    }
  }
}

/** To'rtta yonma yon statistik qutisi. */
function statBoxes(box: PageBox, items: [string, string, any][]) {
  need(box, 44);
  const boxWidth = MAXW / items.length;
  items.forEach(([value, label, color], i) => {
    const x = M + i * boxWidth;
    box.page.drawRectangle({
      x: x + 2,
      y: box.y - 34,
      width: boxWidth - 4,
      height: 36,
      borderColor: LINE,
      borderWidth: 1,
      color: BOX_BG,
    });
    box.page.drawText(value, {
      x: x + 2 + (boxWidth - 4) / 2 - box.bold.widthOfTextAtSize(value, 13) / 2,
      y: box.y - 18,
      size: 13,
      font: box.bold,
      color,
    });
    box.page.drawText(label, {
      x: x + 2 + (boxWidth - 4) / 2 - box.regular.widthOfTextAtSize(label, 8) / 2,
      y: box.y - 30,
      size: 8,
      font: box.regular,
      color: MUT,
    });
  });
  box.y -= 48;
}

/** Jadval sarlavhasi (to'q yashil fonda oq matn). */
function tableHead(box: PageBox, columns: { t: string; w: number }[]) {
  need(box, 22);
  box.page.drawRectangle({ x: M, y: box.y - 6, width: MAXW, height: 20, color: HEAD_BG });
  let x = M;
  for (const col of columns) {
    box.page.drawText(col.t, { x: x + 5, y: box.y, size: 9, font: box.bold, color: rgb(1, 1, 1) });
    x += col.w;
  }
  box.y -= 20;
}

function rowSeparator(box: PageBox) {
  box.page.drawLine({
    start: { x: M, y: box.y + 6 },
    end: { x: A4W - M, y: box.y + 6 },
    thickness: 0.5,
    color: LINE,
  });
}

function signatures(box: PageBox, footerNote: string) {
  box.y -= 20;
  need(box, 58);
  box.page.drawText("Bo'lim rahbari imzosi: ___________________", {
    x: M, y: box.y, size: 10, font: box.regular, color: INK,
  });
  box.y -= 18;
  box.page.drawText("HR / Malaka bo'limi imzosi: ___________________", {
    x: M, y: box.y, size: 10, font: box.regular, color: INK,
  });
  box.y -= 18;
  box.page.drawText(footerNote, { x: M, y: box.y, size: 8, font: box.regular, color: MUT });
}

function pageNumbers(doc: PDFDocument, regular: PDFFont) {
  const pages = doc.getPages();
  pages.forEach((page, i) => {
    const label = i + 1 + " / " + pages.length;
    page.drawText(label, {
      x: A4W - M - regular.widthOfTextAtSize(label, 8),
      y: 24,
      size: 8,
      font: regular,
      color: MUT,
    });
  });
}

// ====== 1) Bitta hodim — barcha testlar ======

export async function buildUserReportPdf(
  input: UserReportInput,
  origin?: string,
): Promise<Uint8Array> {
  const { doc, regular, bold } = await makeDoc(origin);
  const user = input.user || {};
  const attempts = Array.isArray(input.attempts) ? input.attempts : [];
  const fullName = fullNameOf(user);

  const scores = attempts
    .map((a) => a.score)
    .filter((s): s is number => typeof s === "number");
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const level = levelOfScore(avg);
  const passedCount = attempts.filter((a) => a.passed).length;
  const totalCorrect = attempts.reduce((sum, a) => sum + a.correct, 0);
  const totalWrong = attempts.reduce((sum, a) => sum + a.wrong, 0);

  const box: PageBox = { doc, regular, bold, page: null, y: 0 };
  newPage(box);
  header(box, "Xodim malaka natijalari hisoboti");

  infoRows(box, [
    ["F.I.Sh:", fullName],
    ["Email:", user.email || "—"],
    ["Bo'lim:", user.department || "Belgilanmagan"],
    ["Lavozim:", user.position || "—"],
    ["Daraja:", level + "  |  O'rtacha ball: " + avg + "%"],
  ]);
  box.y -= 4;

  statBoxes(box, [
    [String(attempts.length), "Topshirish", INK],
    [String(passedCount), "O'tilgan", GREEN],
    [String(totalCorrect), "Jami to'g'ri", GREEN],
    [String(totalWrong), "Jami xato", totalWrong > 0 ? RED : MUT],
  ]);

  const columns = [
    { t: "Test nomi", w: MAXW * 0.38 },
    { t: "Ball", w: MAXW * 0.1 },
    { t: "To'g'ri", w: MAXW * 0.11 },
    { t: "Xato", w: MAXW * 0.09 },
    { t: "Holat", w: MAXW * 0.13 },
    { t: "Sana", w: MAXW * 0.19 },
  ];
  tableHead(box, columns);

  if (!attempts.length) {
    need(box, 20);
    box.page.drawText("Xodim hali test topshirmagan.", {
      x: M, y: box.y, size: 10, font: regular, color: MUT,
    });
    box.y -= 18;
  }

  attempts.forEach((attempt, idx) => {
    const titleLines = wrap(attempt.title, regular, 9, columns[0].w - 10).slice(0, 3);
    const rowHeight = Math.max(22, titleLines.length * 12 + 8);
    need(box, rowHeight);
    if (idx % 2 === 1) {
      box.page.drawRectangle({
        x: M, y: box.y - rowHeight + 6, width: MAXW, height: rowHeight, color: ZEBRA,
      });
    }
    titleLines.forEach((line, li) => {
      box.page.drawText(line, { x: M + 5, y: box.y - 4 - li * 12, size: 9, font: regular, color: INK });
    });
    let x = M + columns[0].w;
    const cell = (text: string, col: { w: number }, font: PDFFont, color: any = INK, size = 9) => {
      box.page.drawText(text, { x: x + 5, y: box.y - 4, size, font, color });
      x += col.w;
    };
    cell(attempt.score != null ? attempt.score + "%" : "—", columns[1], bold);
    cell(attempt.correct + "/" + attempt.total, columns[2], bold, GREEN);
    cell(String(attempt.wrong), columns[3], bold, attempt.wrong > 0 ? RED : MUT);
    cell(attempt.passed ? "O'tdi" : "Yiqildi", columns[4], regular, attempt.passed ? GREEN : RED);
    cell(formatDate(attempt.completedAt), columns[5], regular, MUT, 8);
    box.y -= rowHeight;
    rowSeparator(box);
  });

  signatures(box, "AKELA GROUP · Malaka tekshirish tizimi");
  pageNumbers(doc, regular);
  return doc.save();
}

// ====== 2) BitTA test natijasi — savollar bo'yicha ======

export async function buildResultReportPdf(
  input: ResultReportInput,
  origin?: string,
): Promise<Uint8Array> {
  const { doc, regular, bold } = await makeDoc(origin);
  const user = input.user || {};
  const stats = computeResultStats(input.questions, input.answersJson);
  const fullName = fullNameOf(user);
  const score = typeof input.score === "number" ? input.score : null;
  const level = levelOfScore(score);

  const box: PageBox = { doc, regular, bold, page: null, y: 0 };
  newPage(box);
  header(box, "Test natijasi (yakka hisobot)");

  infoRows(box, [
    ["F.I.Sh:", fullName],
    ["Email:", user.email || "—"],
    ["Bo'lim:", user.department || "Belgilanmagan"],
    ["Lavozim:", user.position || "—"],
    ["Test:", input.testTitle || "Test"],
    ["Sana:", formatDate(input.completedAt)],
    [
      "Ball:",
      (score != null ? score + "%" : "—") +
        "  (o'tish bali: " + (input.passScore != null ? input.passScore : "—") + "%)",
    ],
    ["Daraja:", level + "  |  Holat: " + (input.passed ? "O'tdi" : "Yiqildi")],
  ]);
  box.y -= 6;

  statBoxes(box, [
    [String(stats.total), "Jami savol", INK],
    [String(stats.correct), "To'g'ri javob", GREEN],
    [String(stats.wrong), "Noto'g'ri javob", RED],
    [String(stats.pending), "Baholanmagan", AMBER],
  ]);

  if (stats.truncated) {
    need(box, 16);
    box.page.drawText(
      "Eslatma: bu natija eski formatda saqlangan — ayrim javoblar bazada to'liq emas.",
      { x: M, y: box.y, size: 8, font: regular, color: AMBER },
    );
    box.y -= 16;
  }

  const colNo = 26;
  const colText = MAXW - colNo - 74;
  tableHead(box, [
    { t: "#", w: colNo },
    { t: "Savol", w: colText },
    { t: "Natija", w: 74 },
  ]);

  if (!stats.perQuestion.length) {
    need(box, 18);
    box.page.drawText("Savollar topilmadi.", { x: M, y: box.y, size: 10, font: regular, color: MUT });
    box.y -= 18;
  }

  stats.perQuestion.forEach((item, idx) => {
    const lines = wrap(item.question.text || "(savol matni yo'q)", regular, 9, colText - 10).slice(0, 4);
    const rowHeight = Math.max(20, lines.length * 12 + 6);
    need(box, rowHeight);
    if (idx % 2 === 1) {
      box.page.drawRectangle({
        x: M, y: box.y - rowHeight + 6, width: MAXW, height: rowHeight, color: ZEBRA,
      });
    }
    box.page.drawText(String(idx + 1), { x: M + 5, y: box.y - 4, size: 9, font: bold, color: MUT });
    lines.forEach((line, li) => {
      box.page.drawText(line, {
        x: M + colNo + 5, y: box.y - 4 - li * 12, size: 9, font: regular, color: INK,
      });
    });
    const label = item.ok === true ? "To'g'ri" : item.ok === false ? "Xato" : "Baholanmagan";
    const color = item.ok === true ? GREEN : item.ok === false ? RED : AMBER;
    box.page.drawText(label, {
      x: M + colNo + colText + 5, y: box.y - 4, size: 9, font: bold, color,
    });
    box.y -= rowHeight;
    rowSeparator(box);
  });

  signatures(box, "Xodim imzosi: ___________________");
  pageNumbers(doc, regular);
  return doc.save();
}

// ====== Fayl nomlari ======

export function userReportFileName(user: PdfUser): string {
  return "AKELA-hisobot-" + safeFileName(fullNameOf(user), "hisobot") + ".pdf";
}

export function resultReportFileName(user: PdfUser): string {
  return "AKELA-natija-" + safeFileName(fullNameOf(user), "natija") + ".pdf";
}
