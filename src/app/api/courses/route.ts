import { NextResponse } from "next/server";
import supportSales from "@/data/courses/support-sales.json";

export const dynamic = "force-dynamic";

const COURSES: Record<string, unknown> = {
  "support-sales": supportSales,
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const day = url.searchParams.get("day");

  if (!slug || !COURSES[slug]) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const course = COURSES[slug] as {
    modules: Array<{ lessons: Array<{ id: number }> }>;
    [key: string]: unknown;
  };

  if (day) {
    const lesson = course.modules
      .flatMap((m) => m.lessons)
      .find((l) => l.id === Number(day));
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }
    return NextResponse.json({ course: COURSES[slug], lesson });
  }

  return NextResponse.json({ course: COURSES[slug] });
}
