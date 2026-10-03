import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAccessStatus, requestAccess } from "@/lib/test-access";
import { PrismaClient } from "@prisma/client";
import { TEST_ACCESS_BOT_SECRET } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const prisma = new PrismaClient();

/**
 * GET  — joriy foydalanuvchining shu testga kirish so'rovi holati.
 * POST — yangi so'rov yaratadi + Telegram botga xabar yuboradi.
 * PATCH — bot yoki admin javob beradi (ruxsat / rad).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { id: testId } = await params;
    const test = await prisma.test.findUnique({ where: { id: testId }, select: { title: true } });
    if (!test) return NextResponse.json({ ok: false, error: "Test topilmadi" }, { status: 404 });

    const { status, request } = await getAccessStatus({
      userId: session.userId,
      targetType: "test",
      testId,
      targetLabel: test.title,
      origin: new URL(req.url).origin,
    });
    return NextResponse.json({ ok: true, status, requestId: request?.id });
  } catch (e: any) {
    console.error("GET /api/tests/access error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    // Admin o'zi testni bevosita boshlaydi — ruxsat kerak emas
    if (session.isAdmin) return NextResponse.json({ ok: true, status: "approved", bypassed: true });

    const { id: testId } = await params;
    const test = await prisma.test.findUnique({ where: { id: testId }, select: { id: true, title: true } });
    if (!test) return NextResponse.json({ ok: false, error: "Test topilmadi" }, { status: 404 });

    const result = await requestAccess({
      userId: session.userId,
      targetType: "test",
      testId,
      targetLabel: test.title,
      origin: new URL(req.url).origin,
    });

    return NextResponse.json({
      ok: true,
      status: result.status,
      requestId: result.request?.id,
      requestedAt: result.request?.requestedAt,
      telegram: result.telegram,
    });
  } catch (e: any) {
    console.error("POST /api/tests/access error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}

/** Bot yoki admin javobi: approved | rejected */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const requestId = String(body?.requestId || "");
    const decision = body?.decision === "approved" ? "approved" : body?.decision === "rejected" ? "rejected" : "";
    const secret = String(body?.secret || "");

    let authorized = secret !== "" && secret === TEST_ACCESS_BOT_SECRET;
    if (!authorized) {
      const session = await getSession();
      authorized = !!session?.isAdmin;
    }
    if (!authorized) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    if (!requestId || !decision) return NextResponse.json({ ok: false, error: "requestId va decision kerak" }, { status: 400 });

    const current = await prisma.testAccessRequest.findUnique({ where: { id: requestId } });
    if (!current) return NextResponse.json({ ok: false, error: "So'rov topilmadi" }, { status: 404 });

    const updated = await prisma.testAccessRequest.update({
      where: { id: requestId },
      data: { status: decision, decidedAt: new Date(), decidedBy: secret ? "telegram-bot" : "admin" },
      include: {
        user: { select: { name: true, surname: true, email: true } },
        test: { select: { title: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      status: updated.status,
      fullName: [updated.user.surname, updated.user.name].filter(Boolean).join(" ") || updated.user.email,
      testTitle: updated.test?.title || updated.targetLabel,
    });
  } catch (e: any) {
    console.error("PATCH /api/tests/access error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}
