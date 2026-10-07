import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lmsStorage } from "@/lib/lms-storage";
import { apiCacheClear, CACHE_KEYS } from "@/lib/api-cache";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const test = await lmsStorage.getTest(id);
    if (!test) {
      return NextResponse.json({ ok: false, error: "Test not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, test });
  } catch (error) {
    console.error("GET /api/admin/tests/[id] error:", error);
    return NextResponse.json({ ok: false, error: "Failed to fetch test" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();
    try {
      const test = await lmsStorage.updateTest(id, body);
      return NextResponse.json({ ok: true, test });
    apiCacheClear(CACHE_KEYS.adminOnboarding);
    apiCacheClear(CACHE_KEYS.adminTests);
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("Can't reach database") || msg.includes("P1001") || msg.includes("connect")) {
        console.warn("[admin/tests PATCH] DB unreachable");
        return NextResponse.json({ ok: false, error: "DB ulanmadi — qayta urinib koring" }, { status: 503 });
      }
      throw e;
    }
  } catch (error) {
    console.error("PATCH /api/admin/tests/[id] error:", error);
    return NextResponse.json({ ok: false, error: "Failed to update test" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    await lmsStorage.deleteTest(id);
    return NextResponse.json({ ok: true });
    apiCacheClear(CACHE_KEYS.adminOnboarding);
    apiCacheClear(CACHE_KEYS.adminTests);
  } catch (error) {
    console.error("DELETE /api/admin/tests/[id] error:", error);
    return NextResponse.json({ ok: false, error: "Failed to delete test" }, { status: 500 });
  }
}
