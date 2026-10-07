import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

/**
 * Joriy foydalanuvchining bo'limi/lavozimi bo'yicha normativ fayllar.
 * Bosh sahifadagi "Normativ" tugmasi shu ma'lumotga tayanadi —
 * fayl yo'q bo'lsa tugma umuman ko'rinmaydi.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { department: true, position: true },
    });

    const department = user?.department || null;
    const position = user?.position || null;

    if (!department && !position) {
      return NextResponse.json({ ok: true, items: [], department: null, position: null });
    }

    // Lavozim bo'yicha aniq fayllar; bo'lmasa — bo'limdagi barcha fayllar
    let items: any[] = [];
    if (position) {
      const positions = await prisma.position.findMany({
        where: { name: position },
        select: {
          id: true,
          name: true,
          department: { select: { name: true } },
          normatives: { orderBy: { createdAt: "desc" } },
        },
      });
      items = positions.flatMap((p) =>
        p.normatives.map((n) => ({
          id: n.id,
          name: n.name,
          url: n.url,
          size: n.size,
          note: n.note,
          createdAt: n.createdAt,
          positionName: p.name,
          departmentName: p.department?.name ?? null,
        })),
      );
    }

    if (items.length === 0 && department) {
      const positions = await prisma.position.findMany({
        where: { department: { name: department } },
        select: {
          id: true,
          name: true,
          normatives: { orderBy: { createdAt: "desc" } },
        },
      });
      items = positions.flatMap((p) =>
        p.normatives.map((n) => ({
          id: n.id,
          name: n.name,
          url: n.url,
          size: n.size,
          note: n.note,
          createdAt: n.createdAt,
          positionName: p.name,
          departmentName: department,
        })),
      );
    }

    return NextResponse.json({ ok: true, items, department, position });
  } catch (e: any) {
    console.error("GET /api/user/position-normatives error:", e?.message || e);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}
