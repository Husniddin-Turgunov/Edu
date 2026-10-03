import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAccessStatus, requestAccess, consumeAccess } from "@/lib/test-access";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const prisma = new PrismaClient();

/**
 * Qayta topshirishga ruxsat so'rovi.
 * Urinish limiti tugagan xodim "Qayta topshirish" tugmasini bosadi →
 * Telegram botga so'rov ketadi → "Ruxsat berish" bosilganda test qayta ochiladi.
 *
 * GET  — joriy holat
 * POST — so'rov yuborish
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { id: testId } = await params;
    const test = await prisma.test.findUnique({ where: { id: testId }, select: { title: true } });
    if (!test) return NextResponse.json({ ok: false, error: "Test topilmadi" }, { status: 404 });

    const { status } = await getAccessStatus({
      userId: session.userId,
      targetType: "retake",
      testId,
      targetLabel: `Qayta topshirish — ${test.title}`,
      origin: new URL(req.url).origin,
    });
    return NextResponse.json({ ok: true, status });
  } catch (e: any) {
    console.error("GET retake error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (session.isAdmin) return NextResponse.json({ ok: true, status: "approved", bypassed: true });

    const { id: testId } = await params;
    const test = await prisma.test.findUnique({ where: { id: testId }, select: { id: true, title: true } });
    if (!test) return NextResponse.json({ ok: false, error: "Test topilmadi" }, { status: 404 });

    const result = await requestAccess({
      userId: session.userId,
      targetType: "retake",
      testId,
      targetLabel: `Qayta topshirish — ${test.title}`,
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
    console.error("POST retake error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}

/** Ruxsat berilgach so'rovni "ishlatilgan" deb belgilash (bir martalik) */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const requestId = String(body?.requestId || "");
    if (!requestId) return NextResponse.json({ ok: false, error: "requestId kerak" }, { status: 400 });
    const reqRow = await prisma.testAccessRequest.findUnique({ where: { id: requestId } });
    if (!reqRow || reqRow.userId !== session.userId) {
      return NextResponse.json({ ok: false, error: "Topilmadi" }, { status: 404 });
    }
    await consumeAccess(requestId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("PATCH retake error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}
