import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lmsStorage } from "@/lib/lms-storage";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { moduleId, orderedIds } = body;
    if (!moduleId || !Array.isArray(orderedIds)) {
      return NextResponse.json({ ok: false, error: "moduleId and orderedIds[] required" }, { status: 400 });
    }
    await lmsStorage.reorderLessons(moduleId, orderedIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/admin/lessons/reorder error:", error);
    return NextResponse.json({ ok: false, error: "Failed to reorder lessons" }, { status: 500 });
  }
}
