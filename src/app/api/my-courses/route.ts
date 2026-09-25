import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { onboardingStorage } from "@/lib/onboarding-storage";
import { jobStorage } from "@/lib/job-storage";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

// GET /api/my-courses — joriy foydalanuvchiga biriktirilgan darslar.
// Admin hamma narsani ko'radi. Biriktirilmagan user bo'sh ro'yxat oladi.
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Avtorizatsiya kerak" }, { status: 401 });
    }
    const userId = String(session.userId);

    await jobStorage.ensureSeedFromJson().catch(() => {});
    const [course, jobs] = await Promise.all([
      onboardingStorage.getCourse().catch(() => null),
      jobStorage.getAllJobs().catch(() => [] as any[]),
    ]);

    // Admin — cheklovsiz
    if (session.isAdmin) {
      return NextResponse.json({
        ok: true,
        isAdmin: true,
        onboarding: course ? { id: String((course as any).id) } : null,
        jobIds: (jobs as any[]).map((j: any) => String(j.id)),
      });
    }

    const courseId = course ? String((course as any).id) : null;
    const [courseEnr, jobEnr] = await Promise.all([
      courseId
        ? prisma.enrollment.findUnique({
            where: { userId_courseId: { userId, courseId } },
            select: { courseId: true },
          })
        : null,
      prisma.jobEnrollment.findMany({ where: { userId }, select: { jobId: true } }),
    ]);

    return NextResponse.json({
      ok: true,
      isAdmin: false,
      onboarding: courseEnr && course ? { id: String((course as any).id) } : null,
      jobIds: jobEnr.map((e) => String(e.jobId)),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}
