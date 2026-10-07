import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { onboardingStorage } from "@/lib/onboarding-storage";
import { db as prisma } from "@/lib/db";
import { apiCacheClear, apiCacheGet, apiCacheSet, CACHE_KEYS } from "@/lib/api-cache";

export const dynamic = "force-dynamic";

// Uzoq MySQL (VPS) bo'ylab har bir so'rov ~0.3-3 s. Kurs + moduli + darslar
// (LongText content) yuklanadigan GET ko'p round-trip qilardi va "Tanishtiruv"
// bo'limi sekin ochilardi. Qisqa server keshi takror ochilishni tezlashtiradi.
// Kesh registry umumiy modulda — mutation qilgan boshqa route'lar ham tozalaydi.
export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const cached = apiCacheGet<unknown>(CACHE_KEYS.adminOnboarding);
    if (cached !== undefined) {
      return NextResponse.json({ ok: true, course: cached });
    }
    const course = await onboardingStorage.getCourse();
    apiCacheSet(CACHE_KEYS.adminOnboarding, course);
    return NextResponse.json({ ok: true, course });
  } catch (e) {
    console.error("GET /api/admin/onboarding error:", e);
    return NextResponse.json({ ok: false, error: "Failed to load" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { title } = await req.json();
    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ ok: false, error: "Module title is required" }, { status: 400 });
    }
    const authorId =
      (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ??
      (await prisma.user.findFirst())?.id;
    if (!authorId) {
      return NextResponse.json({ ok: false, error: "No user to attribute course to" }, { status: 500 });
    }
    const course = await onboardingStorage.ensureCourse(authorId);
    const mod = await onboardingStorage.createModule(course.id, title.trim());
    apiCacheClear(CACHE_KEYS.adminOnboarding);
    return NextResponse.json({ ok: true, module: mod });
  } catch (e) {
    console.error("POST /api/admin/onboarding error:", e);
    return NextResponse.json({ ok: false, error: "Failed to create module" }, { status: 500 });
  }
}
