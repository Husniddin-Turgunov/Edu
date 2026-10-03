import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { sendPasswordResetLink } from "@/lib/telegram-bot";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * "Parolni tiklash" — birinchi qadam.
 *
 * XAVFSIZLIK (oldingi versiyada buzilgan edi):
 *  - Token ASLA javobga qaytarilmaydi (oldingi versiyada qaytardi →
 *    istalgan email bilan akkaunt egallash mumkin edi).
 *  - Token faqat foydalanuvchining O'Z Telegram chat'iga havola sifatida
 *    yuboriladi (token hech qachon boshqa odamga ko'rinmaydi).
 *  - Telegram yo'q bo'lsa ham umumiy success qaytaramiz — email mavjudligi
 *    oshkor bo'lmaydi (enumeration yo'q).
 *  - Yashirin admin uchun maxsus yo'l yo'q — u ham umumiy oqimda.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ ok: false, error: "Email kiritilishi shart" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Email formati noto'g'ri" }, { status: 400 });
    }

    // Mavjud bo'lsa — token yaratamiz va Telegram orqali YUBORAMIZ.
    // Javobda token yo'q; xato ham yo'q (email mavjudligini oshkor qilmaymiz).
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = generateToken();
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 soat
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: token, resetExpires: expires },
      });

      const origin = process.env.APP_URL || process.env.NEXTAUTH_URL || new URL(req.url).origin;
      await sendPasswordResetLink({
        fullName: [user.name, user.surname].filter(Boolean).join(" ") || user.email,
        email: user.email,
        telegramId: user.telegramId,
        resetUrl: `${origin}/reset-password?token=${token}`,
        expiresAt: expires,
      });
    }

    return NextResponse.json({
      ok: true,
      mode: "sent",
      message: "Agar email ro'yxatda bo'lsa, parol tiklash havolasi Telegram orqali yuborildi.",
    });
  } catch (e: any) {
    console.error("POST /api/auth/forgot-password error:", e);
    // Ichki xatoni ham umumiy xabar bilan yashiramiz (enumeration yo'q)
    return NextResponse.json({
      ok: true,
      mode: "sent",
      message: "Agar email ro'yxatda bo'lsa, parol tiklash havolasi yuborildi.",
    });
  }
}
