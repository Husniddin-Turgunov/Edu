import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

// POST /api/progress — dars o'zlashtirishni yozish
// body: { lessonId?: string, jobDayId?: string, seconds?: number, completed?: boolean }
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Avtorizatsiya kerak" }, { status: 401 });
    }
    const userId = String(session.userId);
    const body = await req.json();
    const { lessonId, jobDayId, seconds, completed } = body as {
      lessonId?: string;
      jobDayId?: string;
      seconds?: number;
      completed?: boolean;
    };
    if (!lessonId && !jobDayId) {
      return NextResponse.json({ error: "lessonId yoki jobDayId kiritilishi shart" }, { status: 400 });
    }
    const secs = Math.max(0, Math.min(3600, Math.floor(Number(seconds) || 0)));

    if (lessonId) {
      const lesson = await prisma.lesson.findUnique({
        where: { id: String(lessonId) },
        select: { id: true },
      });
      if (!lesson) {
        return NextResponse.json({ error: "Dars topilmadi" }, { status: 404 });
      }
      const prev = await prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId: lesson.id } },
      });
      const data: any = { timeSpent: (prev?.timeSpent || 0) + secs };
      if (completed) {
        data.completed = true;
        if (!prev?.completedAt) data.completedAt = new Date();
      }
      const row = prev
        ? await prisma.lessonProgress.update({ where: { id: prev.id }, data })
        : await prisma.lessonProgress.create({
            data: {
              userId,
              lessonId: lesson.id,
              timeSpent: secs,
              completed: !!completed,
              completedAt: completed ? new Date() : null,
            },
          });
      return NextResponse.json({ ok: true, progress: row });
    }

    const day = await prisma.jobDay.findUnique({
      where: { id: String(jobDayId) },
      select: { id: true },
    });
    if (!day) {
      return NextResponse.json({ error: "Kun topilmadi" }, { status: 404 });
    }
    const prev = await prisma.jobDayProgress.findUnique({
      where: { userId_jobDayId: { userId, jobDayId: day.id } },
    });
    const data: any = { timeSpent: (prev?.timeSpent || 0) + secs };
    if (completed) {
      data.completed = true;
      if (!prev?.completedAt) data.completedAt = new Date();
    }
    const row = prev
      ? await prisma.jobDayProgress.update({ where: { id: prev.id }, data })
      : await prisma.jobDayProgress.create({
          data: {
            userId,
            jobDayId: day.id,
            timeSpent: secs,
            completed: !!completed,
            completedAt: completed ? new Date() : null,
          },
        });
    return NextResponse.json({ ok: true, progress: row });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}
