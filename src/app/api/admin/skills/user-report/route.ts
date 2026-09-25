import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { parseAnswersJson } from "@/lib/answers-json";
import { PDFDocument, rgb } from "pdf-lib";
import * as fontkitNS from "@pdf-lib/fontkit";
const fontkit: any = (fontkitNS as any).default || fontkitNS;
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
const prisma = new PrismaClient();

// GET ?userId=xxx -> haqiqiy A4 PDF (attachment, brauzer yuklab oladi).
export async function GET(req: NextRequest) {
  try {
    const userId = new URL(req.url).searchParams.get("userId") || "";
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
    const results = await prisma.testResult.findMany({
      where: { userId, completedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      include: { test: { include: { questions: { include: { choices: true }, orderBy: { order: "asc" } } } } },
    });
    type Row = { title: string; score: number | null; passed: boolean; date: string; correct: number; wrong: number; total: number };
    const rows: Row[] = (results as any[]).map((r) => {
      const answers: Record<string, any> = parseAnswersJson(r.answers).answers;
      const presented: string[] = Array.isArray(answers.__questionIds) ? answers.__questionIds.map(String) : [];
      const qs: any[] = (r.test?.questions || []).filter((q: any) => presented.length === 0 || presented.includes(String(q.id)));
      let correct = 0; let wrong = 0;
      for (const q of qs) {
        const sel = answers[q.id] ?? null;
        if (sel == null || sel === "" || (Array.isArray(sel) && sel.length === 0)) { wrong++; continue; }
        let ok: boolean | null = null;
        if (q.type === "written") { ok = q.correctAnswer ? norm(sel) === norm(q.correctAnswer) : null; }
        else {
          const cIds = (q.choices || []).filter((c: any) => c.isCorrect).map((c: any) => c.id);
          ok = Array.isArray(sel) ? (sel.length === cIds.length && sel.every((s: any) => cIds.includes(s))) : cIds.includes(sel);
        }
        if (ok === true) correct++; else wrong++;
      }
      return {
        title: r.test?.title || "Test",
        score: typeof r.score === "number" ? r.score : null,
        passed: !!r.passed,
        date: r.completedAt ? new Date(r.completedAt).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—",
        correct, wrong, total: qs.length,
      };
    });
    const completed = rows.length;
    const passed = (results as any[]).filter((r) => r.passed).length;
    const scores = (results as any[]).map((r) => r.score).filter((s) => typeof s === "number") as number[];
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const totalCorrect = rows.reduce((a, r) => a + r.correct, 0);
    const totalWrong = rows.reduce((a, r) => a + r.wrong, 0);
    const level = !scores.length ? "Baholanmagan" : avg >= 86 ? "I daraja" : avg >= 70 ? "II daraja" : "III daraja";
    const fullName = [user.surname, user.name].filter(Boolean).join(" ").trim() || user.email;
    const doc = await PDFDocument.create();
    (doc as any).registerFontkit(fontkit);
    const fontDir = path.join(process.cwd(), "public", "fonts");
    const regBytes = await readFile(path.join(fontDir, "NotoSans-Regular.ttf"));
    const boldBytes = await readFile(path.join(fontDir, "NotoSans-Bold.ttf"));
    const fontReg = await doc.embedFont(regBytes);
    const fontBold = await doc.embedFont(boldBytes);
    const A4W = 595.28; const A4H = 841.89; const M = 42;
    const maxW = A4W - M * 2;
    const INK = rgb(0.13, 0.16, 0.22); const MUT = rgb(0.42, 0.46, 0.55);
    const ACC = rgb(0.05, 0.55, 0.45); const LINE = rgb(0.88, 0.9, 0.93);
    const GREEN = rgb(0.02, 0.59, 0.41); const RED = rgb(0.86, 0.15, 0.24);
    const wrap = (text: string, font: any, size: number, w: number): string[] => {
      const words = String(text || "").split(/\s+/).filter(Boolean);
      const lines: string[] = []; let cur = "";
      for (const wd of words) {
        const t = cur ? cur + " " + wd : wd;
        if (font.widthOfTextAtSize(t, size) <= w || !cur) cur = t;
        else { lines.push(cur); cur = wd; }
      }
      if (cur) lines.push(cur);
      return lines.length ? lines : [""];
    };
    let page = doc.addPage([A4W, A4H]);
    let y = A4H - M;
    const need = (h: number) => { if (y - h < M) { page = doc.addPage([A4W, A4H]); y = A4H - M; } };
    page.drawText("AKELA GROUP", { x: M, y, size: 11, font: fontBold, color: ACC });
    const dstr = new Date().toLocaleDateString("uz-UZ");
    page.drawText(dstr, { x: A4W - M - fontReg.widthOfTextAtSize(dstr, 9) - 2, y, size: 9, font: fontReg, color: MUT });
    y -= 22;
    page.drawText("Xodim malaka natijalari hisoboti", { x: M, y, size: 17, font: fontBold, color: INK });
    y -= 10;
    page.drawLine({ start: { x: M, y }, end: { x: A4W - M, y }, thickness: 1.5, color: ACC });
    y -= 16;
    const info: [string, string][] = [
      ["F.I.Sh:", fullName],
      ["Email:", user.email || "—"],
      ["Bo'lim:", user.department || "Belgilanmagan"],
      ["Lavozim:", (user as any).position || "—"],
      ["Daraja:", level + "  |  O'rtacha ball: " + avg + "%"],
    ];
    for (const pair of info) {
      need(16);
      page.drawText(pair[0], { x: M, y, size: 10, font: fontBold, color: INK });
      const kw = fontBold.widthOfTextAtSize(pair[0], 10);
      const lines = wrap(pair[1], fontReg, 10, maxW - kw - 8).slice(0, 2);
      for (const ln of lines) {
        page.drawText(ln, { x: M + kw + 8, y, size: 10, font: fontReg, color: INK });
        y -= 14; need(16);
      }
    }
    y -= 4;
    const stats: [string, string][] = [
      [String(completed), "Topshirish"],
      [String(passed), "O'tilgan"],
      [String(totalCorrect), "Jami to'g'ri"],
      [String(totalWrong), "Jami xato"],
    ];
    const boxW = maxW / 4;
    stats.forEach((s, i) => {
      const bx = M + i * boxW;
      page.drawRectangle({ x: bx + 2, y: y - 34, width: boxW - 4, height: 36, borderColor: LINE, borderWidth: 1, color: rgb(0.97, 0.98, 0.99) });
      page.drawText(s[0], { x: bx + 2 + (boxW - 4) / 2 - fontBold.widthOfTextAtSize(s[0], 13) / 2, y: y - 18, size: 13, font: fontBold, color: i === 2 ? GREEN : i === 3 ? RED : INK });
      page.drawText(s[1], { x: bx + 2 + (boxW - 4) / 2 - fontReg.widthOfTextAtSize(s[1], 8) / 2, y: y - 30, size: 8, font: fontReg, color: MUT });
    });
    y -= 48;
    const cols = [
      { t: "Test nomi", w: maxW * 0.38 },
      { t: "Ball", w: maxW * 0.1 },
      { t: "To'g'ri", w: maxW * 0.11 },
      { t: "Xato", w: maxW * 0.09 },
      { t: "Holat", w: maxW * 0.13 },
      { t: "Sana", w: maxW * 0.19 },
    ];
    need(22);
    let cx = M;
    page.drawRectangle({ x: M, y: y - 6, width: maxW, height: 20, color: rgb(0.1, 0.32, 0.3) });
    for (const c of cols) {
      page.drawText(c.t, { x: cx + 5, y, size: 9, font: fontBold, color: rgb(1, 1, 1) });
      cx += c.w;
    }
    y -= 20;
    if (!rows.length) {
      need(20);
      page.drawText("Xodim hali test topshirmagan.", { x: M, y, size: 10, font: fontReg, color: MUT });
      y -= 18;
    }
    rows.forEach((r, idx) => {
      const titleLines = wrap(r.title, fontReg, 9, cols[0].w - 10).slice(0, 3);
      const rh = Math.max(22, titleLines.length * 12 + 8);
      need(rh);
      if (idx % 2 === 1) {
        page.drawRectangle({ x: M, y: y - rh + 6, width: maxW, height: rh, color: rgb(0.96, 0.98, 0.98) });
      }
      let xx = M;
      titleLines.forEach((ln, li) => {
        page.drawText(ln, { x: xx + 5, y: y - 4 - li * 12, size: 9, font: fontReg, color: INK });
      });
      xx += cols[0].w;
      const cell = (txt: string, w: number, font: any, color: any = INK, size = 9) => {
        page.drawText(txt, { x: xx + 5, y: y - 4, size, font, color });
        xx += w;
      };
      cell(r.score != null ? r.score + "%" : "—", cols[1].w, fontBold);
      cell(r.correct + "/" + r.total, cols[2].w, fontBold, GREEN);
      cell(String(r.wrong), cols[3].w, fontBold, r.wrong > 0 ? RED : MUT);
      cell(r.passed ? "O'tdi" : "Yiqildi", cols[4].w, fontReg, r.passed ? GREEN : RED);
      cell(r.date, cols[5].w, fontReg, MUT, 8);
      y -= rh;
      page.drawLine({ start: { x: M, y: y + 6 }, end: { x: A4W - M, y: y + 6 }, thickness: 0.5, color: LINE });
    });
    y -= 22;
    need(60);
    page.drawText("Bo'lim rahbari imzosi: ___________________", { x: M, y, size: 10, font: fontReg, color: INK });
    y -= 18;
    page.drawText("HR / Malaka bo'limi imzosi: ___________________", { x: M, y, size: 10, font: fontReg, color: INK });
    y -= 18;
    page.drawText("AKELA GROUP | Malaka tekshirish tizimi", { x: M, y, size: 8, font: fontReg, color: MUT });
    const pages = doc.getPages();
    pages.forEach((p, i) => {
      const t = (i + 1) + " / " + pages.length;
      p.drawText(t, { x: A4W - M - fontReg.widthOfTextAtSize(t, 8), y: 24, size: 8, font: fontReg, color: MUT });
    });
    const bytes = await doc.save();
    const safe = fullName.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 60) || "hisobot";
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="AKELA-hisobot-' + safe + '.pdf"',
        "Content-Length": String(bytes.length),
      },
    });
  } catch (e: any) {
    console.error("[user-report]", e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
