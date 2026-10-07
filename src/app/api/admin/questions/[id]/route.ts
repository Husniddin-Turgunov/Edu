import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lmsStorage } from "@/lib/lms-storage";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const type = body.type || "single";
    const points = Math.max(1, Number(body.points) || 1);
    const choices = body.choices;

    if (!text) {
      return NextResponse.json({ ok: false, error: "Savol matnini kiriting" }, { status: 400 });
    }
    if (type === "written" && !String(body.correctAnswer || "").trim()) {
      return NextResponse.json({ ok: false, error: "To'g'ri javob matnini kiriting" }, { status: 400 });
    }
    if (type !== "written") {
      if (!Array.isArray(choices) || choices.length < 2 || choices.some((choice: any) => !String(choice.text || "").trim())) {
        return NextResponse.json({ ok: false, error: "Kamida ikkita bo'sh bo'lmagan variant kerak" }, { status: 400 });
      }
      if (!choices.some((choice: any) => choice.isCorrect)) {
        return NextResponse.json({ ok: false, error: "Kamida bitta to'g'ri variant belgilang" }, { status: 400 });
      }
    }

    const question = await lmsStorage.updateQuestion(id, {
      text,
      type,
      points,
      explanation: body.explanation,
      correctAnswer: body.correctAnswer,
      choices: type === "written" ? undefined : choices,
    });
    return NextResponse.json({ ok: true, question });
  } catch (error) {
    console.error("PATCH /api/admin/questions/[id] error:", error);
    return NextResponse.json({ ok: false, error: "Savolni yangilab bo'lmadi" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    await lmsStorage.deleteQuestion(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/questions/[id] error:", error);
    return NextResponse.json({ ok: false, error: "Failed to delete question" }, { status: 500 });
  }
}
