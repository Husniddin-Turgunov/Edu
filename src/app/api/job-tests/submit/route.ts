import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { jobStorage } from "@/lib/job-storage";
import { hasApprovedAccess } from "@/lib/test-access";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const { jobSlug, partIdx, dayIdx, jobDayId, score, passed, answers } = body;
    if (!jobSlug || partIdx === undefined || dayIdx === undefined) {
      return NextResponse.json({ ok: false, error: "jobSlug, partIdx, dayIdx required" }, { status: 400 });
    }
    // Server tomonda ruxsat: kasb testi ham admin tasdig'idan o'tkaziladi.
    if (!session.isAdmin) {
      const allowed = await hasApprovedAccess({
        userId: session.userId,
        targetType: "lesson",
        targetLabel: `Kasb testi — ${jobSlug}`,
        targetMeta: { kind: "job", a: jobSlug, b: partIdx, c: dayIdx },
        origin: new URL(req.url).origin,
      });
      if (!allowed) {
        return NextResponse.json(
          { ok: false, error: "Testga topshirish uchun admin tasdig'i kerak", accessDenied: true },
          { status: 403 },
        );
      }
    }
    const result = await jobStorage.submitJobTestResult({
      userId: session.userId,
      jobSlug,
      partIdx: Number(partIdx),
      dayIdx: Number(dayIdx),
      jobDayId,
      score: Number(score) || 0,
      passed: Boolean(passed),
      answers: answers || {},
    });
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    console.error("POST /api/job-tests/submit error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed" }, { status: 500 });
  }
}
