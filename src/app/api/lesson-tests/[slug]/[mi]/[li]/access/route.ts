import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAccessStatus, requestAccess } from "@/lib/test-access";
import { lmsStorage } from "@/lib/lms-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Dars (kurs/bo'lim) testiga kirish ruxsati.
 * Manzil: /api/lesson-tests/[slug]/[mi]/[li]/access
 * GET  — joriy holat (talaba har 2 soniyada so'raydi)
 * POST — so'rov yaratadi + Telegram botga xabar
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string; mi: string; li: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (session.isAdmin) return NextResponse.json({ ok: true, status: "approved", bypassed: true });

    const { slug, mi, li } = await params;
    const { status } = await getAccessStatus({
      userId: session.userId,
      targetType: "lesson",
      targetLabel: `Dars testi — ${slug} / ${mi} / ${li}`,
      targetMeta: { slug, mi, li },
      origin: new URL(_req.url).origin,
    });
    return NextResponse.json({ ok: true, status });
  } catch (e: any) {
    console.error("GET lesson access error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; mi: string; li: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (session.isAdmin) return NextResponse.json({ ok: true, status: "approved", bypassed: true });

    const { slug, mi, li } = await params;
    const result = await requestAccess({
      userId: session.userId,
      targetType: "lesson",
      targetLabel: `Dars testi — ${slug} / ${mi} / ${li}`,
      targetMeta: { slug, mi, li },
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
    console.error("POST lesson access error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}
