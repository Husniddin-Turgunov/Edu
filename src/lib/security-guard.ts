/**
 * Xavfsizlik qatlami — SERVER tomoni.
 *
 * Tamoyil: klient hech narsani ishonchli deb hisoblanmaydi. Klient faqat
 * "men konsol ochdim" deb xabar beradi; qaror (yozuv, bloklash, xabar yuborish)
 * shu yerdan, bazadagi ma'lumot asosida qabul qilinadi.
 *
 * Shu sababli konsol orqali `fetch` ni tahrirlab, o'ziga "ruxsat" yozib
 * bo'lmaydi: har bir so'rovda `getSession()` bazadagi `status` ni qayta tekshiradi
 * (bkz. `src/lib/auth.ts`), aynan shu yerda bloklash kuchga kiradi.
 */

import { PrismaClient } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { notifySecurityAlert } from "@/lib/telegram-bot";

const globalForPrisma = globalThis as unknown as { __akelaSecDb?: PrismaClient };
const prisma: PrismaClient = globalForPrisma.__akelaSecDb ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.__akelaSecDb = prisma;

export type SecurityEventType =
  | "devtools_open"
  | "devtools_closed"
  | "console_disabled_attempt"
  | "shortcut_blocked"
  | "context_menu_blocked"
  | "auto_blocked"
  | "gate_denied"
  | "tamper_attempt";

export type Severity = "info" | "warn" | "critical";

/** So'rovdan IP (Vercel / teskari proksi sarlavhalari). */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0]?.trim();
  return (first || req.headers.get("x-real-ip") || "").slice(0, 64);
}

function userAgent(req: NextRequest): string {
  return (req.headers.get("user-agent") || "").slice(0, 400);
}

/** Xavfsizlik hodisasini bazaga yozadi (hech qachon tashqi so'rovni sindirmaydi). */
export async function recordSecurityEvent(input: {
  userId?: string | null;
  type: SecurityEventType;
  severity?: Severity;
  ip?: string | null;
  userAgent?: string | null;
  path?: string | null;
  detail?: string | null;
}): Promise<void> {
  try {
    await prisma.securityEvent.create({
      data: {
        userId: input.userId || null,
        type: input.type,
        severity: input.severity || "info",
        ip: input.ip || null,
        userAgent: input.userAgent || null,
        path: (input.path || "").slice(0, 255) || null,
        detail: input.detail ? String(input.detail).slice(0, 2000) : null,
      },
    });
  } catch (e: any) {
    console.error("[security] hodisa yozilmadi:", e?.message || e);
  }
}

/**
 * Konsol/DevTools ochilganini aniqlanganda foydalanuvchini bloklaydi.
 *
 * `userId` klientdan EMAS, sessiyadan olinadi. Bloklash:
 *   - `status = "blocked"`  → `getSession()` darhol null qaytaradi
 *   - `blockedAt` / `blockedReason` yoziladi
 *   - `SecurityEvent` qatori qo'shiladi
 *   - Telegram orqali bot obunachilariga (adminlarga) xabar yuboriladi
 */
export async function blockForDevTools(input: {
  userId: string;
  reason: string;
  req: NextRequest;
  detail?: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, name: true, surname: true, email: true, department: true, status: true, role: true },
  });
  if (!user) return { blocked: false, reason: "Foydalanuvchi topilmadi" };

  // Adminlar avtomatik bloklanmaydi (faqat audit yoziladi, Telegram ogohlantirishsiz)
  if (user.role === "admin") {
    await recordSecurityEvent({
      userId: input.userId,
      type: "devtools_open",
      severity: "info",
      ip: clientIp(input.req),
      userAgent: userAgent(input.req),
      path: input.req.nextUrl?.pathname,
      detail: `Admin konsol tekshiruvi: ${input.detail || input.reason}`,
    });
    return { blocked: false, alreadyBlocked: false, reason: "Admin — bloklash bekor qilindi" };
  }

  const alreadyBlocked = user.status === "blocked";

  // BLOKLASH EMAS — FAQAT OGOHLANTIRISH.
  // Sabab: bloklash foydalanuvchini saytdan chiqarib yuboradi va u
  // ishlashda davom eta olmaydi. Endi hech kim bloklanmaydi: hodisa
  // qayd etiladi, Telegram'da xabar beriladi va foydalanuvchiga
  // OGOHLANTIRISH ko'rsatiladi. `status` butunlay tegilmaydi.
  await prisma.user.update({
    where: { id: input.userId },
    data: {
      blockedAt: new Date(),
      blockedReason: "OGOHLANTIRISH: " + input.reason.slice(0, 170),
      securityNotes: { increment: 1 },
    },
  });

  const fullName = [user.surname, user.name].filter(Boolean).join(" ").trim() || user.email;

  await recordSecurityEvent({
    userId: input.userId,
    type: "auto_blocked",
    severity: "critical",
    ip: clientIp(input.req),
    userAgent: userAgent(input.req),
    path: input.req.nextUrl?.pathname,
    detail: `${input.reason}${input.detail ? ` — ${input.detail}` : ""}`,
  });

  // Telegram xabari — `await` bilan: serverless'da "otib yuborib qo'yish"
  // javob qaytarilgach o'chib ketadi (xabar butunlay yetib borMAYdi).
  await notifySecurityAlert({
    type: "DevTools / konsol ochildi → OGOHLANTIRISH",
    severity: "warn",
    fullName,
    email: user.email,
    department: user.department,
    userId: user.id,
    reason: input.reason,
    ip: clientIp(input.req),
    path: input.req.nextUrl?.pathname,
    detail: input.detail,
    blocked: false,
  }).catch((e) => console.error("[security] telegram xato:", e?.message || e));

  // BloklanMAYdi — faqat ogohlantiriladi
  return { blocked: false, alreadyBlocked, reason: input.reason };
}

/**
 * Boshqaruvchi nuqta: klient xabar beradi, server qaror qabul qiladi.
 *
 * DIQQAT: `userId` so'rov tanasidan OLINMAYDI — sessiyadan olinadi. Shuning
 * uchun konsol orqali boshqa foydalanuvchini "bloklash"ga urinish ham
 * hech qanday natija bermaydi.
 */
export async function handleSecurityReport(req: NextRequest) {
  let event = "";
  let detail = "";
  try {
    const body = await req.json().catch(() => ({}) as any);
    event = String(body?.event || "").slice(0, 48);
    detail = String(body?.detail || "").slice(0, 400);
  } catch {
    /* bo'sh tana — hech narsa qilinmaydi */
  }

  const ip = clientIp(req);
  const ua = userAgent(req);
  const path = req.nextUrl?.pathname || null;

  // Ro'yxatdan o'tmagan mehmon: faqat anonim hodisa yoziladi (kimni
  // bloklash mumkin emas — identifikator yo'q).
  const session = await getSession().catch(() => null);
  if (!session) {
    await recordSecurityEvent({
      type: "devtools_open",
      severity: "warn",
      ip,
      userAgent: ua,
      path,
      detail: `anonim: ${event}${detail ? ` — ${detail}` : ""}`,
    });
    return NextResponse.json(
      { ok: true, recorded: true, blocked: false, anonymous: true },
      { status: 202 },
    );
  }

  // DevTools ochiq aniqlanganida HECH QANDAY amal bajarilmaydi.
  //
  // Sizning talab: "devtools ochiqligi aniqlansa hech qanday amal
  // bajarilmasligi kerak". Shu sababli bu yerda:
  //   - foydalanuvchi bloklanMAYdi
  //   - `blockedReason`/`blockedAt` YOZILMAYDI (go'ya xabar ham yo'q)
  //   - Telegram xabari YUBORILMAYDI
  //   - hech qanday foydalanuvchi ko'rinishiga ta'sir qilinMAYDI
  //
  // Klient esa DevTools ochiqligida kontentni bo'sh ekran bilan yashiradi
  // (`ConsoleGuard.tsx`) — ya'ni himoya ko'rinishda, foydalanuvchiga zarar
  // yetkazmasdan.
  if (event === "devtools_open") {
    return NextResponse.json({ ok: true, blocked: false, ignored: true, message: "Hodisa qayd etilmadi." });
  }

  // Qolgan barcha hodisalar — faqat JURNALDA (bloklashsiz).
  if (event === "console_disabled_attempt" || event === "shortcut_blocked") {
    await recordSecurityEvent({
      userId: String(session.userId),
      type: event,
      severity: "warn",
      ip,
      userAgent: ua,
      path,
      detail: `${detail || event} (bloklashsiz — kuchsiz signal)`,
    });
    return NextResponse.json({
      ok: true,
      recorded: true,
      blocked: false,
      note: "Hodisa qayd etildi, akkaunt bloklanmadi",
    });
  }

  if (event === "devtools_closed") {
    await recordSecurityEvent({
      userId: String(session.userId),
      type: "devtools_closed",
      severity: "info",
      ip,
      userAgent: ua,
      path,
      detail: detail || "konsol yopildi (bloklash avtomatik bekor qilinmaydi)",
    });
    return NextResponse.json({ ok: true, blocked: false, note: "Bloklash faqat admin tomonidan bekor qilinadi" });
  }

  // Noma'lum hodisa — jurnalda, ogohlantirmasiz
  await recordSecurityEvent({
    userId: String(session.userId),
    type: "tamper_attempt",
    severity: "info",
    ip,
    userAgent: ua,
    path,
    detail: event || "noma'lum",
  });
  return NextResponse.json({ ok: true, recorded: true, blocked: false });
}

/** Bloklangan foydalanuvchi uchun nega bloklanganini tekshiradi (login oynasi). */
export async function getBlockInfo(email: string) {
  try {
    const user = await prisma.user.findFirst({
      where: { email },
      select: { status: true, blockedAt: true, blockedReason: true },
    });
    if (!user || user.status !== "blocked") return null;
    return {
      blockedAt: user.blockedAt,
      reason: user.blockedReason || "Sabab ko'rsatilmagan",
    };
  } catch {
    return null;
  }
}
