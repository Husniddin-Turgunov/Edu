import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lmsStorage } from "@/lib/lms-storage";
import { apiCacheClear, CACHE_KEYS } from "@/lib/api-cache";

export const dynamic = "force-dynamic";

// DELETE — tanlangan savollarni bir vaqtda o'chirish (faqat admin)
// body: { ids: string[] }
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String).filter(Boolean) : [];
    if (!ids.length) return NextResponse.json({ ok: false, error: "ids required" }, { status: 400 });

    // Bitta DB so'rovi — 59 ta savol ham millisekundlarda o'chadi
    const result = await lmsStorage.deleteQuestions(ids);
    return NextResponse.json({ ok: true, deleted: result.count });
    apiCacheClear(CACHE_KEYS.adminOnboarding);
    apiCacheClear(CACHE_KEYS.adminTests);
  } catch (error) {
    console.error("DELETE /api/admin/questions error:", error);
    return NextResponse.json({ ok: false, error: "Failed to delete questions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { testId, text, type, points, explanation, choices, correctAnswer, isMandatory } = body;

    if (!testId || !text) {
      return NextResponse.json({ ok: false, error: "testId and text are required" }, { status: 400 });
    }

    const questionType = type || "single";
    // Majburiy bayrog'i FAQAT jadval (Excel) savollarida. Boshqa turlarda
    // maydon yuborilmagan bo'lsa — DB defaulti (`true`) saqlanadi va eski
    // testlarning tartibi buzilmaydi.
    const mandatory = questionType === "excel" ? isMandatory !== false : true;

    // YOZMA va JADVAL (Excel) savollari — variantlar talab qilinmaydi.
    // "excel" uchun to'g'ri javob kataklari TestSpreadsheet da saqlanadi,
    // shuning uchun bu yerda faqat savol matni kiritiladi.
    if (questionType === "written" || questionType === "excel") {
      if (questionType === "written" && (!correctAnswer || !correctAnswer.trim())) {
        return NextResponse.json({ ok: false, error: "To'g'ri javob matnini kiriting" }, { status: 400 });
      }
      const question = await lmsStorage.createQuestion({
        testId, text, type: questionType, points, explanation,
        correctAnswer: questionType === "written" ? correctAnswer.trim() : "",
        isMandatory: mandatory,
        choices: [], // bu turlarda variantlar yo'q
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
    const question = await lmsStorage.createQuestion({
      testId, text, type: questionType, points, explanation, choices, isMandatory: mandatory,
    });
    return NextResponse.json({ ok: true, question });
  } catch (error) {
    console.error("POST /api/admin/questions error:", error);
    return NextResponse.json({ ok: false, error: "Failed to create question" }, { status: 500 });
  }
}
