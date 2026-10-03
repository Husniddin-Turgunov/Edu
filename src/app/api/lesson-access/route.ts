import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAccessStatus, requestAccess } from "@/lib/test-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Dars/kurs testlariga kirish ruxsati (umumiy).
 * GET/POST  ?kind=lesson|day|job&a=...&b=...&c=...
 *  - lesson: a=slug, b=bo'lim, c=dars   (Tanishtiruv / modul testlari)
 *  - day:    a=slug, b=day              (kunlik sahifadagi "Nazorat testi")
 *  - job:    a=slug, b=pi, c=di        (kasb testi)
 */
const KINDS: Record<string, string> = {
  lesson: "Dars testi",
  day: "Kunlik test (Nazorat testi)",
  job: "Kasb testi",
};

function readTarget(src: URLSearchParams | Record<string, any>) {
  const get = (k: string) => (src instanceof URLSearchParams ? src.get(k) : src?.[k]) ?? "";
  const kind = String(get("kind") || "lesson");
  const a = String(get("a") || "");
  const b = String(get("b") ?? "");
  const c = String(get("c") ?? "");
  const label = String(get("label") || `${KINDS[kind] || "Test"} — ${[a, b, c].filter(Boolean).join(" / ")}`);
  return { kind: KINDS[kind] ? kind : "lesson", a, b, c, label };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (session.isAdmin) return NextResponse.json({ ok: true, status: "approved", bypassed: true });

    const t = readTarget(new URL(req.url).searchParams);
    const { status, request } = await getAccessStatus({
      userId: session.userId,
      targetType: "lesson",
      targetLabel: t.label,
      targetMeta: { kind: t.kind, a: t.a, b: t.b, c: t.c },
      origin: new URL(req.url).origin,
    });
    return NextResponse.json({ ok: true, status, requestId: request?.id });
  } catch (e: any) {
    console.error("GET lesson-access error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (session.isAdmin) return NextResponse.json({ ok: true, status: "approved", bypassed: true });

    const body = await req.json().catch(() => ({}));
    const t = readTarget(body || {});
    const result = await requestAccess({
      userId: session.userId,
      targetType: "lesson",
      targetLabel: t.label,
      targetMeta: { kind: t.kind, a: t.a, b: t.b, c: t.c },
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
    console.error("POST lesson-access error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}
