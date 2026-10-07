import { NextResponse } from "next/server";
import { onboardingStorage } from "@/lib/onboarding-storage";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/onboarding
 *
 * Tanishtiruv kursi. `?userId=` yoki sessiya foydalanuvchisi asosida darslar
 * filtrlanadi — "shu xodimga shu darslik ko'rinmasin" qoidasi shu yerda
 * qo'llaniladi.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    let userId = url.searchParams.get("userId");

    const session = await getSession();

    if (userId) {
      // ?userId= faqat admin uchun — sessiyasiz istalgan user kursini o'qish mumkin emas
      if (!session?.isAdmin) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
    } else {
      userId = session ? String(session.userId) : null;
    }

    const course = await onboardingStorage.getCourseForUser(userId);
    if (!course) {
      return NextResponse.json(
        { ok: false, error: "Onboarding course not seeded yet" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, course });
  } catch (e) {
    console.error("GET /api/onboarding error:", e);
    return NextResponse.json({ ok: false, error: "Failed to load onboarding" }, { status: 500 });
  }
}