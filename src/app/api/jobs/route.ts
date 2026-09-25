import { NextResponse } from "next/server";
import { jobStorage } from "@/lib/job-storage";

export const dynamic = "force-dynamic";

// Public API — no auth, used by /courses pages
export async function GET() {
  try {
    // Ensure seeded if DB empty (fallback to JSON)
    await jobStorage.ensureSeedFromJson();
    const jobs = await jobStorage.getAllJobs();
    return NextResponse.json({ ok: true, jobs });
  } catch (e) {
    console.error("GET /api/jobs error:", e);
    return NextResponse.json({ ok: false, error: "Failed to load jobs" }, { status: 500 });
  }
}
