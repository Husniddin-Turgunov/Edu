import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { consumeAccess } from "@/lib/test-access";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

/** Test ruxsatini bir marta ishlatish (test ochilgach chaqiriladi) */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const requestId = String(body?.requestId || "");
    if (!requestId) return NextResponse.json({ ok: true, skipped: true });

    const row = await prisma.testAccessRequest.findUnique({ where: { id: requestId } });
    if (!row || row.userId !== session.userId) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

    await consumeAccess(requestId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("POST /api/tests/[id]/access/consume error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}
