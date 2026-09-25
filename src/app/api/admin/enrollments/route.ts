import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { onboardingStorage } from "@/lib/onboarding-storage";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

// GET /api/admin/enrollments?userId=... — foydalanuvchining barcha biriktirishlari
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId kiritilishi shart" }, { status: 400 });
    }

    const [courseEnr, jobEnr] = await Promise.all([
      prisma.enrollment.findMany({
        where: { userId: String(userId) },
        include: { course: { select: { id: true, title: true } } },
      }),
      prisma.jobEnrollment.findMany({
        where: { userId: String(userId) },
        include: { job: { select: { id: true, title: true, slug: true } } },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      courses: courseEnr.map((e) => ({ id: e.course.id, title: e.course.title, enrolledAt: e.enrolledAt })),
      jobs: jobEnr.map((e) => ({ id: e.job.id, title: e.job.title, slug: e.job.slug, enrolledAt: e.enrolledAt })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}

// POST /api/admin/enrollments — dars biriktirish
// body: { userId, type: "onboarding" | "course" | "job", courseId?, jobId? }
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }
    const body = await req.json();
    const { userId, type, courseId, jobId } = body as {
      userId?: string;
      type?: string;
      courseId?: string;
      jobId?: string;
    };
    if (!userId || !type) {
      return NextResponse.json({ error: "userId va type kiritilishi shart" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: String(userId) }, select: { id: true } });
    if (!target) {
      return NextResponse.json({ error: "Foydalanuvchi topilmadi" }, { status: 404 });
    }

    if (type === "onboarding" || type === "course") {
      // courseId berilmasa — faol onboarding kurs topiladi
      let cid = courseId ? String(courseId) : null;
      if (!cid) {
        const course = await onboardingStorage.getCourse();
        if (!course) {
          return NextResponse.json({ error: "Onboarding kursi topilmadi" }, { status: 404 });
        }
        cid = String((course as any).id);
      }
      await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: String(userId), courseId: cid } },
        update: {},
        create: { userId: String(userId), courseId: cid },
      });
      return NextResponse.json({ ok: true, message: "Kurs biriktirildi" });
    }

    if (type === "job") {
      if (!jobId) {
        return NextResponse.json({ error: "jobId kiritilishi shart" }, { status: 400 });
      }
      const job = await prisma.jobCourse.findUnique({ where: { id: String(jobId) }, select: { id: true } });
      if (!job) {
        return NextResponse.json({ error: "Kasbiy kurs topilmadi" }, { status: 404 });
      }
      await prisma.jobEnrollment.upsert({
        where: { userId_jobId: { userId: String(userId), jobId: job.id } },
        update: {},
        create: { userId: String(userId), jobId: job.id },
      });
      return NextResponse.json({ ok: true, message: "Kasbiy kurs biriktirildi" });
    }

    return NextResponse.json({ error: "Noto'g'ri type" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}

// DELETE /api/admin/enrollments — biriktirishni olib tashlash
// body: { userId, type: "onboarding" | "course" | "job", courseId?, jobId? }
export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }
    const body = await req.json();
    const { userId, type, courseId, jobId } = body as {
      userId?: string;
      type?: string;
      courseId?: string;
      jobId?: string;
    };
    if (!userId || !type) {
      return NextResponse.json({ error: "userId va type kiritilishi shart" }, { status: 400 });
    }

    if (type === "onboarding" || type === "course") {
      let cid = courseId ? String(courseId) : null;
      if (!cid) {
        const course = await onboardingStorage.getCourse();
        if (course) cid = String((course as any).id);
      }
      if (cid) {
        await prisma.enrollment.deleteMany({ where: { userId: String(userId), courseId: cid } });
      }
      return NextResponse.json({ ok: true, message: "Kurs biriktiruvi olib tashlandi" });
    }

    if (type === "job") {
      if (!jobId) {
        return NextResponse.json({ error: "jobId kiritilishi shart" }, { status: 400 });
      }
      await prisma.jobEnrollment.deleteMany({ where: { userId: String(userId), jobId: String(jobId) } });
      return NextResponse.json({ ok: true, message: "Kasbiy kurs biriktiruvi olib tashlandi" });
    }

    return NextResponse.json({ error: "Noto'g'ri type" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}
