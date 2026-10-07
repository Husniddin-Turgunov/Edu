import "server-only";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import {
  encodeSessionToken,
  parseSessionToken,
  SESSION_COOKIE,
  type SessionUser,
} from "./auth-core";

export type {
  ParticipantKind,
  SessionUser,
  UserRole,
} from "./auth-core";

export {
  generatePassword,
  hashPassword,
  homePathForRole,
  roleLabel,
  SESSION_COOKIE,
  suggestLogin,
  verifyPassword,
} from "./auth-core";

// Bitta Prisma client — serverless'da har so'rovda yangi ulanish ochmasligi uchun.
const globalForPrisma = globalThis as unknown as { __akelaAuthDb?: PrismaClient };
const prisma: PrismaClient = globalForPrisma.__akelaAuthDb ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.__akelaAuthDb = prisma;

export async function setSession(user: SessionUser) {
  const days = 7;
  const token = encodeSessionToken(user, days);
  const jar = await cookies();
  const secure =
    process.env.NODE_ENV === "production" &&
    process.env.AKELA_USE_LOCAL_DB !== "1" &&
    process.env.AKELA_COOKIE_INSECURE !== "1";
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: days * 24 * 60 * 60,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Cookie yoki NextAuth JWT dan foydalanuvchi identifikatorini o'qiydi —
 *  baza bilan bog'lanmaydi. Faqat ichki ishlatish uchun. */
async function resolveSessionRaw(): Promise<
  (Omit<SessionUser, "userId"> & { userId: string; isAdmin: boolean }) | null
> {
  const jar = await cookies();

  // 1) Avval custom akela_session cookie'ni tekshiramiz
  const custom = parseSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (custom) {
    return {
      ...custom,
      userId: String(custom.userId),
      isAdmin: custom.role === "admin",
    };
  }

  // 2) NextAuth session
  try {
    const { authOptions } = await import("@/lib/auth-options");
    const session: any = await getServerSession(authOptions as any);
    if (session?.user) {
      const u = session.user as any;
      return {
        userId: String(u.id || u.email || "0"),
        role: (u.role === "admin" ? "admin" : u.role) || "participant",
        participantKind: null,
        employeeId: null,
        candidateId: null,
        name: u.name || u.email || "User",
        isAdmin: u.role === "admin",
      };
    }
  } catch (e) {
    // ignore
  }

  // 3) ESLATMA: bu yerga hech qachon imzosiz JWT fallback qo'shmang.
  // Oldin imzosiz cookie payload'ini o'qib isAdmin:true beruvchi kod bor edi —
  // u o'chirilgan, chunki brauzer cookie'ni o'zi yasab admin bo'lishi mumkin edi.
  // Faqat: (1) imzolangan akela_session, (2) NextAuth sessiyasi (authOptions bilan).

  return null;
}

/**
 * Foydalanuvchining BAZADAGI joriy holati.
 *
 * `pending` — tasdiqlash kutilmoqda, `rejected` — rad etilgan,
 * `blocked` — bot/admin tomonidan bloklangan.
 */
export type UserGate = { status: string; isActive: boolean; role: string } | null;

/**
 * Ruxsat darazasi — sessiya har doim bazadagi holat bilan tekshiriladi.
 *
 * Nega shunday: JWT cookie 7–30 kun yashaydi. Ilgari ruxsat faqat LOGIN
 * paytida tekshirilardi, ya'ni admin foydalanuvchini rad etsa yoki bloklasa,
 * uning eski cookie'si bilan u dashboard va testlarga kirishda davom etardi.
 * Endi har bir so'rovda `status === "approved"` tekshiriladi — bloklash
 * darhol kuchga kiradi.
 */
async function verifyGate(userId: string): Promise<UserGate> {
  try {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, isActive: true, role: true },
    });
    if (!row) return null;
    return { status: row.status, isActive: row.isActive !== false, role: row.role };
  } catch (e: any) {
    // Bazaga ulanib bo'lmasa — xavfsizlik uchun "yo'q" deymiz (fail-closed).
    console.error("[auth] holat tekshiruvida xato, foydalanuvchi rad etildi:", e?.message || e);
    return null;
  }
}

/** Ruxsat berilgan foydalanuvchilar uchun yagona ruxsat chegarasi. */
export function isGateOpen(gate: UserGate): boolean {
  return !!gate && gate.status === "approved" && gate.isActive;
}

/** Bazadagi aniq sabab asosida qisqa xabar (login/register oynasi uchun). */
export function gateReason(gate: UserGate): string | null {
  if (!gate) return "Foydalanuvchi topilmadi";
  if (gate.status === "pending") return "Tasdiqlash kutilmoqda";
  if (gate.status === "rejected") return "Ro'yxatdan o'tish rad etilgan";
  if (gate.status === "blocked") return "Akkaunt bloklangan";
  if (!gate.isActive) return "Akkaunt faoliyatda emas";
  return null;
}

/**
 * Universal session resolver: NextAuth + custom akela_session.
 *
 * DIQQAT: bu endi "kimdir kirdi" emas, "kimdir kirdi VA hali ham ruxsat oldi"
 * degani. Tasdiqlanmagan (`pending`), rad etilgan, bloklangan yoki
 * `isActive = false` foydalanuvchi uchun `null` qaytaradi.
 */
export async function getSession(): Promise<
  (Omit<SessionUser, "userId"> & { userId: string; isAdmin: boolean }) | null
> {
  const raw = await resolveSessionRaw();
  if (!raw) return null;

  const gate = await verifyGate(raw.userId);
  if (!isGateOpen(gate)) return null;

  // Holat ruxsatidan keyin — ro'l ma'lumot bazasidan (masshtablash uchun)
  const role = (gate as any).role;
  return {
    ...raw,
    role: (role === "admin" ? "admin" : role) || raw.role,
    isAdmin: role === "admin",
  };
}

/**
 * Sessiyani bazasiz tekshiradi (edge/middleware yoki tashxis diagnostikasi
 * uchun). Bu ruxsat BERMAYDI — faqat "kim" deganini aniqlaydi.
 * Ma'lumot olish uchun doimo `getSession()` ishlating.
 */
export async function getSessionUnverified() {
  return resolveSessionRaw();
}

/** Ruxsatsiz foydalanuvchilar uchun aniq sabab (login oynasi xabari). */
export async function explainGate(): Promise<string | null> {
  const raw = await resolveSessionRaw();
  if (!raw) return null;
  const gate = await verifyGate(raw.userId);
  return isGateOpen(gate) ? null : gateReason(gate);
}
