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

// GET /api/admin/user-stats?userId=... — bitta foydalanuvchi dashboardi
// GET /api/admin/user-stats — barcha userlar qisqa statistikasi (ro'yxat uchun)
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");

    const [course, jobs] = await Promise.all([
      onboardingStorage.getCourse().catch(() => null),
      jobStorage.ensureSeedFromJson().then(() => jobStorage.getAllJobs()).catch(() => [] as any[]),
    ]);
    const lessons: any[] = ((course as any)?.modules || []).flatMap((m: any) =>
      (m.lessons || []).map((l: any) => ({ id: String(l.id), moduleId: String(m.id), title: l.title }))
    );
    const jobDays: any[] = (jobs as any[]).flatMap((j: any) =>
      (j.parts || []).flatMap((p: any) => (p.days || []).map((d: any) => ({ id: String(d.id), jobId: String(j._id || j.id) })))
    );

    async function statsFor(uid: string) {
      const [courseEnr, jobEnr, lp, jdp, testRes, jobTestRes] = await Promise.all([
        prisma.enrollment.findMany({ where: { userId: uid }, select: { courseId: true } }),
        prisma.jobEnrollment.findMany({ where: { userId: uid }, select: { jobId: true } }),
        prisma.lessonProgress.findMany({ where: { userId: uid } }),
        prisma.jobDayProgress.findMany({ where: { userId: uid } }),
        prisma.testResult.findMany({
          where: { userId: uid },
          orderBy: { completedAt: "desc" },
          take: 50,
        }),
        prisma.jobTestResult.findMany({
          where: { userId: uid },
          orderBy: { completedAt: "desc" },
          take: 50,
        }),
      ]);

      const hasOnboarding = courseEnr.length > 0 && lessons.length > 0;
      const assignedJobIds = new Set(jobEnr.map((e) => String(e.jobId)));
      const assignedJobDays = jobDays.filter((d) => assignedJobIds.has(String(d.jobId)));

      const doneLessons = new Set(lp.filter((p) => p.completed).map((p) => String(p.lessonId)));
      const doneJobDays = new Set(jdp.filter((p) => p.completed).map((p) => String(p.jobDayId)));
      const lessonsDone = lessons.filter((l) => doneLessons.has(String(l.id))).length;
      const jobDaysDone = assignedJobDays.filter((d) => doneJobDays.has(String(d.id))).length;

      const totalLessons = (hasOnboarding ? lessons.length : 0) + assignedJobDays.length;
      const totalDone = (hasOnboarding ? lessonsDone : 0) + jobDaysDone;
      const percent = totalLessons > 0 ? Math.round((totalDone / totalLessons) * 100) : 0;
      const timeSec =
        lp.reduce((s, p) => s + (p.timeSpent || 0), 0) + jdp.reduce((s, p) => s + (p.timeSpent || 0), 0);

      const allTests = [
        ...testRes.map((t) => ({ score: t.score, passed: t.passed, at: t.completedAt || t.startedAt })),
        ...jobTestRes.map((t) => ({ score: t.score, passed: t.passed, at: t.completedAt || t.createdAt })),
      ];
      const testsTaken = allTests.length;
      const testsPassed = allTests.filter((t) => t.passed).length;
      const avgScore = testsTaken > 0 ? Math.round(allTests.reduce((s, t) => s + t.score, 0) / testsTaken) : 0;

      return {
        coursesCount: courseEnr.length,
        jobsCount: jobEnr.length,
        lessonsTotal: totalLessons,
        lessonsDone: totalDone,
        percent,
        timeSec,
        timeLabel: fmtTime(timeSec),
        testsTaken,
        testsPassed,
        avgScore,
      };
    }

    // Bitta user — to'liq dashboard
    if (userId) {
      const u = await prisma.user.findUnique({
        where: { id: String(userId) },
        select: { id: true, email: true, name: true, surname: true, department: true, position: true, status: true, role: true, createdAt: true },
      });
      if (!u) {
        return NextResponse.json({ error: "Foydalanuvchi topilmadi" }, { status: 404 });
      }
      const [s, courseEnr, jobEnr, testRes, jobTestRes] = await Promise.all([
        statsFor(String(u.id)),
        prisma.enrollment.findMany({
          where: { userId: String(u.id) },
          include: { course: { select: { id: true, title: true } } },
        }),
        prisma.jobEnrollment.findMany({
          where: { userId: String(u.id) },
          include: { job: { select: { id: true, title: true, slug: true } } },
        }),
        prisma.testResult.findMany({
          where: { userId: String(u.id) },
          include: { test: { select: { title: true } } },
          orderBy: { completedAt: "desc" },
          take: 10,
        }),
        prisma.jobTestResult.findMany({
          where: { userId: String(u.id) },
          include: { job: { select: { title: true } } },
          orderBy: { completedAt: "desc" },
          take: 10,
        }),
      ]);
      const recentTests = [
        ...testRes.map((t) => ({ title: t.test?.title || "Test", score: t.score, passed: t.passed, at: t.completedAt || t.startedAt, kind: "onboarding" as const })),
        ...jobTestRes.map((t) => ({ title: t.job?.title || "Kasbiy test", score: t.score, passed: t.passed, at: t.completedAt || t.createdAt, kind: "job" as const })),
      ]
        .sort((a, b) => new Date(b.at as any).getTime() - new Date(a.at as any).getTime())
        .slice(0, 10);

      return NextResponse.json({
        ok: true,
        user: u,
        stats: s,
        assignedCourses: courseEnr.map((e) => ({ id: e.course.id, title: e.course.title })),
        assignedJobs: jobEnr.map((e) => ({ id: e.job.id, title: e.job.title, slug: e.job.slug })),
        recentTests,
      });
    }

    // Ro'yxat — hamma userlar qisqa statistika bilan
    const users = await prisma.user.findMany({
      where: { status: "approved" },
      select: { id: true, email: true, name: true, surname: true, department: true, position: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const rows = await Promise.all(
      users.map(async (u) => ({ user: u, stats: await statsFor(String(u.id)) }))
    );
    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}
