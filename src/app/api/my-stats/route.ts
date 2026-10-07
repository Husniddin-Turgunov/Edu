import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { onboardingStorage } from "@/lib/onboarding-storage";
import { jobStorage } from "@/lib/job-storage";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

function fmtTime(totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h} soat ${m} daq`;
  if (m > 0) return `${m} daq`;
  return `${totalSec} son`;
}

// GET /api/my-stats — joriy foydalanuvchining o'z dashboard statistikasi
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Avtorizatsiya kerak" }, { status: 401 });
    }
    const userId = String(session.userId);

    const [course, jobs] = await Promise.all([
      onboardingStorage.getCourseForUser(userId).catch(() => null),
      jobStorage.ensureSeedFromJson().then(() => jobStorage.getAllJobs()).catch(() => [] as any[]),
    ]);
    const lessons: any[] = ((course as any)?.modules || []).flatMap((m: any) =>
      (m.lessons || []).map((l: any) => ({ id: String(l.id), title: l.title }))
    );

    const [courseEnr, jobEnr, lp, jdp, testRes, jobTestRes] = await Promise.all([
      prisma.enrollment.findMany({
        where: { userId },
        include: { course: { select: { id: true, title: true } } },
      }),
      prisma.jobEnrollment.findMany({
        where: { userId },
        include: { job: { select: { id: true, title: true, slug: true } } },
      }),
      prisma.lessonProgress.findMany({ where: { userId } }),
      prisma.jobDayProgress.findMany({ where: { userId } }),
      prisma.testResult.findMany({ where: { userId } }),
      prisma.jobTestResult.findMany({ where: { userId } }),
    ]);

    const doneLessons = new Set(lp.filter((p) => p.completed).map((p) => String(p.lessonId)));
    const doneJobDays = new Set(jdp.filter((p) => p.completed).map((p) => String(p.jobDayId)));
    const lessonsDone = lessons.filter((l) => doneLessons.has(String(l.id))).length;

    const assignedJobs = jobEnr.map((e) => {
      const full = (jobs as any[]).find((j: any) => String(j._id || j.id) === String(e.jobId));
      const days: any[] = full ? (full.parts || []).flatMap((p: any) => p.days || []) : [];
      const done = days.filter((d: any) => doneJobDays.has(String(d.id))).length;
      return {
        id: String(e.jobId),
        title: e.job.title,
        slug: e.job.slug,
        daysTotal: days.length,
        daysDone: done,
        percent: days.length > 0 ? Math.round((done / days.length) * 100) : 0,
      };
    });

    const hasOnboarding = courseEnr.length > 0 && lessons.length > 0;
    const onboarding = hasOnboarding
      ? {
          id: String((course as any).id),
          title: (course as any).title || "Tanishtiruv kursi",
          lessonsTotal: lessons.length,
          lessonsDone,
          percent: lessons.length > 0 ? Math.round((lessonsDone / lessons.length) * 100) : 0,
        }
      : null;

    const totalUnits = (onboarding?.lessonsTotal || 0) + assignedJobs.reduce((s, j) => s + j.daysTotal, 0);
    const doneUnits = (onboarding?.lessonsDone || 0) + assignedJobs.reduce((s, j) => s + j.daysDone, 0);
    const percent = totalUnits > 0 ? Math.round((doneUnits / totalUnits) * 100) : 0;
    const timeSec = lp.reduce((s, p) => s + (p.timeSpent || 0), 0) + jdp.reduce((s, p) => s + (p.timeSpent || 0), 0);

    const allTests = [...testRes, ...jobTestRes];
    const testsTaken = allTests.length;
    const testsPassed = allTests.filter((t) => t.passed).length;
    const avgScore = testsTaken > 0 ? Math.round(allTests.reduce((s, t) => s + t.score, 0) / testsTaken) : 0;

    return NextResponse.json({
      ok: true,
      isAdmin: !!session.isAdmin,
      percent,
      lessonsDone: doneUnits,
      lessonsTotal: totalUnits,
      testsTaken,
      testsPassed,
      avgScore,
      timeLabel: fmtTime(timeSec),
      onboarding,
      jobs: assignedJobs,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}
