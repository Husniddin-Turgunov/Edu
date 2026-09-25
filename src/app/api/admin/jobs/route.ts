import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { jobStorage } from "@/lib/job-storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    await jobStorage.ensureSeedFromJson();
    const jobs = await jobStorage.getAllJobs();
    return NextResponse.json({ ok: true, jobs });
  } catch (e) {
    console.error("GET /api/admin/jobs error:", e);
    return NextResponse.json({ ok: false, error: "Failed to load jobs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { title, slug, folder, hasNormative } = body;
    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
    }
    try {
      const job = await jobStorage.createJob({ title, slug, folder, hasNormative });
      return NextResponse.json({ ok: true, job });
    } catch (err: any) {
      if (String(err.message).includes("Slug")) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 409 });
      }
      throw err;
    }
  } catch (e) {
    console.error("POST /api/admin/jobs error:", e);
    return NextResponse.json({ ok: false, error: "Failed to create job" }, { status: 500 });
  }
}
