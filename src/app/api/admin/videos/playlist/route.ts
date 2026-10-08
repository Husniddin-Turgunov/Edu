import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

/**
 * Playlist — bu videolarning `category` maydoni (alohida jadval yo'q).
 * Shu sababli playlistni tahrirlash = o'sha kategoriyadagi BARCHA
 * videolarni yangilash.
 *
 * PATCH /api/admin/videos/playlist
 *   { "from": "Word darslari", "to": "Microsoft Word", "orderIds": ["id1","id2"] }
 *   -> `orderIds` berilsa, playlist ichidagi tartam video id'si bo'yicha
 *      `coursesOrder` maydoni orqali saqlanadi (1,2,3...).
 */
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