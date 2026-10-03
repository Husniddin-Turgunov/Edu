import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lmsStorage } from "@/lib/lms-storage";
import { notifyTestResult } from "@/lib/telegram-bot";
import { levelForScore } from "@/lib/result-card";
import { hasApprovedAccess } from "@/lib/test-access";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const prisma = new PrismaClient();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    // Server tomonda asosiy himoya: tasdiqlangan ruxsatisiz topshirish qabul
    // qilinmaydi — client gate qanday ishlashidan qat'i nazar.
    if (!session.isAdmin) {
      const allowed = await hasApprovedAccess({
        userId: session.userId,
        targetType: "test",
        testId: id,
        targetLabel: "",
        origin: new URL(req.url).origin,
      });
      if (!allowed) {
        return NextResponse.json(
          { ok: false, error: "Testga topshirish uchun admin tasdig'i kerak", accessDenied: true },
          { status: 403 },
        );
      }
    }
    const body = await req.json();
    const { answers, questionIds } = body; // answers: { [questionId]: choiceId | choiceId[] }, questionIds: ko'rsatilgan savollar
    if (!answers) return NextResponse.json({ ok: false, error: "answers required" }, { status: 400 });
    try {
      const result = await lmsStorage.submitTestResult({ userId: session.userId, testId: id, answers, questionIds });

      // Telegram: botga ulangan BARCHA obunachilarga natija (rasm + yozma matn)
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { name: true, surname: true, department: true, position: true },
      });
      const test = await prisma.test.findUnique({
        where: { id },
        select: { title: true, passScore: true },
      });
      const fullName = [user?.surname, user?.name].filter(Boolean).join(" ") || "Noma'lum";

      if (result.score !== null) {
        // DIQQAT: `await` majburiy. Serverless'da "otib yuborib qo'yish"
        // (`.catch()` siz await qilmasdan) — response qaytarilgach funksiya
        // muzlatiladi va Telegram so'rovi tugamaydi, ya'ni natija hech qachon
        // yetib borMAYdi.
        try {
          await notifyTestResult({
            fullName,
            testTitle: test?.title || "Noma'lum test",
            score: result.score,
            passed: !!result.passed,
            passScore: test?.passScore ?? null,
            department: user?.department ?? null,
            position: user?.position ?? null,
            completedAt: result.completedAt ?? new Date(),
            level: levelForScore(result.score),
            origin: new URL(req.url).origin,
          });
        } catch (err: any) {
          console.error("❌ Telegram natija xabari yuborilmadi:", err?.message || err);
        }
      } else {
        // Yozma savolli test — avtomatik ball yo'q, grader baholashini kutadi
        try {
          await notifyTestResult({
            fullName,
            testTitle: test?.title || "Noma'lum test",
            score: null,
            passed: false,
            passScore: test?.passScore ?? null,
            department: user?.department ?? null,
            position: user?.position ?? null,
            completedAt: new Date(),
            level: "Baholanmagan",
            origin: new URL(req.url).origin,
          });
        } catch (err: any) {
          console.error("❌ Telegram natija xabari yuborilmadi:", err?.message || err);
        }
      }

      return NextResponse.json({ ok: true, result });
    } catch (err: any) {
      const msg = err.message || "Failed";
      const status = msg.includes("biriktirilmagan") || msg.includes("tugadi") ? 403 : 400;
      return NextResponse.json({ ok: false, error: msg }, { status });
    }
  } catch (e) {
    console.error("POST /api/tests/[id]/submit error:", e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}
