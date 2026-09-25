import { NextResponse } from "next/server";
import { onboardingStorage } from "@/lib/onboarding-storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const course = await onboardingStorage.getCourse();
    if (!course) {
      return NextResponse.json({ ok: false, error: "Onboarding course not seeded yet" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, course });
  } catch (e) {
    console.error("GET /api/onboarding error:", e);
    return NextResponse.json({ ok: false, error: "Failed to load onboarding" }, { status: 500 });
  }
}
