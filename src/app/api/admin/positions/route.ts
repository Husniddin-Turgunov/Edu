import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

// POST — yangi lavozim yaratish
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }

    const { departmentId, name, description, normativeUrl, normativeDesc, order } = await req.json();

    if (!departmentId || !name || !name.trim()) {
      return NextResponse.json({ error: "Bo'lim ID va lavozim nomi shart" }, { status: 400 });
    }

    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) {
      return NextResponse.json({ error: "Bo'lim topilmadi" }, { status: 404 });
    }

    const position = await prisma.position.create({
      data: {
        departmentId,
        name: name.trim(),
        description: description || "",
        normativeUrl: normativeUrl || null,
        normativeDesc: normativeDesc || null,
        order: order ?? 0,
      },
    });

    return NextResponse.json({ ok: true, position });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}

// PATCH — lavozimni tahrirlash
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }

    const { id, name, description, normativeUrl, normativeDesc, order } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "id kiritilishi shart" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description;
    if (normativeUrl !== undefined) data.normativeUrl = normativeUrl;
    if (normativeDesc !== undefined) data.normativeDesc = normativeDesc;
    if (order !== undefined) data.order = order;

    // Agar nom o'zgarsa — foydalanuvchilardagi position nomini ham yangilash
    if (name) {
      const old = await prisma.position.findUnique({ where: { id } });
      if (old && old.name !== name.trim()) {
        await prisma.user.updateMany({
          where: { position: old.name },
          data: { position: name.trim() },
        });
      }
    }

    const position = await prisma.position.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ok: true, position });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}

// DELETE — lavozimni o'chirish
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

    const pos = await prisma.position.findUnique({ where: { id } });
    if (pos) {
      // Lavozimdagi foydalanuvchilardan position ni tozalash
      await prisma.user.updateMany({
        where: { position: pos.name },
        data: { position: "" },
      });
    }

    await prisma.position.delete({ where: { id } });

    return NextResponse.json({ ok: true, message: "Lavozim o'chirildi" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}
