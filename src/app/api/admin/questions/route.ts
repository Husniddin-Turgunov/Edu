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
    const { testId, text, type, points, explanation, choices, correctAnswer } = body;

    if (!testId || !text) {
      return NextResponse.json({ ok: false, error: "testId and text are required" }, { status: 400 });
    }

    const questionType = type || "single";

    if (questionType === "written") {
      // Yozma javobli savol — correctAnswer talab qilinadi
      if (!correctAnswer || !correctAnswer.trim()) {
        return NextResponse.json({ ok: false, error: "To'g'ri javob matnini kiriting" }, { status: 400 });
      }
      const question = await lmsStorage.createQuestion({
        testId, text, type: "written", points, explanation,
        correctAnswer: correctAnswer.trim(),
        choices: [], // yozma javobda variantlar yo'q
      });
      return NextResponse.json({ ok: true, question });
    }

    // Variantli savol (single/multiple)
    if (!choices || !Array.isArray(choices) || choices.length < 2) {
      return NextResponse.json({ ok: false, error: "At least 2 choices required" }, { status: 400 });
    }
    if (!choices.some((c: any) => c.isCorrect)) {
      return NextResponse.json({ ok: false, error: "At least one correct answer required" }, { status: 400 });
    }
    const question = await lmsStorage.createQuestion({ testId, text, type: questionType, points, explanation, choices });
    return NextResponse.json({ ok: true, question });
  } catch (error) {
    console.error("POST /api/admin/questions error:", error);
    return NextResponse.json({ ok: false, error: "Failed to create question" }, { status: 500 });
  }
}
