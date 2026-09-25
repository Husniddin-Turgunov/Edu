import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lmsStorage } from "@/lib/lms-storage";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    try {
      const tests = await lmsStorage.getAllTests();
      return NextResponse.json({ ok: true, tests });
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("Can't reach database") || msg.includes("P1001") || msg.includes("connect")) {
        console.warn("[admin/tests] DB unreachable — empty");
        return NextResponse.json({ ok: true, tests: [] , warning: "DB ulanmadi" });
      }
      throw e;
    }
  } catch (error) {
    console.error("GET /api/admin/tests error:", error);
    return NextResponse.json({ ok: false, error: "Failed to fetch tests" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { title, description, language, timeLimit, passScore, moduleId, courseId, order, maxAttempts, questionCount, shuffleQuestions, shuffleChoices, visibility, assignedUserIds } = body;
    if (!title) {
      return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
    }
    const test = await lmsStorage.createTest({ title, description, language, timeLimit, passScore, moduleId, courseId, order, maxAttempts, questionCount, shuffleQuestions, shuffleChoices, visibility, assignedUserIds });
    return NextResponse.json({ ok: true, test });
  } catch (error) {
    console.error("POST /api/admin/tests error:", error);
    return NextResponse.json({ ok: false, error: "Failed to create test" }, { status: 500 });
  }
}
