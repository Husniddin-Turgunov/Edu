import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lessonStorage } from "@/lib/lesson-storage";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { title, content, types, module, order } = body;

    const updatedLesson = lessonStorage.update(id, {
      title,
      content,
      types,
      module,
      order,
    });

    if (!updatedLesson) {
      return NextResponse.json({ ok: false, error: "Lesson not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, lesson: updatedLesson });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to update lesson" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const deleted = lessonStorage.delete(id);

    if (!deleted) {
      return NextResponse.json({ ok: false, error: "Lesson not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to delete lesson" }, { status: 500 });
  }
}
