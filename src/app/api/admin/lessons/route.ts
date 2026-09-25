import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lessonStorage } from "@/lib/lesson-storage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const lessons = lessonStorage.getAll();
    return NextResponse.json({ ok: true, lessons });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to fetch lessons" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, content, types, module, order } = body;

    if (!title || !content) {
      return NextResponse.json({ ok: false, error: "Title and content are required" }, { status: 400 });
    }

    const newLesson = lessonStorage.create({
      title,
      content,
      types: types || ["lesson"],
      module: module || "",
      order: order || 0,
    });

    return NextResponse.json({ ok: true, lesson: newLesson });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to create lesson" }, { status: 500 });
  }
}
