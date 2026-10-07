import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { VIDEO_LESSONS } from "@/data/akela-videos";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

// DB bo'sh bo'lsa statik ro'yxatdan bir marta seed qiladi
async function ensureSeed() {
  const count = await prisma.video.count();
  if (count > 0) return;
  if (VIDEO_LESSONS.length === 0) return;
  await prisma.video.createMany({
    data: VIDEO_LESSONS.map((v: any, i: number) => ({
      title: v.title,
      description: v.description || "",
      category: v.category || "Tizim",
      duration: v.duration || "",
      size: v.size || "",
      url: v.url,
      poster: v.poster || null,
      order: i,
    })),
  });
}

// GET /api/videos — eng yangi birinchi (createdAt DESC)
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Avtorizatsiya kerak" }, { status: 401 });
    }
    await ensureSeed().catch(() => {});
    const videos = await prisma.video.findMany({
      where: { isActive: true },
      orderBy: [{ createdAt: "desc" }, { order: "asc" }],
    });
    // Bosh sahifa uchun: showOnHome videolar homeOrder bo'yicha (0 = featured).
    // Hech biri belgilanmagan bo'lsa — eng yangi 4 tasi (orqaga moslik).
    const homeMarked = videos.filter((v) => v.showOnHome).sort((a, b) => a.homeOrder - b.homeOrder || +new Date(b.createdAt) - +new Date(a.createdAt));
    const home = homeMarked.length > 0 ? homeMarked : videos.slice(0, 4);
    return NextResponse.json({ ok: true, videos, home });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}
