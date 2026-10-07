import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { notifyNewUser } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

// GET: Bot uchun API (foydalanuvchilar, testlar, statistika)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const secret = searchParams.get("secret");

  // Oddiy himoya — sir kalit .env'dan o'qiladi
  const expectedSecret = process.env.TELEGRAM_BOT_API_SECRET || "";
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Statistika
    if (action === "stats") {
      const [totalUsers, activeUsers, pendingUsers, rejectedUsers, totalTests, totalResults] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { status: "approved" } }),
        prisma.user.count({ where: { status: "pending" } }),
        prisma.user.count({ where: { status: "rejected" } }),
        prisma.test.count(),
        prisma.testResult.count(),
      ]);
      return NextResponse.json({ ok: true, stats: { totalUsers, activeUsers, pendingUsers, rejectedUsers, totalTests, totalResults } });
    }

    // Foydalanuvchilar
    if (action === "users") {
      const users = await prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, surname: true, email: true, status: true, department: true, createdAt: true },
      });
      return NextResponse.json({ ok: true, users });
    }

    // Kutilayotganlar
    if (action === "pending") {
      const pending = await prisma.user.findMany({
        where: { status: "pending" },
        take: 10,
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, surname: true, email: true, department: true, createdAt: true },
      });
      return NextResponse.json({ ok: true, pending });
    }

    // Testlar
    if (action === "tests") {
      const tests = await prisma.test.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, status: true, _count: { select: { questions: true, results: true } } },
      });
      return NextResponse.json({ ok: true, tests });
    }

    // Tasdiqlash
    if (action === "approve") {
      const email = searchParams.get("email");
      if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });
      await prisma.user.update({
        where: { email },
        data: { status: "approved", approvedAt: user.approvedAt || new Date() },
      });
      return NextResponse.json({ ok: true, message: `${email} tasdiqlandi` });
    }

    // Rad etish
    if (action === "reject") {
      const email = searchParams.get("email");
      if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });
      await prisma.user.update({ where: { email }, data: { status: "rejected" } });
      return NextResponse.json({ ok: true, message: `${email} rad etildi` });
    }

    // Blokla
    if (action === "block") {
      const email = searchParams.get("email");
      if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });
      // Adminlar bloklanmaydi — hech qanday yo'l orqali (avtomatik ham, qo'lda ham).
      if (user.role === "admin") {
        return NextResponse.json(
          { ok: false, error: "admin bloklanmaydi", message: `${email} — admin, bloklanmadi` },
          { status: 409 },
        );
      }
      // Bloklash emas — FAQAT OGOHLANTIRISH. Sabab: bloklangan odam saytdan
      // chiqib qoladi va ishlashda davom eta olmaydi. Endi faqat ogohlantirish.
      await prisma.user.update({
        where: { email },
        data: { blockedAt: new Date(), blockedReason: "OGOHLANTIRISH: qo'lda (Telegram)" },
      });
      return NextResponse.json({ ok: true, message: `${email} — ogohlantirildi (bloklanmadi)` });
    }

    // Blokdan chiqarish
    if (action === "unblock") {
      const email = searchParams.get("email");
      if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });
      await prisma.user.update({
        where: { email },
        data: { status: "approved", approvedAt: user.approvedAt || new Date() },
      });
      return NextResponse.json({ ok: true, message: `${email} blokdan chiqarildi` });
    }

    // Test: xabar yuborish (barcha obunachilarga)
    if (action === "test-notify") {
      try {
        const pending = await prisma.user.findFirst({
          where: { status: "pending" },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, surname: true, email: true, department: true, position: true },
        });
        const res = await notifyNewUser(
          pending
            ? {
                id: pending.id,
                name: pending.name,
                surname: pending.surname,
                email: pending.email,
                department: pending.department,
                position: pending.position,
              }
            : {
                id: "test-id",
                name: "Test",
                surname: "Foydalanuvchi",
                email: "test@example.com",
                department: "IT",
              },
        );
        return NextResponse.json({ ok: true, message: "Xabar yuborildi!", res });
      } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
      }
    }

    // Obunachilar ro'yxati
    if (action === "subscribers") {
      const subscribers = await prisma.botSubscriber.findMany({
        orderBy: { createdAt: "desc" },
        select: { chatId: true, name: true, username: true, isActive: true, createdAt: true },
      });
      return NextResponse.json({ ok: true, count: subscribers.length, subscribers });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
