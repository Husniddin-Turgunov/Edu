import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { onboardingStorage } from "@/lib/onboarding-storage";
import { apiCacheClear, CACHE_KEYS } from "@/lib/api-cache";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();
    const mod = await onboardingStorage.updateModule(id, {
      title: body.title,
      description: body.description,
    });
    return NextResponse.json({ ok: true, module: mod });
    apiCacheClear(CACHE_KEYS.adminOnboarding);
    apiCacheClear(CACHE_KEYS.adminTests);
  } catch (e) {
    console.error("PATCH /api/admin/onboarding/modules/[id] error:", e);
    return NextResponse.json({ ok: false, error: "Failed to update module" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    await onboardingStorage.deleteModule(id);
    return NextResponse.json({ ok: true });
    apiCacheClear(CACHE_KEYS.adminOnboarding);
    apiCacheClear(CACHE_KEYS.adminTests);
  } catch (e) {
    console.error("DELETE /api/admin/onboarding/modules/[id] error:", e);
    return NextResponse.json({ ok: false, error: "Failed to delete module" }, { status: 500 });
  }
}
