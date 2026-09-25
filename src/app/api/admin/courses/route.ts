import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lmsStorage } from "@/lib/lms-storage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const courses = await lmsStorage.getAllCourses();
    return NextResponse.json({ ok: true, courses });
  } catch (error) {
    console.error("GET /api/admin/courses error:", error);
    return NextResponse.json({ ok: false, error: "Failed to fetch courses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, language, coverColor, status, isPublic, folderId } = body;

    if (!title) {
      return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
    }

    const course = await lmsStorage.createCourse({
      title,
      description,
      language,
      coverColor,
      status,
      isPublic,
      folderId,
      authorId: session.userId,
    });

    return NextResponse.json({ ok: true, course });
  } catch (error) {
    console.error("POST /api/admin/courses error:", error);
    return NextResponse.json({ ok: false, error: "Failed to create course" }, { status: 500 });
  }
}
