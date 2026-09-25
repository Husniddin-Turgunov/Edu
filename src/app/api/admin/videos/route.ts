import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

// GET /api/admin/videos — admin ro'yxat (eng yangi birinchi)
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }
    const videos = await prisma.video.findMany({
      orderBy: [{ createdAt: "desc" }, { order: "asc" }],
    });
    return NextResponse.json({ ok: true, videos });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}

// POST /api/admin/videos — yangi video qo'shish (ro'yxat boshiga chiqadi)
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }
    const body = await req.json();
    const { title, description, category, duration, size, url, poster, showOnHome, homeOrder, isActive,
      showOnCourses, coursesOrder, showOnDashboard, dashboardOrder, showInLessons, lessonsOrder } = body as {
      title?: string;
      description?: string;
      category?: string;
      duration?: string;
      size?: string;
      url?: string;
      poster?: string;
      showOnHome?: boolean;
      homeOrder?: number;
      isActive?: boolean;
      showOnCourses?: boolean;
      coursesOrder?: number;
      showOnDashboard?: boolean;
      dashboardOrder?: number;
      showInLessons?: boolean;
      lessonsOrder?: number;
    };
    if (!title || !url) {
      return NextResponse.json({ error: "Sarlavha va video URL kiritilishi shart" }, { status: 400 });
    }
    const video = await prisma.video.create({
      data: {
        title: String(title),
        description: String(description || ""),
        category: String(category || "Tizim"),
        duration: String(duration || ""),
        size: String(size || ""),
        url: String(url),
        poster: poster ? String(poster) : null,
        showOnHome: !!showOnHome,
        homeOrder: Number(homeOrder) || 0,
        isActive: isActive !== false,
        showOnCourses: !!showOnCourses,
        coursesOrder: Number(coursesOrder) || 0,
        showOnDashboard: !!showOnDashboard,
        dashboardOrder: Number(dashboardOrder) || 0,
        showInLessons: !!showInLessons,
        lessonsOrder: Number(lessonsOrder) || 0,
      },
    });
    return NextResponse.json({ ok: true, video });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}

// PATCH /api/admin/videos — tahrirlash. body: { id, ...fields }
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }
    const body = await req.json();
    const { id, title, description, category, duration, size, url, poster, showOnHome, homeOrder, isActive,
      showOnCourses, coursesOrder, showOnDashboard, dashboardOrder, showInLessons, lessonsOrder } = body as any;
    if (!id) {
      return NextResponse.json({ error: "id kiritilishi shart" }, { status: 400 });
    }
    const data: any = {};
    if (title !== undefined) data.title = String(title);
    if (description !== undefined) data.description = String(description);
    if (category !== undefined) data.category = String(category);
    if (duration !== undefined) data.duration = String(duration);
    if (size !== undefined) data.size = String(size);
    if (url !== undefined) data.url = String(url);
    if (poster !== undefined) data.poster = poster ? String(poster) : null;
    if (showOnHome !== undefined) data.showOnHome = !!showOnHome;
    if (homeOrder !== undefined) data.homeOrder = Number(homeOrder) || 0;
    if (isActive !== undefined) data.isActive = !!isActive;
    if (showOnCourses !== undefined) data.showOnCourses = !!showOnCourses;
    if (coursesOrder !== undefined) data.coursesOrder = Number(coursesOrder) || 0;
    if (showOnDashboard !== undefined) data.showOnDashboard = !!showOnDashboard;
    if (dashboardOrder !== undefined) data.dashboardOrder = Number(dashboardOrder) || 0;
    if (showInLessons !== undefined) data.showInLessons = !!showInLessons;
    if (lessonsOrder !== undefined) data.lessonsOrder = Number(lessonsOrder) || 0;
    const video = await prisma.video.update({ where: { id: String(id) }, data });
    return NextResponse.json({ ok: true, video });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}

// DELETE /api/admin/videos?id=... — o'chirish
export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id kiritilishi shart" }, { status: 400 });
    }
    await prisma.video.delete({ where: { id: String(id) } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}
