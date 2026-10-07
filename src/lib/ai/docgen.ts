/**
 * lib/ai/docgen.ts
 *
 * JSON spetsifikatsiyadan Excel/Word/PDF generatsiya.
 *
 * ARXITEKTURA: LLM ixtiyoriy kod yozmaydi va bajarmaydi — faqat yuqoridagi
 * `DocSpec` JSON'ni hosil qiladi, bu modul uni faylga aylantiradi. Shuning
 * uchun injection orqali fayl tizimiga chiqib bo'lmaydi: yo'llar qat'iy,
 * o'lchamlar chegaralangan, matnlar escape qilinadi.
 *
 * Cheklovlar: varaq ≤10, qator ≤5000/varaq, blok ≤200, jami matn ≤200K,
 * fayl ≤25MB. Diagramma: exceljs native chart qo'llamaydi — chart spec
 * bo'lsa alohida "Diagramma" varag'i + izoh yoziladi (foydalanuvchi Excel'da
 * 2 bosishda grafik yasaydi); bu ochiq cheklov sifatida qayd etilgan.
 */

import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, WidthType, AlignmentType, Footer, PageNumber } from "docx";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as fontkitNS from "@pdf-lib/fontkit";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";

const fontkit: any = (fontkitNS as any).default || fontkitNS;

// --- Spec tiplari (LLM shu shaklda JSON hosil qiladi) ---

export type ExcelSheetSpec = {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
  columnWidths?: number[];
  autofilter?: boolean;
  freezeHeader?: boolean;
  totalsRow?: { label: string; columns: number[] };
  chartNote?: { title: string; type: string; labelColumn: number; valueColumns: number[] };
};

export type ExcelSpec = {
  kind: "excel";
  filename: string;
  title?: string;
  sheets: ExcelSheetSpec[];
};

export type WordBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullet"; items: string[] }
  | { type: "numbered"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

export type WordSpec = {
  kind: "word";
  filename: string;
  title?: string;
  subtitle?: string;
  blocks: WordBlock[];
  footer?: string;
};

export type PdfSpec = {
  kind: "pdf";
  filename: string;
  title?: string;
  blocks: WordBlock[];
};

export type DocSpec = ExcelSpec | WordSpec | PdfSpec;

// --- Cheklovlar ---

const MAX_SHEETS = 10;
const MAX_ROWS_PER_SHEET = 5000;
const MAX_COLS = 50;
const MAX_BLOCKS = 200;
const MAX_TEXT_TOTAL = 200_000;

const s = (v: unknown, max = 2000): string => String(v ?? "").slice(0, max);
const n = (v: unknown): number | string => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return s(v, 500);
};

function assertExcelSpec(spec: ExcelSpec) {
  if (!Array.isArray(spec.sheets) || spec.sheets.length === 0) throw new Error("Excel: kamida bitta varaq kerak");
  if (spec.sheets.length > MAX_SHEETS) throw new Error(`Excel: varaqlar ko'pi bilan ${MAX_SHEETS} ta`);
  let total = 0;
  for (const sh of spec.sheets) {
    if (!sh.name) throw new Error("Excel: varaq nomi kerak");
    if (!Array.isArray(sh.headers) || sh.headers.length === 0) throw new Error(`Excel "${sh.name}": sarlavhalar kerak`);
    if (sh.headers.length > MAX_COLS) throw new Error(`Excel "${sh.name}": ustunlar ko'pi bilan ${MAX_COLS} ta`);
    if (!Array.isArray(sh.rows)) throw new Error(`Excel "${sh.name}": qatorlar ro'yxati kerak`);
    if (sh.rows.length > MAX_ROWS_PER_SHEET) throw new Error(`Excel "${sh.name}": qatorlar ko'pi bilan ${MAX_ROWS_PER_SHEET} ta`);
    total += sh.headers.join("").length + JSON.stringify(sh.rows).length;
  }
  if (total > MAX_TEXT_TOTAL) throw new Error("Excel: jami matn hajmi chegaradan oshdi");
}

function assertWordBlocks(blocks: WordBlock[]) {
  if (!Array.isArray(blocks) || blocks.length === 0) throw new Error("Hujjat: kamida bitta blok kerak");
  if (blocks.length > MAX_BLOCKS) throw new Error(`Hujjat: bloklar ko'pi bilan ${MAX_BLOCKS} ta`);
  const total = JSON.stringify(blocks).length;
  if (total > MAX_TEXT_TOTAL) throw new Error("Hujjat: jami matn hajmi chegaradan oshdi");
}

// --- Excel ---

export async function buildExcel(spec: ExcelSpec, outPath: string): Promise<{ bytes: number }> {
  assertExcelSpec(spec);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Akela AI";
  wb.created = new Date();
  if (spec.title) wb.title = s(spec.title, 200);

  const headerFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  const titleFont: Partial<ExcelJS.Font> = { bold: true, size: 14, color: { argb: "FF1F4E79" } };

  for (const sh of spec.sheets.slice(0, MAX_SHEETS)) {
    const ws = wb.addWorksheet(s(sh.name, 31).replace(/[*?:/\\[\]]/g, " ") || "Varaq");
    let rowIdx = 1;

    if (spec.title) {
      ws.mergeCells(1, 1, 1, Math.min(sh.headers.length, MAX_COLS));
      const titleCell = ws.getCell(1, 1);
      titleCell.value = s(spec.title, 200);
      titleCell.font = titleFont;
      rowIdx = 2;
    }

    const headerRow = ws.getRow(rowIdx);
    sh.headers.slice(0, MAX_COLS).forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = s(h, 500);
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    headerRow.commit();
    const headerRowIdx = rowIdx;
    rowIdx++;

    const cols = Math.min(sh.headers.length, MAX_COLS);
    for (const r of sh.rows.slice(0, MAX_ROWS_PER_SHEET)) {
      const row = ws.getRow(rowIdx);
      for (let c = 0; c < cols; c++) {
        const v = Array.isArray(r) ? r[c] : null;
        row.getCell(c + 1).value = typeof v === "number" && Number.isFinite(v) ? v : s(v, 5000);
      }
      row.commit();
      rowIdx++;
    }
    const lastDataRow = rowIdx - 1;

    // Jami qatori (SUM formulalar — `result` bilan, aks holda Excel
    // faylda formula saqlanmaydi)
    if (sh.totalsRow && lastDataRow >= headerRowIdx + 1) {
      const totalRowIdx = rowIdx;
      ws.getCell(totalRowIdx, 1).value = s(sh.totalsRow.label, 200);
      ws.getCell(totalRowIdx, 1).font = { bold: true };
      for (const col of sh.totalsRow.columns.slice(0, cols)) {
        const colLetter = ws.getColumn(col + 1).letter;
        let sum = 0;
        for (let r = headerRowIdx + 1; r <= lastDataRow; r++) {
          const v = ws.getCell(r, col + 1).value;
          if (typeof v === "number" && Number.isFinite(v)) sum += v;
        }
        ws.getCell(totalRowIdx, col + 1).value = {
          formula: `SUM(${colLetter}${headerRowIdx + 1}:${colLetter}${lastDataRow})`,
          result: sum,
        };
        ws.getCell(totalRowIdx, col + 1).font = { bold: true };
      }
      rowIdx++;
    }

    // Ustun kengligi
    sh.headers.slice(0, cols).forEach((_, i) => {
      const w = Array.isArray(sh.columnWidths) && sh.columnWidths[i] ? Math.min(60, Math.max(8, sh.columnWidths[i])) : 18;
      ws.getColumn(i + 1).width = w;
    });

    // Filtr va sarlavhani qotirish
    if (sh.autofilter !== false && lastDataRow >= headerRowIdx) {
      ws.autoFilter = { from: { row: headerRowIdx, column: 1 }, to: { row: lastDataRow, column: cols } };
    }
    if (sh.freezeHeader !== false) {
      ws.views = [{ state: "frozen", ySplit: headerRowIdx }];
    }

    // Diagramma eslatmasi (exceljs native chart qo'llamaydi — ochiq cheklov)
    if (sh.chartNote) {
      const noteRow = ws.getRow(rowIdx + 1);
      noteRow.getCell(1).value =
        `DIAGRAMMA UCHUN: "${s(sh.chartNote.title, 200)}" (${s(sh.chartNote.type, 20)}). ` +
        `Excel'da Insert → Chart ni tanlang, ma'lumot oralig'i: ${ws.name}!A${headerRowIdx}:${ws.getColumn(cols).letter}${lastDataRow}.`;
      noteRow.getCell(1).font = { italic: true, color: { argb: "FF666666" } };
      noteRow.commit();
    }
  }

  await wb.xlsx.writeFile(outPath);
  const { stat } = await import("node:fs/promises");
  return { bytes: (await stat(outPath)).size };
}

// --- Word ---

const WORD_HEADING = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 };

function wordBlocksToParagraphs(blocks: WordBlock[]): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (const b of blocks.slice(0, MAX_BLOCKS)) {
    if (b.type === "heading") {
      out.push(new Paragraph({ heading: WORD_HEADING[b.level] || HeadingLevel.HEADING_2, children: [new TextRun(s(b.text, 500))] }));
    } else if (b.type === "paragraph") {
      // Bo'sh qatorlar paragraflarga bo'linadi
      for (const para of s(b.text, 10000).split(/\n{2,}/).slice(0, 50)) {
        out.push(new Paragraph({ children: [new TextRun(para.trim())] }));
      }
    } else if (b.type === "bullet") {
      for (const item of (b.items || []).slice(0, 100)) {
        out.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(s(item, 1000))] }));
      }
    } else if (b.type === "numbered") {
      for (const item of (b.items || []).slice(0, 100)) {
        out.push(new Paragraph({ numbering: { reference: "ai-numbering", level: 0 }, children: [new TextRun(s(item, 1000))] }));
      }
    } else if (b.type === "table") {
      const headers = (b.headers || []).slice(0, MAX_COLS);
      const rows = (b.rows || []).slice(0, 500);
      if (headers.length === 0) continue;
      const headerCells = headers.map(
        (h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: s(h, 500), bold: true })] })] }),
      );
      const bodyRows = rows.map(
        (r) =>
          new TableRow({
            children: headers.map((_, i) => new TableCell({ children: [new Paragraph({ children: [new TextRun(s(Array.isArray(r) ? r[i] : "", 2000))] })] })),
          }),
      );
      out.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [new TableRow({ children: headerCells }), ...bodyRows],
        }),
      );
    }
  }
  return out;
}

export async function buildWord(spec: WordSpec, outPath: string): Promise<{ bytes: number }> {
  assertWordBlocks(spec.blocks);
  const children: (Paragraph | Table)[] = [];
  if (spec.title) {
    children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(s(spec.title, 300))] }));
  }
  if (spec.subtitle) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: s(spec.subtitle, 300), color: "666666" })] }));
  }
  children.push(...wordBlocksToParagraphs(spec.blocks));

  const doc = new Document({
    creator: "Akela AI",
    title: s(spec.title || spec.filename, 200),
    numbering: {
      config: [{ reference: "ai-numbering", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START }] }],
    },
    sections: [
      {
        children,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: s(spec.footer || "", 200) + "  ", size: 18 }), new TextRun({ children: [PageNumber.CURRENT], size: 18 })],
              }),
            ],
          }),
        },
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const { writeFile, stat } = await import("node:fs/promises");
  await writeFile(outPath, buffer);
  return { bytes: (await stat(outPath)).size };
}

// --- PDF (o'zbekcha belgilar uchun NotoSans) ---

async function loadPdfFonts(pdf: PDFDocument) {
  pdf.registerFontkit(fontkit);
  try {
    const regular = await readFile(path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf"));
    const bold = await readFile(path.join(process.cwd(), "public", "fonts", "NotoSans-Bold.ttf"));
    return { regular: await pdf.embedFont(regular), bold: await pdf.embedFont(bold) };
  } catch {
    return { regular: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };
  }
}

function wrapText(text: string, font: { widthOfTextAtSize(t: string, s: number): number }, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const trial = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(trial, size) > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = trial;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function buildPdf(spec: PdfSpec, outPath: string): Promise<{ bytes: number; pages: number }> {
  assertWordBlocks(spec.blocks);
  const pdf = await PDFDocument.create();
  const { regular, bold } = await loadPdfFonts(pdf);

  const PAGE_W = 595;
  const PAGE_H = 842;
  const MARGIN = 50;
  const MAX_W = PAGE_W - MARGIN * 2;

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  let pages = 1;

  const needSpace = (h: number) => {
    if (y - h < MARGIN) {
      // Sahifa raqami
      page.drawText(String(pages), { x: PAGE_W / 2 - 5, y: 25, size: 9, font: regular, color: rgb(0.5, 0.5, 0.5) });
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      pages++;
    }
  };

  const drawLines = (lines: string[], size: number, useBold: boolean, gap = 4) => {
    const font = useBold ? bold : regular;
    for (const line of lines) {
      needSpace(size + gap);
      page.drawText(line, { x: MARGIN, y: y - size, size, font, color: rgb(0.15, 0.15, 0.15) });
      y -= size + gap;
    }
  };

  if (spec.title) {
    drawLines(wrapText(s(spec.title, 300), bold, 20, MAX_W), 20, true, 8);
    y -= 10;
  }

  for (const b of spec.blocks.slice(0, MAX_BLOCKS)) {
    if (b.type === "heading") {
      const size = b.level === 1 ? 16 : b.level === 2 ? 13 : 11;
      y -= 6;
      drawLines(wrapText(s(b.text, 500), bold, size, MAX_W), size, true, 6);
    } else if (b.type === "paragraph") {
      drawLines(wrapText(s(b.text, 10000), regular, 11, MAX_W), 11, false, 5);
      y -= 4;
    } else if (b.type === "bullet" || b.type === "numbered") {
      const items = (b.items || []).slice(0, 100);
      items.forEach((item, i) => {
        const prefix = b.type === "bullet" ? "• " : `${i + 1}. `;
        drawLines(wrapText(prefix + s(item, 1000), regular, 11, MAX_W), 11, false, 4);
      });
      y -= 4;
    } else if (b.type === "table") {
      const headers = (b.headers || []).slice(0, 6);
      const rows = (b.rows || []).slice(0, 200);
      if (headers.length === 0) continue;
      y -= 4;
      // Oddiy jadval: sarlavha + qatorlar (ustun kengligi teng)
      const colW = MAX_W / headers.length;
      const drawRow = (cells: string[], isHeader: boolean) => {
        const size = 9;
        const cellLines = cells.map((c) => wrapText(s(c, 500), isHeader ? bold : regular, size, colW - 8));
        const maxLines = Math.max(...cellLines.map((l) => l.length), 1);
        needSpace(maxLines * (size + 3) + 8);
        cellLines.forEach((cl, ci) => {
          cl.forEach((line, li) => {
            page.drawText(line, { x: MARGIN + ci * colW + 4, y: y - size - li * (size + 3), size, font: isHeader ? bold : regular, color: rgb(0.15, 0.15, 0.15) });
          });
        });
        y -= maxLines * (size + 3) + 8;
        // Ajratuvchi chiziq
        page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + MAX_W, y }, thickness: isHeader ? 1.2 : 0.4, color: rgb(0.6, 0.6, 0.6) });
        y -= 4;
      };
      drawRow(headers, true);
      for (const r of rows) drawRow(headers.map((_, i) => (Array.isArray(r) ? String(r[i] ?? "") : "")), false);
    }
  }
  page.drawText(String(pages), { x: PAGE_W / 2 - 5, y: 25, size: 9, font: regular, color: rgb(0.5, 0.5, 0.5) });

  const { writeFile, stat } = await import("node:fs/promises");
  await writeFile(outPath, await pdf.save());
  return { bytes: (await stat(outPath)).size, pages };
}

/** Fayl papkasini tayyorlash. */
export async function ensureFilesDir(): Promise<string> {
  const dir = path.join(process.cwd(), "upload", "ai-files");
  await mkdir(dir, { recursive: true });
  return dir;
}

export { n };
