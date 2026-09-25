import { NextRequest, NextResponse } from "next/server";
import { jobStorage } from "@/lib/job-storage";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const job = await jobStorage.getJobBySlug(slug);
    if (!job) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, job });
  } catch (e) {
    console.error("GET /api/jobs/[slug] error:", e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}
