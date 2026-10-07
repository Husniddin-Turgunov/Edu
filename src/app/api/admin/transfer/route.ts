import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

// POST — foydalanuvchini boshqa bo'lim/lavozimka ko'chirish
// Bir vaqtda faqat bitta bo'limda bo'lishi ta'minlanadi
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }

    const { userIds, department, position } = await req.json() as {
      userIds?: string[];
      department?: string;
      position?: string;
    };

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: "Kamida bitta foydalanuvchi tanlang" }, { status: 400 });
    }

    if (!department) {
      return NextResponse.json({ error: "Bo'lim tanlash shart" }, { status: 400 });
    }

    // Bo'lim mavjudligini tekshirish
    const dept = await prisma.department.findFirst({ where: { name: department } });
    if (!dept) {
      return NextResponse.json({ error: "Bo'lim topilmadi" }, { status: 404 });
    }

    // Lavozim mavjudligini tekshirish (agar berilgan bo'lsa)
    if (position) {
      const pos = await prisma.position.findFirst({
        where: { name: position, departmentId: dept.id },
      });
      if (!pos) {
        return NextResponse.json({ error: "Lavozim ushbu bo'limda topilmadi" }, { status: 404 });
      }
    }

    // Har bir foydalanuvchini ko'chirish (bir vaqtda faqat bitta bo'limda)
    const results = await Promise.all(
      userIds.map(async (uid) => {
        // Eski bo'limdan chiqarish — avval mavjud bo'limdagi boshqa foydalanuvchilarni tekshirish
        const user = await prisma.user.findUnique({ where: { id: uid } });
        if (!user) return { id: uid, error: "Foydalanuvchi topilmadi" };

        // Yangi bo'lim/lavozimni yangilash
        await prisma.user.update({
          where: { id: uid },
          data: {
            department: department,
            position: position || "",
          },
        });

        return { id: uid, ok: true, department, position };
      })
    );

    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}
