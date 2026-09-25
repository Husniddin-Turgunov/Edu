import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lmsStorage } from "@/lib/lms-storage";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const lesson = await lmsStorage.getLesson(id);
    if (!lesson) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, lesson });
  } catch (error) {
    console.error("GET /api/admin/lessons-v2/[id] error:", error);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();
    const lesson = await lmsStorage.updateLesson(id, body);
    return NextResponse.json({ ok: true, lesson });
  } catch (error) {
    console.error("PATCH /api/admin/lessons-v2/[id] error:", error);
    return NextResponse.json({ ok: false, error: "Failed to update lesson" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    await lmsStorage.deleteLesson(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/lessons-v2/[id] error:", error);
    return NextResponse.json({ ok: false, error: "Failed to delete lesson" }, { status: 500 });
  }
}
