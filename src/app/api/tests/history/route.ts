import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lmsStorage } from "@/lib/lms-storage";

export const dynamic = "force-dynamic";

// DELETE — tanlangan natijalarni o'chirish (faqat admin)
// body: { ids: string[] }
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String) : [];
    if (!ids.length) return NextResponse.json({ ok: false, error: "ids required" }, { status: 400 });
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const deleted = await prisma.testResult.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
    return NextResponse.json({ ok: true, deleted: deleted.count });
  } catch (e) {
    console.error("DELETE /api/tests/history error:", e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const testId = searchParams.get("testId") || undefined;
    // if admin and ?all=1 returns all users history for admin view
    const all = searchParams.get("all");
    if (all === "1" && session.isAdmin) {
      const results = await lmsStorage.getAllTestResultsForAdmin(testId);
      return NextResponse.json({ ok: true, results });
    }
    const results = await lmsStorage.getTestHistory(session.userId, testId);
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.error("GET /api/tests/history error:", e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}
