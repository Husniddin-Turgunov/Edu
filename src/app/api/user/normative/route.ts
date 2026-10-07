import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

// GET — foydalanuvchining lavozimi uchun normativ fayl ma'lumotini olish
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Tizimga kirish kerak" }, { status: 401 });
    }

    const url = new URL(req.url);
    const department = url.searchParams.get("department");
    const position = url.searchParams.get("position");

    if (!department || !position) {
      return NextResponse.json({ ok: true, normative: null });
    }

    // Bo'limni topish
    const dept = await prisma.department.findFirst({ where: { name: department } });
    if (!dept) {
      return NextResponse.json({ ok: true, normative: null });
    }

    // Lavozimni topish
    const pos = await prisma.position.findFirst({
      where: { name: position, departmentId: dept.id },
    });
    if (!pos || !pos.normativeUrl) {
      return NextResponse.json({ ok: true, normative: null });
    }

    return NextResponse.json({
      ok: true,
      normative: {
        positionName: pos.name,
        departmentName: dept.name,
        normativeUrl: pos.normativeUrl,
        normativeDesc: pos.normativeDesc,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}
