import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { computeResultStats } from "@/lib/result-stats";
import { buildUserReportPdf, userReportFileName } from "@/lib/pdf-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const prisma = new PrismaClient();

/**
 * GET ?userId=xxx — bitta hodimning BARCHA test natijalari bo'lgan A4 PDF.
 *
 * Faqat admin yuklab oladi. (Telegram boti bu URLni ishlatmaydi — u PDF'ni
 * webhook ichida xotirada yig'ib, multipart orqali yuboradi. Sababi: Telegram
 * havolani cookiesiz yuklab oladi, admin sessiyasi esa ishlamaydi.)
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = new URL(req.url).searchParams.get("userId") || "";
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, surname: true, email: true, department: true, position: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const results = await prisma.testResult.findMany({
      where: { userId, completedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      take: 200,
      select: {
        score: true,
        passed: true,
        answers: true,
        completedAt: true,
        test: { select: { title: true, questions: { include: { choices: true } } } },
      },
    });

    const attempts = results.map((r: any) => {
      const stats = computeResultStats(r.test?.questions || [], r.answers);
      return {
        title: r.test?.title || "Test",
        score: typeof r.score === "number" ? r.score : null,
        passed: !!r.passed,
        completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null,
        correct: stats.correct,
        wrong: stats.wrong,
        total: stats.total,
      };
    });

    const bytes = await buildUserReportPdf({ user, attempts }, new URL(req.url).origin);

    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${userReportFileName(user)}"`,
        "Content-Length": String(bytes.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("[user-report]", e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
