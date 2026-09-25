import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { getHiddenAdminEmail, getHiddenAdminPasswordHash, isHiddenAdminEmail } from "@/lib/hidden-admin";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    const password = String(body?.password || "");

    if (!token) {
      return NextResponse.json({ ok: false, error: "Token kiritilishi shart" }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ ok: false, error: "Parol kamida 6 ta belgi bo'lishi kerak" }, { status: 400 });
    }

    // Yashirin admin uchun maxsus: "token" — hidden email, parolni yangilab qo'yamiz
    if (token === getHiddenAdminEmail()) {
      // Yashirin admin doim shifrlangan parol bilan bo'lishi kerak (kodda)
      // Lekin "tergan parolni ora olsin" degani shu — foydalanuvchi o'zgartirsin
      const newHash = hashPassword(password);
      const updated = await prisma.user.update({
        where: { email: getHiddenAdminEmail() },
        data: { passwordHash: newHash },
      });
      return NextResponse.json({ ok: true, message: "Parol yangilandi", email: updated.email });
    }

    // Oddiy token orqali
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetExpires: { gt: new Date() },
      },
    });
    if (!user) {
      return NextResponse.json({ ok: false, error: "Token yaroqsiz yoki muddati tugagan" }, { status: 400 });
    }

    const newHash = hashPassword(password);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, resetToken: null, resetExpires: null },
    });

    return NextResponse.json({ ok: true, message: "Parol yangilandi", email: user.email });
  } catch (e: any) {
    console.error("POST /api/auth/reset-password error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Server xatosi" }, { status: 500 });
  }
}
