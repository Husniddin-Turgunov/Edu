import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { fetchPlaylist } from "@/lib/youtube-playlist";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

/**
 * Playlist — bu videolarning `category` maydoni (alohida jadval yo'q).
 * Shu sababli playlistni tahrirlash = o'sha kategoriyadagi BARCHA
 * videolarni yangilash.
 *
 * POST /api/admin/videos/playlist   — YouTube playlistdan o'qish/qo'shish
 *   { action: "preview", url }
 *     -> playlist ro'yxatini qaytaradi; har bir itemda `exists` — bu video
 *        bazada bormi (mos id bo'yicha tekshiriladi).
 *   { action: "import", url, category, videoIds[], showInLessons, showOnCourses }
 *     -> tanlangan videolarni `category` playlisti sifatida yaratadi.
 *        Allaqachon bor videolar o'tkazib yuboriladi (takrorlanmaydi).
 *
 * PATCH /api/admin/videos/playlist
 *   { "from": "Word darslari", "to": "Microsoft Word", "orderIds": ["id1","id2"] }
 *   -> `orderIds` berilsa, playlist ichidagi tartam video id'si bo'yicha
 *      `coursesOrder` maydoni orqali saqlanadi (1,2,3...).
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ ok: false, error: "Ruxsat yo'q" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: "So'rov tanasi bo'sh" }, { status: 400 });

    const url = String(body.url ?? "").trim();
    const action = body.action === "import" ? "import" : "preview";
    if (!url) return NextResponse.json({ ok: false, error: "Playlist havolasi shart" }, { status: 400 });

    // YouTube'dan o'qish — serverda, ichki xatolar ham JSON bilan qaytariladi
    let pl;
    try {
      pl = await fetchPlaylist(url);
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.message || "Playlistni o'qib bo'lmadi" }, { status: 400 });
    }

    // Bazadagi mavjud videolar (title bo'yicha ham solishtiramiz: avvalgi
    // qo'shishlarda boshqa turli id/URL bilan saqlangan bo'lishi mumkin)
    const existing = await prisma.video.findMany({
      where: { OR: [{ url: { contains: pl.playlistId } }, { category: { equals: pl.title } }] },
      select: { id: true, title: true, url: true },
    });
    const existingUrls = new Set(existing.map((v) => v.url));
    const existingTitles = new Set(existing.map((v) => v.title.trim().toLowerCase()));
    const marked = pl.items.map((it) => ({
      ...it,
      exists: existingUrls.has(it.url) || existingTitles.has(it.title.trim().toLowerCase()),
    }));

    if (action === "preview") {
      return NextResponse.json({
        ok: true,
        playlist: {
          playlistId: pl.playlistId,
          title: pl.title,
          channel: pl.channel,
          total: marked.length,
          items: marked,
        },
      });
    }

    // —— import ——
    const category = String(body.category ?? pl.title).trim().slice(0, 120) || pl.title;
    const wanted: string[] = Array.isArray(body.videoIds) ? body.videoIds.map(String) : [];
    const ids = wanted.length ? wanted : marked.filter((m) => !m.exists).map((m) => m.videoId);
    const pick = new Set(ids);
    const toCreate = marked.filter((m) => pick.has(m.videoId) && !m.exists);

    if (toCreate.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Tanlangan videolar allaqachon bazada bor", category },
        { status: 409 },
      );
    }

    // Playlist ichidagi tartam — coursesOrder (1,2,3...)
    const orderBase = await prisma.video.count({ where: { category } });

    // DIQQAT: `$transaction` FAQAT PrismaPromise massivini qabul qiladi.
    // Bu yerga `.then(...)` qo'shilsa, oddiy Promise bo'lib qoladi va
    // "All elements of the array need to be Prisma Client promises" xatosi
    // chiqadi. Shuning uchun sof PrismaPromise'lar massivi beriladi, son
    // ularni await qilishdan oldin aniqlanadi.
    const createOps = toCreate.map((m, i) =>
      prisma.video.create({
        data: {
          title: m.title.slice(0, 300),
          description: `YouTube playlist: ${pl.title}${pl.channel ? ` — ${pl.channel}` : ""}`,
          category,
          duration: m.duration || "",
          url: m.url,
          poster: m.thumb,
          isActive: true,
          showInLessons: !!body.showInLessons,
          showOnCourses: !!body.showOnCourses,
          coursesOrder: orderBase + i + 1,
        },
      }),
    );

    const results = await prisma.$transaction(createOps);
    const created = results.length;

    return NextResponse.json({ ok: true, created, skipped: marked.length - toCreate.length, category });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server xatosi" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ ok: false, error: "Ruxsat yo'q" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: "So'rov tanasi bo'sh" }, { status: 400 });

    const from = String(body.from ?? "").trim();
    const to = String(body.to ?? from).trim();
    const orderIds: string[] = Array.isArray(body.orderIds) ? body.orderIds.map(String) : [];
    // Darslar sahifasida ko'rinishni boshqarish (playlist darajasida).
    const showInLessons = body.showInLessons;

    if (!from) return NextResponse.json({ ok: false, error: "from (playlist nomi) shart" }, { status: 400 });

    // 0) Ko'rinishni o'zgartirish (nomlash emas)
    if (showInLessons !== undefined) {
      const on = !!showInLessons;
      const res = await prisma.video.updateMany({
        where: { category: from },
        data: { showInLessons: on },
      });
      return NextResponse.json({ ok: true, changed: res.count, name: from, showInLessons: on });
    }

    if (!to) return NextResponse.json({ ok: false, error: "Yangi nom bo'sh bo'lishi mumkin emas" }, { status: 400 });
    if (to.length > 120) {
      return NextResponse.json({ ok: false, error: "Nom 120 belgidan oshmasligi kerak" }, { status: 400 });
    }

    // 1) Nomlash (agar o'zgartirilayotgan bo'lsa)
    let renamed = 0;
    if (to !== from) {
      // Agar yangi nom bilan playlist allaqachon bor bo'lsa — qo'shib
      // ketmaslik uchun xabar beriladi (ma'lumot chalkashmasin).
      const clash = await prisma.video.findFirst({ where: { category: to }, select: { id: true } });
      if (clash) {
        return NextResponse.json(
          { ok: false, error: `"${to}" nomli playlist allaqachon bor. Avval uni ochib, videolarini ko'chiring.` },
          { status: 409 },
        );
      }
      const res = await prisma.video.updateMany({ where: { category: from }, data: { category: to } });
      renamed = res.count;
    }

    // 2) Tartamni saqlash (ixtiyoriy)
    let ordered = 0;
    if (orderIds.length) {
      await prisma.$transaction(
        orderIds.map((id, i) =>
          prisma.video.updateMany({ where: { id, category: to }, data: { coursesOrder: i + 1 } }),
        ),
      );
      ordered = orderIds.length;
    }

    const count = await prisma.video.count({ where: { category: to } });
    return NextResponse.json({ ok: true, renamed, ordered, count, name: to });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server xatosi" }, { status: 500 });
  }
}