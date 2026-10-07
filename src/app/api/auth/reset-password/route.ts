import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { hashPassword, passwordProblems } from "@/lib/security/password";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

/**
 * "Parolni tiklash" — ikkinchi qadam: token bilan yangi parol o'rnatish.
 *
 * XAVFSIZLIK (oldingi versiyada buzilgan edi):
 *  - YASHIRIN ADMIN BYPASS OLIB TASHLANDI: oldin `token === email` bo'lsa
 *    parol o'rnatilardi — ya'ni faqat email manzilini bilgan odam istalgan
 *    parol qo'yardi (autentifikatsiyasiz akkaunt egallash).
 *  - Endi FAQAT DB'da `resetToken + resetExpires` bo'lgan token qabul
 *    qilinadi; token bir martalik (muvaffaqiyatdan keyin null qilinadi).
 *  - Parol talablari barcha yo'l uchun bir xil (passwordProblems).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    const password = String(body?.password || "");

    if (!token || token.length < 16) {
      return NextResponse.json({ ok: false, error: "Token noto'g'ri" }, { status: 400 });
    }

    const problems = passwordProblems(password);
    if (problems.length) {
      return NextResponse.json({ ok: false, error: problems.join(" ") }, { status: 400 });
    }

    // Faqat yaroqli, muddati tugamagan token
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetExpires: { gt: new Date() },
      },
    });
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Token yaroqsiz yoki muddati tugagan. Yangi havola so'rang." },
        { status: 400 },
      );
    }

    const newHash = hashPassword(password);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, resetToken: null, resetExpires: null },
    });

    // Muvaffaqiyatli tiklash haqida hisob egasining Telegram'iga xabar
    try {
      const { sendMessage } = await import("@/lib/telegram-bot");
      if (user.telegramId && /^-?\d+$/.test(String(user.telegramId))) {
        await sendMessage(
          Number(user.telegramId),
          "AKELA: parolingiz yangilandi. Agar bu siz emas bo'lsangiz, darhol admin bilan bog'laning.",
        );
      }
    } catch {
      /* xabar yuborilmadi — parol allaqachon yangilandi */
    }

    return NextResponse.json({ ok: true, message: "Parol yangilandi. Endi yangi parol bilan kiring." });
  } catch (e: any) {
    console.error("POST /api/auth/reset-password error:", e);
    return NextResponse.json({ ok: false, error: "Server xatosi" }, { status: 500 });
  }
}
