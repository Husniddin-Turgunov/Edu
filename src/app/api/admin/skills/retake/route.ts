import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

// POST /api/admin/skills/retake — talabaga QAYTA TOPSHIRISH imkoniyatini berish.
//
// Dizayn:
//   * Eski natijalar (tarix) SAQLANADI — o'chirilmaydi.
//   * Yangi imkoniyat = "retake placeholder" (TestResult qator):
//       gradingStatus = "retake", completedAt = null, score = 0.
//   * Bu placeholder bazada aniq "qayta topshirildi" debesa qoldiradi
//     (foydalanuvchi ro'yxatida "Qayta topshirish berilgan" ko'rinadi).
//   * Talaba testni topshirganda placeholder YUTILADI (yangi natijaga
//     aylantiriladi) va unga `__retake: true` belgisi yoziladi — shunda
//     admin "qayta topshirishdan keyingi natija" deb ko'rsatadi.
//   * Idempotent: takror bosilsa ikkinchi placeholder yaratilmaydi.
//
// Muhim: getTestForTaking / submitTestResult faqat TUGALLANGAN
// (completedAt != null) natijalarni hisoblaydi, shuning uchun placeholder
// urinishlar sonini oshirmaydi va testni qayta ochishga xalaqit qilmaydi.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const userId = body.userId as string;
    const testId = body.testId as string;
    if (!userId || !testId) {
      return NextResponse.json({ error: "userId and testId required" }, { status: 400 });
    }

    // Avvaldan kutilayotgan retake bor bo'lsa — takror yaratmaymiz (idempotent)
    const existing = await prisma.testResult.findFirst({
      where: { userId, testId, gradingStatus: "retake", completedAt: null },
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        alreadyGranted: true,
        placeholder: existing,
        message: "Qayta topshirish allaqachon berilgan",
      });
    }

    // Yangi imkoniyat = retake placeholder (tarix saqlanadi, faqat qo'shiladi)
    const placeholder = await prisma.testResult.create({
      data: {
        userId,
        testId,
        score: 0,
        passed: false,
        answers: "{}",
        gradingStatus: "retake",
        completedAt: null,
      },
    });

    return NextResponse.json({
      ok: true,
      placeholder,
      message: "Qayta topshirish berildi",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
