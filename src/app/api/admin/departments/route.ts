import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

// Qisqa muddatli kesh (DB Vercel'dan uzoqda — takror so'rovlarni tezlashtiradi)
const CACHE_TTL_MS = 20_000;
let _cache: { at: number; data: any } | null = null;

// GET — barcha bo'limlar (ichida lavozimlar + foydalanuvchilar soni)
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }

    if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) {
      return NextResponse.json(_cache.data);
    }

    const departments = await prisma.department.findMany({
      include: {
        positions: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { order: "asc" },
    });

    // ====== TEZKORLIK =====
    // Avval har bir lavozim uchun 2 ta alohida so'rov (count + findMany) ketma-ket
    // yuborilardi — 20+ lavozimda bu 40+ DB round-trip, ya'ni o'ntalar soniya.
    // Endi BARCHA foydalanuvchilar bitta so'rovda olib, xotirada bo'lim/lavozim
    // bo'yicha guruhlanadi (0 ta qo'shimcha so'rov).
    const allUsers = await prisma.user.findMany({
      where: { status: "approved" },
      select: { id: true, name: true, surname: true, email: true, isActive: true, department: true, position: true },
    });

    const grouped = new Map<string, typeof allUsers>();
    for (const u of allUsers) {
      if (!u.department || !u.position) continue;
      const key = `${u.department}||${u.position}`;
      const list = grouped.get(key);
      if (list) list.push(u);
      else grouped.set(key, [u]);
    }

    const result = departments.map((dept) => {
      const positionsWithCount = (dept.positions || []).map((pos) => {
        const users = grouped.get(`${dept.name}||${pos.name}`) || [];
        const { department: _d, position: _p, ...clean } = users[0] ?? ({} as any);
        void _d; void _p;
        return {
          ...pos,
          userCount: users.length,
          users: users.map((u) => ({ id: u.id, name: u.name, surname: u.surname, email: u.email, isActive: u.isActive })),
          isVacant: users.length === 0,
        };
      });
      return {
        ...dept,
        positions: positionsWithCount,
        totalUsers: positionsWithCount.reduce((sum: number, p: any) => sum + p.userCount, 0),
      };
    });

    const payload = { ok: true, departments: result };
    _cache = { at: Date.now(), data: payload };
    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}

// POST — yangi bo'lim yaratish
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }

    const { name, description, color, icon, order } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Bo'lim nomi kiritilishi shart" }, { status: 400 });
    }

    const existing = await prisma.department.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return NextResponse.json({ error: "Bu nomdagi bo'lim allaqachon mavjud" }, { status: 409 });
    }

    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        description: description || "",
        color: color || "#6366f1",
        icon: icon || null,
        order: order ?? 0,
      },
    });

    return NextResponse.json({ ok: true, department });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}

// PATCH — bo'limni tahrirlash
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }

    const { id, name, description, color, icon, order } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "id kiritilishi shart" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description;
    if (color !== undefined) data.color = color;
    if (icon !== undefined) data.icon = icon;
    if (order !== undefined) data.order = order;

    // Agar nom o'zgarsa — foydalanuvchilardagi department nomini ham yangilash
    if (name) {
      const old = await prisma.department.findUnique({ where: { id } });
      if (old && old.name !== name.trim()) {
        await prisma.user.updateMany({
          where: { department: old.name },
          data: { department: name.trim() },
        });
      }
    }

    const department = await prisma.department.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ok: true, department });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}

// DELETE — bo'limni o'chirish
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

    const dept = await prisma.department.findUnique({ where: { id } });
    if (dept) {
      // Bo'limdagi foydalanuvchilardan department ni tozalash
      await prisma.user.updateMany({
        where: { department: dept.name },
        data: { department: "", position: "" },
      });
    }

    await prisma.department.delete({ where: { id } });

    return NextResponse.json({ ok: true, message: "Bo'lim o'chirildi" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}
