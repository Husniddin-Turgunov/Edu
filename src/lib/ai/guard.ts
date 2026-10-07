/**
 * lib/ai/guard.ts
 *
 * Barcha AI yo'llari uchun umumiy kirish nazorati: kim kirishi mumkin,
 * IP olish va xatoni qaytarish shakli.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ToolActor } from "./tools";

export type GuardResult = { ok: true; actor: ToolActor } | { ok: false; response: NextResponse };

/**
 * Barcha AI yo'llari uchun umumiy kirish nazorati.
 *
 * AI BOSHQARUVCHI FAQAT ADMIN/GRADER UCHUN: oddiy foydalanuvchi (role = "user")
 * na chatga, na vositalarga, na fayl yuklashga, na analitikaga kira olmaydi.
 * `allowAll: true` bilan faqat maxsus holat uchun cheklovni bo'sh qoldiriladi.
 */
export async function requireAiActor(options: { allowAll?: boolean } = {}): Promise<GuardResult> {
  const adminOnly = options.allowAll !== true;
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Avtorizatsiya kerak" }, { status: 401 }),
    };
  }

  const userId = String(session.userId);
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      surname: true,
      role: true,
      status: true,
      isActive: true,
    },
  });

  // Sessiyasi bor, lekin bazadagi yozuv yo'q (o'chirilgan foydalanuvchi)
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Foydalanuvchi bazada topilmadi" }, { status: 401 }),
    };
  }

  // Faol va tasdiqlangan foydalanuvchigina AI'ga kira oladi
  if (user.status !== "approved" || !user.isActive) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Hisobingiz faol emas yoki tasdiqlanmagan. AI bo'limidan foydalana olmaysiz." },
        { status: 403 },
      ),
    };
  }

  const isAdmin = user.role === "admin" || session.isAdmin === true;
  const isGrader = user.role === "grader";
  const isManager = isAdmin || isGrader;

  if (adminOnly && !isManager) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "AI boshqaruvchisi faqat admin va grader uchun. Oddiy xodim uchun bu bo'lim yopiq.",
          role: user.role,
        },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    actor: {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: [user.surname, user.name].filter(Boolean).join(" ").trim() || user.email,
      isAdmin,
    },
  };
}

export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export function failResponse(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...(extra || {}) }, { status });
}

export function okResponse<T>(data: T, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: true, ...(data as Record<string, unknown>), ...(extra || {}) });
}

/**
 * Yuklama hajmini cheklaydi (server tomondagi ishonchli chegara).
 * `content-length` yoki haqiqiy uzunlik asosida.
 */
export function assertBodySize(req: Request, maxBytes: number) {
  const header = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(header) && header > maxBytes) {
    throw new Error(`Fayl hajmi limitdan oshgan (maksimum ${Math.round(maxBytes / 1024 / 1024)} MB)`);
  }
}