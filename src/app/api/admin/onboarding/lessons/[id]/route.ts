import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { onboardingStorage } from "@/lib/onboarding-storage";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();
    const lesson = await onboardingStorage.updateLesson(id, {
      title: body.title,
      content: body.content,
      videoUrl: body.videoUrl,
      order: body.order,
      status: body.status,
    });
    return NextResponse.json({ ok: true, lesson });
  } catch (e) {
    console.error("PATCH /api/admin/onboarding/lessons/[id] error:", e);
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
    await onboardingStorage.deleteLesson(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/admin/onboarding/lessons/[id] error:", e);
    return NextResponse.json({ ok: false, error: "Failed to delete lesson" }, { status: 500 });
  }
}
