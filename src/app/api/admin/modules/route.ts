import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lmsStorage } from "@/lib/lms-storage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { courseId, title, description, viewOrder, order } = body;
    if (!courseId || !title) {
      return NextResponse.json({ ok: false, error: "courseId and title are required" }, { status: 400 });
    }
    const mod = await lmsStorage.createModule({ courseId, title, description, viewOrder, order });
    return NextResponse.json({ ok: true, module: mod });
  } catch (error) {
    console.error("POST /api/admin/modules error:", error);
    return NextResponse.json({ ok: false, error: "Failed to create module" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { courseId, orderedIds } = body;
    if (!courseId || !Array.isArray(orderedIds)) {
      return NextResponse.json({ ok: false, error: "courseId and orderedIds[] required" }, { status: 400 });
    }
    await lmsStorage.reorderModules(courseId, orderedIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/admin/modules error:", error);
    return NextResponse.json({ ok: false, error: "Failed to reorder modules" }, { status: 500 });
  }
}
