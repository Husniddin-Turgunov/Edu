import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lmsStorage } from "@/lib/lms-storage";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const data: any = await lmsStorage.getTestForTaking(id, session.userId);
    if (!data) return NextResponse.json({ ok: false, error: "Test topilmadi yoki sizga biriktirilmagan" }, { status: 404 });
    if (data.blocked) {
      return NextResponse.json({ ok: false, error: `Urinishlar tugadi (${data.test.maxAttempts} marta)`, blocked: true, attempts: data.attempts }, { status: 403 });
    }
    // hide isCorrect from client until submit? But for now send with flag but frontend will handle. We strip isCorrect for security but need to keep for scoring server side.
    // Send shuffled without isCorrect to prevent cheating, but we need to keep mapping.
    // For simplicity, send with isCorrect hidden, but store mapping in token? Instead, we send without isCorrect and expect client to send choice ids, server will validate.
    const sanitized = {
      ...data,
      questions: (data as any).questions.map((q: any) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        points: q.points,
        order: q.order,
        choices: q.choices.map((c: any) => ({ id: c.id, text: c.text, order: c.order })),
      })),
    };
    return NextResponse.json({ ok: true, test: sanitized });
  } catch (e) {
    console.error("GET /api/tests/[id] error:", e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}
