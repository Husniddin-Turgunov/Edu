import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { jobStorage } from "@/lib/job-storage";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { slug } = await context.params;
    const job = await jobStorage.getJobBySlug(slug);
    if (!job) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, job });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { slug } = await context.params;
    const body = await req.json();
    try {
      const job = await jobStorage.updateJob(slug, body);
      return NextResponse.json({ ok: true, job });
    } catch (err: any) {
      if (String(err.message).includes("Slug")) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 409 });
      }
      if (String(err.message).includes("Not found")) {
        return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
      }
      throw err;
    }
  } catch (e) {
    console.error("PATCH /api/admin/jobs/[slug] error:", e);
    return NextResponse.json({ ok: false, error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { slug } = await context.params;
    try {
      const removed = await jobStorage.deleteJob(slug);
      return NextResponse.json({ ok: true, removed });
    } catch (err: any) {
      if (String(err.message).includes("Not found")) {
        return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
      }
      throw err;
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Failed to delete" }, { status: 500 });
  }
}
