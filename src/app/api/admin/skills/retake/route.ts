import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";
import {
  hasActiveRetake,
  RETAKE_ACTIVE,
  RETAKE_EXPIRED,
  RETAKE_TTL_DAYS,
  sweepExpiredRetakes,
} from "@/lib/retake";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

// POST /api/admin/skills/retake — talabaga QAYTA TOPSHIRISH imkoniyatini berish.
//
// Dizayn:
//   * Eski natijalar (tarix) SAQLANADI — o'chirilmaydi.
//   * Yangi imkoniyat = "retake placeholder" (TestResult qator):
//       gradingStatus = "retake", completedAt = null, score = 0.
//   * Ruxsat `RETAKE_TTL_DAYS` kun amal qiladi. Vaqti o'tgach placeholder
//     AVTOMATIK yopiladi (gradingStatus -> "retake_expired") va admin yangi
//     imkoniyat bera oladi — eski urinishlar ro'yxatda qoladi.
//   * Faol ruxsat bor ekan, takror bosilsa ikkinchi placeholder yaratilmaydi.
//   * `startedAt` placeholder yaratilganda to'ldiriladi — TTL undan hisoblanadi.
//
// Muhim: `completedAt` NULL qoladi, shuning uchun placeholder urinishlar
// sonini oshirmaydi va testni qayta ochishga xalaqit qilmaydi.
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

    // 1) Vaqti o'tgan ruxsatlarni avtomatik yopamiz (tarixda qoladi).
    const closed = await sweepExpiredRetakes(prisma);

    // 2) Hali faol ruxsat bormi? (sweep'dan keyin — o'tgani yopilgan)
    if (await hasActiveRetake(prisma, userId, testId)) {
      return NextResponse.json({
        ok: true,
        alreadyGranted: true,
        closedExpired: closed,
        message: "Qayta topshirish allaqachon berilgan (vaqti tugamagan)",
      });
    }

    // 3) Yangi imkoniyat = retake placeholder (tarix saqlanadi, faqat qo'shiladi)
    const placeholder = await prisma.testResult.create({
      data: {
        userId,
        testId,
        score: 0,
        passed: false,
        answers: "{}",
        gradingStatus: RETAKE_ACTIVE,
        completedAt: null,
      },
    });

    return NextResponse.json({
      ok: true,
      placeholder,
      closedExpired: closed,
      expiresInDays: RETAKE_TTL_DAYS,
      message: `Qayta topshirish berildi (${RETAKE_TTL_DAYS} kun ichida topshirish kerak)`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET — hozirgi ruxsat holati (admin panel UI uchun).
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const sp = new URL(req.url).searchParams;
    const userId = sp.get("userId") || "";
    const testId = sp.get("testId") || "";
    if (!userId || !testId) {
      return NextResponse.json({ error: "userId and testId required" }, { status: 400 });
    }
    const closed = await sweepExpiredRetakes(prisma);
    const active = await prisma.testResult.findFirst({
      where: { userId, testId, gradingStatus: RETAKE_ACTIVE, completedAt: null },
      select: { id: true, startedAt: true },
    });
    return NextResponse.json({
      ok: true,
      closedExpired: closed,
      ttlDays: RETAKE_TTL_DAYS,
      active: active ? { id: active.id, grantedAt: active.startedAt } : null,
      status: active ? "active" : RETAKE_EXPIRED,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
