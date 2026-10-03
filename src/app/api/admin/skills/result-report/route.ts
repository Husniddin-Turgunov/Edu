import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { buildResultReportPdf, resultReportFileName } from "@/lib/pdf-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const prisma = new PrismaClient();

/**
 * GET ?resultId=xxx — BITTA test natijasi uchun A4 PDF.
 * Ichida: xodim ma'lumotlari, ball/daraja/holat, to'g'ri/xato sonlari va
 * savollar bo'yicha tafsilot.
 *
 * Faqat admin yuklab oladi. (Telegram boti bu URLni ishlatmaydi — u PDF'ni
 * webhook ichida xotirada yig'ib, multipart orqali yuboradi.)
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

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

    const bytes = await buildResultReportPdf(
      {
        user: result.user || {},
        testTitle: result.test?.title || "Test",
        passScore: result.test?.passScore ?? null,
        score: typeof result.score === "number" ? result.score : null,
        passed: !!result.passed,
        completedAt: result.completedAt ? new Date(result.completedAt).toISOString() : null,
        questions: result.test?.questions || [],
        answersJson: result.answers,
      },
      new URL(req.url).origin,
    );

    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${resultReportFileName(result.user || {})}"`,
        "Content-Length": String(bytes.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("[result-report]", e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
