import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lmsStorage } from "@/lib/lms-storage";

export const dynamic = "force-dynamic";

// GET /api/tests — joriy foydalanuvchiga ko'rinadigan faol testlar ro'yxati.
// Atestatsiya testlari bo'limi shu yerdan ma'lumot oladi.
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: "Avtorizatsiya kerak" }, { status: 401 });
    }

    let tests: any[] = [];
    try {
      tests = await lmsStorage.getTestsForUser(String(session.userId));
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("Can't reach database") || msg.includes("P1001") || msg.includes("connect")) {
        console.warn("[/api/tests] DB unreachable — empty");
        return NextResponse.json({ ok: true, tests: [], warning: "DB ulanmadi" });
      }
      throw e;
    }
    const safe = tests.map((t: any) => {
      const totalQuestions = t._count?.questions ?? 0;
      const limit = Number(t.questionCount) || 0;
      // Cheklov (questionCount) berilgan bo'lsa — talabaga haqiqatda beriladigan
      // savollar soni ko'rsatiladi (masalan bazada 58 ta bo'lsa-da, 30 tasi).
      const effective = limit > 0 && totalQuestions > 0 ? Math.min(limit, totalQuestions) : totalQuestions;
      return {
        id: String(t.id),
        title: t.title,
        description: t.description,
        language: t.language,
        timeLimit: t.timeLimit,
        passScore: t.passScore,
        status: t.status,
        maxAttempts: t.maxAttempts,
        visibility: t.visibility,
        // Talabaga ko'rsatiladigan (beriladigan) savollar soni
        questionCount: effective,
        // Bazadagi jami savollar soni
        totalQuestions,
        // Cheklov faolmi (jami savoldan kamroq beriladi)
        limited: limit > 0 && limit < totalQuestions,
        moduleTitle: t.module?.title ?? null,
        createdAt: t.createdAt,
      };
    });

    return NextResponse.json({ ok: true, tests: safe });
  } catch (e: any) {
    console.error("GET /api/tests error:", e);
    const msg = e?.message || "";
    if (msg.includes("Can't reach database") || msg.includes("P1001")) {
      return NextResponse.json({ ok: true, tests: [], warning: "DB ulanmadi" });
    }
    return NextResponse.json({ ok: false, error: "Server xatosi" }, { status: 500 });
  }
}
