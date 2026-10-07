import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { jobStorage } from "@/lib/job-storage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const jobSlug = searchParams.get("jobSlug") || undefined;
    const partIdx = searchParams.get("partIdx");
    const dayIdx = searchParams.get("dayIdx");
    const all = searchParams.get("all");

    if (all === "1" && session.isAdmin) {
      // admin sees all users history for a job (optional)
      const results = await jobStorage.getUserJobHistory(session.userId); // for now just user history; extend if needed
      return NextResponse.json({ ok: true, results });
    }

    if (jobSlug) {
      const results = await jobStorage.getJobTestHistory(
        session.userId,
        jobSlug,
        partIdx !== null ? Number(partIdx) : undefined,
        dayIdx !== null ? Number(dayIdx) : undefined
      );
      return NextResponse.json({ ok: true, results });
    }

    const results = await jobStorage.getUserJobHistory(session.userId);
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.error("GET /api/job-tests/history error:", e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}
