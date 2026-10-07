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
    const { moduleId, title, content, videoUrl, pdfUrl, duration, order, language, isHomework } = body;
    if (!moduleId || !title) {
      return NextResponse.json({ ok: false, error: "moduleId and title are required" }, { status: 400 });
    }
    const lesson = await lmsStorage.createLesson({
      moduleId, title, content, videoUrl, pdfUrl, duration, order, language, isHomework,
    });
    return NextResponse.json({ ok: true, lesson });
  } catch (error) {
    console.error("POST /api/admin/lessons-v2 error:", error);
    return NextResponse.json({ ok: false, error: "Failed to create lesson" }, { status: 500 });
  }
}
