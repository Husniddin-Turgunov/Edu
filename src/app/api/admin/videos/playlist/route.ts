import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { fetchPlaylist } from "@/lib/youtube-playlist";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

// Bir xil videoni ikki marta qo'shmaslik uchun YouTube ID ajratamiz
function ytId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

/**
 * POST /api/admin/videos/playlist
 *  { action: "preview", url }                     -> playlist ro'yxati (DB'ga yozmaydi)
 *  { action: "import", url, category?, videoIds?,  -> tanlangan videolarni qo'shadi
 *    showInLessons?, showOnCourses?, description? }
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }
    const body = (await req.json()) as {
      action?: "preview" | "import";
      url?: string;
      category?: string;
      videoIds?: string[];
      showInLessons?: boolean;
      showOnCourses?: boolean;
      description?: string;
    };
    if (!body.url) return NextResponse.json({ error: "Playlist havolasini kiriting" }, { status: 400 });

    const pl = await fetchPlaylist(body.url);

    // Allaqachon qo'shilganlarni belgilaymiz
    const existing = await prisma.video.findMany({
      where: { url: { contains: "youtu" } },
      select: { url: true },
    });
    const have = new Set(existing.map((e) => ytId(e.url)).filter(Boolean) as string[]);

    if (body.action !== "import") {
      return NextResponse.json({
        ok: true,
        playlist: {
          id: pl.playlistId,
          title: pl.title,
          channel: pl.channel,
          items: pl.items.map((it) => ({ ...it, exists: have.has(it.videoId) })),
        },
      });
    }

    const pick = body.videoIds?.length ? new Set(body.videoIds) : null;
    const chosen = pl.items.filter((it) => (!pick || pick.has(it.videoId)) && !have.has(it.videoId));
    if (chosen.length === 0) {
      return NextResponse.json({ ok: true, created: 0, skipped: pl.items.length, category: body.category || pl.title });
    }

    const category = String(body.category || pl.title).trim().slice(0, 120) || "YouTube";
    // Ro'yxat createdAt DESC bo'yicha — 1-dars eng yuqorida chiqishi uchun vaqtni kamaytirib boramiz
    const base = Date.now();
    const lessonsBase =
      (await prisma.video.aggregate({ _max: { lessonsOrder: true }, where: { showInLessons: true } }))._max
        .lessonsOrder ?? -1;
    const coursesBase =
      (await prisma.video.aggregate({ _max: { coursesOrder: true }, where: { showOnCourses: true } }))._max
        .coursesOrder ?? -1;

    await prisma.video.createMany({
      data: chosen.map((it, i) => ({
        title: it.title.slice(0, 500),
        description: String(body.description || "").slice(0, 2000),
        category,
        duration: it.duration,
        size: "",
        url: it.url,
        poster: it.thumb,
        order: i,
        isActive: true,
        showInLessons: !!body.showInLessons,
        lessonsOrder: lessonsBase + 1 + i,
        showOnCourses: !!body.showOnCourses,
        coursesOrder: coursesBase + 1 + i,
        createdAt: new Date(base - i * 1000),
      })),
    });

    return NextResponse.json({
      ok: true,
      created: chosen.length,
      skipped: pl.items.length - chosen.length,
      category,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server xatosi" }, { status: 500 });
  }
}
