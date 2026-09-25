import { NextResponse } from "next/server";
import { onboardingStorage } from "@/lib/onboarding-storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mi = parseInt(searchParams.get("mi") || "0");
    const li = parseInt(searchParams.get("li") || "0");

    const course = await onboardingStorage.getCourse();
    if (!course) return NextResponse.json({ error: "Onboarding course not seeded" }, { status: 404 });

    const moduleItem = course.modules?.[mi];
    if (!moduleItem) return NextResponse.json({ error: "Module not found" }, { status: 404 });

    const lesson = moduleItem.lessons?.[li];
    if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

    const allLessons = (course.modules ?? []).flatMap((m: any, mIdx: number) =>
      (m.lessons ?? []).map((l: any, lIdx: number) => ({
        id: l.id,
        title: l.title,
        mIdx,
        lIdx,
        moduleTitle: m.title,
      }))
    );

    const flatIdx = allLessons.findIndex((l) => l.mIdx === mi && l.lIdx === li);
    const prev = flatIdx > 0 ? allLessons[flatIdx - 1] : null;
    const next = flatIdx < allLessons.length - 1 ? allLessons[flatIdx + 1] : null;

    return NextResponse.json({
      course: {
        id: course.id,
        slug: "akela-onboarding",
        title: "AKELA GROUP MACHINERY",
        moduleCount: course.modules?.length ?? 0,
      },
      module: {
        id: moduleItem.id,
        title: moduleItem.title,
        idx: mi,
      },
      lesson: {
        id: lesson.id,
        title: lesson.title,
        content: lesson.content,
        types: lesson.title?.toLowerCase().includes("test") ? ["test"] : [],
        videoUrl: lesson.videoUrl || null,
      },
      navigation: {
        prev,
        next,
        current: flatIdx + 1,
        total: allLessons.length,
      },
    });
  } catch (e) {
    console.error("GET /api/course/lesson error:", e);
    return NextResponse.json({ error: "Failed to load lesson" }, { status: 500 });
  }
}
