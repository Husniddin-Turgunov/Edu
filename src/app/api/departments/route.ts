import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

/**
 * PUBLIC API — autentifikatsiya talab qilinmaydi.
 * Ro'yxatdan o'tish sahifasida bo'lim va lavozimlarni ko'rsatish uchun.
 */
export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      include: {
        positions: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            name: true,
            order: true,
          },
        },
      },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ ok: true, departments });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}
