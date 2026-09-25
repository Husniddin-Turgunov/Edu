import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lmsStorage } from "@/lib/lms-storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/tests/[id]/review?resultId=...
 * Foydalanuvchining o'z urinishini ko'rish (savollar + tanlangan javoblar).
 * isCorrect faqat urinishlar tugaganda ochiladi (lms-storage getAttemptReview).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const resultId = searchParams.get("resultId") || undefined;

    let data: any;
    try {
      data = await lmsStorage.getAttemptReview(id, session.userId, resultId);
    } catch (e: any) {
      // DB ulanmadi — stack emas, yengil xato
      if (e?.code === "P1001" || String(e?.message || "").includes("Can't reach database")) {
        return NextResponse.json({ ok: false, error: "DB ulanmadi — qayta urinib koring" }, { status: 503 });
      }
      throw e;
    }

    if (!data) {
      return NextResponse.json({ ok: false, error: "Natija topilmadi" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, review: data });
  } catch (e) {
    console.error("GET /api/tests/[id]/review error:", e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}
