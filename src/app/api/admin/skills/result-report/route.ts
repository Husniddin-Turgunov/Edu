import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { PDFDocument, rgb, PDFFont } from "pdf-lib";
import * as fontkitNS from "@pdf-lib/fontkit";
// CJS/ESM interop: ba'zi bundlerlarda fontkit `default` ostida keladi
const fontkit: any = (fontkitNS as any).default || fontkitNS;
import { readFile } from "node:fs/promises";
import path from "node:path";
import { computeResultStats } from "@/lib/result-stats";

export const dynamic = "force-dynamic";
const prisma = new PrismaClient();

/**
 * GET ?resultId=xxx — BITTA test natijasi uchun A4 PDF.
 * Ichida: xodim ma'lumotlari, test, ball/daraja/holat,
 * to'g'ri va xato javoblar soni hamda savollar bo'yicha tafsilot.
 */
export async function GET(req: NextRequest) {
  try {
    const resultId = new URL(req.url).searchParams.get("resultId") || "";
    if (!resultId) return NextResponse.json({ error: "resultId required" }, { status: 400 });

    const result: any = await prisma.testResult.findUnique({
      where: { id: resultId },
      include: {
        user: true,
        test: {
          include: {
            questions: { include: { choices: true }, orderBy: { order: "asc" } },
          },
        },
      },
    });
    if (!result) return NextResponse.json({ error: "Result not found" }, { status: 404 });

    const user: any = result.user || {};
    const test: any = result.test || {};
    const stats = computeResultStats(test.questions, result.answers);
    const fullName =
      [user.surname, user.name].filter(Boolean).join(" ").trim() || user.email || "Noma'lum";
    const score: number | null = typeof result.score === "number" ? result.score : null;
    const level =
      score == null ? "Baholanmagan" : score >= 86 ? "I daraja" : score >= 70 ? "II daraja" : "III daraja";
    const when = result.completedAt ? new Date(result.completedAt) : null;
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = when
      ? `${pad(when.getDate())}.${pad(when.getMonth() + 1)}.${when.getFullYear()} ${pad(when.getHours())}:${pad(when.getMinutes())}`
      : "—";

    const doc = await PDFDocument.create();
    (doc as any).registerFontkit(fontkit);
    const fontDir = path.join(process.cwd(), "public", "fonts");
    const fontReg = await doc.embedFont(await readFile(path.join(fontDir, "NotoSans-Regular.ttf")));
    const fontBold = await doc.embedFont(await readFile(path.join(fontDir, "NotoSans-Bold.ttf")));

    const A4W = 595.28;
    const A4H = 841.89;
    const M = 42;
    const maxW = A4W - M * 2;
    const INK = rgb(0.13, 0.16, 0.22);
    const MUT = rgb(0.42, 0.46, 0.55);
    const ACC = rgb(0.05, 0.55, 0.45);
    const LINE = rgb(0.88, 0.9, 0.93);
    const GREEN = rgb(0.02, 0.59, 0.41);
    const RED = rgb(0.86, 0.15, 0.24);
    const AMBER = rgb(0.72, 0.45, 0.02);

    const wrap = (text: string, font: PDFFont, size: number, w: number): string[] => {
      const words = String(text || "").split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let cur = "";
      for (const wd of words) {
        const t = cur ? cur + " " + wd : wd;
        if (font.widthOfTextAtSize(t, size) <= w || !cur) cur = t;
        else {
          lines.push(cur);
          cur = wd;
        }
      }
      if (cur) lines.push(cur);
      return lines.length ? lines : [""];
    };

    let page = doc.addPage([A4W, A4H]);
    let y = A4H - M;
    const need = (h: number) => {
      if (y - h < M) {
        page = doc.addPage([A4W, A4H]);
        y = A4H - M;
      }
    };


    // ===== Sarlavha =====
    page.drawText("AKELA GROUP", { x: M, y, size: 11, font: fontBold, color: ACC });
    const dstr = new Date().toLocaleDateString("uz-UZ");
    page.drawText(dstr, {
      x: A4W - M - fontReg.widthOfTextAtSize(dstr, 9) - 2,
      y,
      size: 9,
      font: fontReg,
      color: MUT,
    });
    y -= 22;
    page.drawText("Test natijasi (yakka hisobot)", { x: M, y, size: 17, font: fontBold, color: INK });
    y -= 10;
    page.drawLine({ start: { x: M, y }, end: { x: A4W - M, y }, thickness: 1.5, color: ACC });
    y -= 16;

    // ===== Xodim + test ma'lumotlari =====
    const info: [string, string][] = [
      ["F.I.Sh:", fullName],
      ["Email:", user.email || "—"],
      ["Bo'lim:", user.department || "Belgilanmagan"],
      ["Lavozim:", user.position || "—"],
      ["Test:", test.title || "Test"],
      ["Sana:", dateStr],
      ["Ball:", (score != null ? score + "%" : "—") + "  (o'tish bali: " + (test.passScore ?? "—") + "%)"],
      ["Daraja:", level + "  |  Holat: " + (result.passed ? "O'tdi" : "Yiqildi")],
    ];
    for (const pair of info) {
      need(16);
      page.drawText(pair[0], { x: M, y, size: 10, font: fontBold, color: INK });
      const kw = fontBold.widthOfTextAtSize(pair[0], 10);
      for (const ln of wrap(pair[1], fontReg, 10, maxW - kw - 8).slice(0, 2)) {
        page.drawText(ln, { x: M + kw + 8, y, size: 10, font: fontReg, color: INK });
        y -= 14;
        need(16);
      }
    }
    y -= 6;

    // ===== To'g'ri / xato / jami =====
    need(44);
    const boxes: [string, string, any][] = [
      [String(stats.total), "Jami savol", INK],
      [String(stats.correct), "To'g'ri javob", GREEN],
      [String(stats.wrong), "Noto'g'ri javob", RED],
      [String(stats.pending), "Baholanmagan", AMBER],
    ];
    const boxW = maxW / 4;
    boxes.forEach(([v, l, color], i) => {
      const bx = M + i * boxW;
      page.drawRectangle({
        x: bx + 2,
        y: y - 34,
        width: boxW - 4,
        height: 36,
        borderColor: LINE,
        borderWidth: 1,
        color: rgb(0.97, 0.98, 0.99),
      });
      page.drawText(v, {
        x: bx + 2 + (boxW - 4) / 2 - fontBold.widthOfTextAtSize(v, 13) / 2,
        y: y - 18,
        size: 13,
        font: fontBold,
        color,
      });
      page.drawText(l, {
        x: bx + 2 + (boxW - 4) / 2 - fontReg.widthOfTextAtSize(l, 8) / 2,
        y: y - 30,
        size: 8,
        font: fontReg,
        color: MUT,
      });
    });
    y -= 48;

    if (stats.truncated) {
      need(16);
      page.drawText(
        "Eslatma: bu natija eski formatda saqlangan — ayrim javoblar bazada to'liq emas.",
        { x: M, y, size: 8, font: fontReg, color: AMBER },
      );
      y -= 16;
    }


    // ===== Savollar bo'yicha jadval =====
    const colNo = 26;
    const colRes = 74;
    const colText = maxW - colNo - colRes;
    need(22);
    page.drawRectangle({ x: M, y: y - 6, width: maxW, height: 20, color: rgb(0.1, 0.32, 0.3) });
    page.drawText("#", { x: M + 5, y, size: 9, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText("Savol", { x: M + colNo + 5, y, size: 9, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText("Natija", {
      x: M + colNo + colText + 5,
      y,
      size: 9,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    y -= 20;

    stats.perQuestion.forEach((item, idx) => {
      const q = item.question;
      const lines = wrap(q.text || "(savol matni yo'q)", fontReg, 9, colText - 10).slice(0, 4);
      const rh = Math.max(20, lines.length * 12 + 6);
      need(rh);
      if (idx % 2 === 1) {
        page.drawRectangle({
          x: M,
          y: y - rh + 6,
          width: maxW,
          height: rh,
          color: rgb(0.96, 0.98, 0.98),
        });
      }
      page.drawText(String(idx + 1), { x: M + 5, y: y - 4, size: 9, font: fontBold, color: MUT });
      lines.forEach((ln, li) => {
        page.drawText(ln, {
          x: M + colNo + 5,
          y: y - 4 - li * 12,
          size: 9,
          font: fontReg,
          color: INK,
        });
      });
      const label = item.ok === true ? "To'g'ri" : item.ok === false ? "Xato" : "Baholanmagan";
      const color = item.ok === true ? GREEN : item.ok === false ? RED : AMBER;
      page.drawText(label, { x: M + colNo + colText + 5, y: y - 4, size: 9, font: fontBold, color });
      y -= rh;
      page.drawLine({
        start: { x: M, y: y + 6 },
        end: { x: A4W - M, y: y + 6 },
        thickness: 0.5,
        color: LINE,
      });
    });
    if (!stats.perQuestion.length) {
      need(18);
      page.drawText("Savollar topilmadi.", { x: M, y, size: 10, font: fontReg, color: MUT });
      y -= 18;
    }

    // ===== Imzolar =====
    y -= 20;
    need(56);
    page.drawText("Xodim imzosi: ___________________", { x: M, y, size: 10, font: fontReg, color: INK });
    y -= 18;
    page.drawText("Bo'lim rahbari imzosi: ___________________", {
      x: M,
      y,
      size: 10,
      font: fontReg,
      color: INK,
    });
    y -= 18;
    page.drawText("AKELA GROUP · Malaka tekshirish tizimi", {
      x: M,
      y,
      size: 8,
      font: fontReg,
      color: MUT,
    });

    const pages = doc.getPages();
    pages.forEach((p, i) => {
      const t = i + 1 + " / " + pages.length;
      p.drawText(t, {
        x: A4W - M - fontReg.widthOfTextAtSize(t, 8),
        y: 24,
        size: 8,
        font: fontReg,
        color: MUT,
      });
    });

    const bytes = await doc.save();
    const safe = fullName.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 50) || "natija";
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="AKELA-natija-' + safe + '.pdf"',
        "Content-Length": String(bytes.length),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
