import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { getSettings } from "@/lib/settings-storage";
import { isHiddenAdminEmail } from "@/lib/hidden-admin";
import { notifyNewUser } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function POST(req: Request) {
  try {
    if (!getSettings().registrationOpen) {
      return NextResponse.json({ error: "Ro'yxatdan o'tish vaqtincha yopilgan. Admin bilan bog'laning." }, { status: 403 });
    }
    const { email, password, name, surname, phone, department, position } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Email, parol va ism kiritilishi shart" }, { status: 400 });
    }

    if (isHiddenAdminEmail(email)) {
      return NextResponse.json({ error: "Bu email himoyalangan" }, { status: 403 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Parol kamida 6 ta belgi bo'lishi kerak" }, { status: 400 });
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
        role: "user",
        status: "pending",
      },
    });

    // Telegram bot: botga ulangan BARCHA foydalanuvchilarga xabar (ruxsat/rad
    // etish tugmalari bilan). Xatoni e'tiborsiz qoldiramiz.
    notifyNewUser({
      id: user.id,
      name,
      surname,
      email,
      department,
      position,
    }).catch((err) => {
      console.error("❌ Telegram xabar yuborilmadi:", err?.message || err);
    });

    return NextResponse.json({
      ok: true,
      message: "Ro'yxatdan o'tish muvaffaqiyatli! Admin tasdiqlashini kuting.",
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}
