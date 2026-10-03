import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { onboardingStorage } from "@/lib/onboarding-storage";
import { apiCacheClear, CACHE_KEYS } from "@/lib/api-cache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { moduleId, title, content, videoUrl, order, status } = body;
    if (!moduleId || !title) {
      return NextResponse.json({ ok: false, error: "moduleId and title are required" }, { status: 400 });
    }
    const lesson = await onboardingStorage.createLesson(moduleId, { title, content, videoUrl, order, status });
    return NextResponse.json({ ok: true, lesson });
    apiCacheClear(CACHE_KEYS.adminOnboarding);
    apiCacheClear(CACHE_KEYS.adminTests);
  } catch (e) {
    console.error("POST /api/admin/onboarding/lessons error:", e);
    return NextResponse.json({ ok: false, error: "Failed to create lesson" }, { status: 500 });
  }
}
