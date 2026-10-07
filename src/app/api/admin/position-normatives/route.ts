import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

/**
 * Lavozimga biriktirilgan normativ fayllar.
 * GET    ?positionId=...  — ro'yxat
 * POST   { positionId, name, url, size, note } — yangi fayl qo'shish
 * DELETE { id } — faylni ro'yxatdan o'chirish
 */
export async function GET(req: NextRequest) {
  try {
    const positionId = new URL(req.url).searchParams.get("positionId");
    if (!positionId) return NextResponse.json({ error: "positionId kerak" }, { status: 400 });
    const items = await prisma.positionNormative.findMany({
      where: { positionId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const positionId = String(body?.positionId || "");
    const name = String(body?.name || "Normativ hujjat");
    const url = String(body?.url || "");
    if (!positionId || !url) return NextResponse.json({ error: "positionId va url kerak" }, { status: 400 });

    const item = await prisma.positionNormative.create({
      data: { positionId, name, url, size: Number(body?.size) || 0, note: body?.note ? String(body.note) : null },
    });
    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || "");
    if (!id) return NextResponse.json({ error: "id kerak" }, { status: 400 });
    await prisma.positionNormative.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}
