import { PrismaClient } from "@prisma/client";
import { notifyTestAccessRequest } from "@/lib/telegram-bot";

/**
 * Testga kirish ruxsati — umumiy mantiq (LMS test va dars testlari uchun).
 * Telegram botga so'rov yuboriladi, foydalanuvchi javobni kutadi.
 */

const prisma = new PrismaClient();

export const PENDING_WINDOW_MS = 10 * 60 * 1000; // javob kelmagan so'rov 10 daqiqada eskiradi
// Eslatma: ruxsat BIR MARTA qo'llaniladi. Testni ochgan zahoti "used" ga o'tadi —
// foydalanuvchi chiqib yana kelsa YANGI ruxsat so'raydi (30 daqiqalik reuse oynasi yo'q).

export type AccessTarget = {
  userId: string;
  /** "test" (LMS) | "lesson" (dars testi) | "retake" (qayta topshirish) */
  targetType: "test" | "lesson" | "retake";
  /** LMS test id (faqat targetType="test") */
  testId?: string | null;
  targetLabel: string;
  /** Dars testi uchun: {slug, mi, li} */
  targetMeta?: Record<string, any> | null;
  origin: string;
};

function metaKey(meta?: Record<string, any> | null) {
  // Eslatma: lesson-access {kind, a, b, c} yuboradi, eski sahifalar {slug, mi, li}.
  // Agar faqat "slug/mi/li" qaralsa, "kind/a/b/c" so'rovlari hammasi null kalitga
  // tushadi — ya'ni BITTA darsda olingan ruxsat BARCHA darslarni ochadi.
  return JSON.stringify({
    kind: meta?.kind ?? null,
    slug: meta?.slug ?? meta?.a ?? null,
    mi: meta?.mi ?? meta?.b ?? null,
    li: meta?.li ?? meta?.c ?? null,
  });
}

async function findLast(userId: string, target: AccessTarget) {
  return prisma.testAccessRequest.findFirst({
    where: (
      target.targetType === "lesson"
        ? { userId, targetType: "lesson", targetMeta: metaKey(target.targetMeta) }
        : { userId, testId: target.testId!, targetType: { in: ["test", "retake"] } }
    ) as any,
    orderBy: { requestedAt: "desc" },
  });
}

/** Joriy holat: none | pending | approved | rejected | expired */
export async function getAccessStatus(target: AccessTarget) {
  const last = await findLast(target.userId, target);
  if (!last) return { status: "none" as const, request: null };

  if (last.status === "pending") {
    if (Date.now() - last.requestedAt.getTime() > PENDING_WINDOW_MS) {
      await prisma.testAccessRequest.update({
        where: { id: last.id },
        data: { status: "expired", decidedAt: new Date() },
      });
      return { status: "expired" as const, request: last };
    }
    return { status: "pending" as const, request: last };
  }

  if (last.status === "approved") {
    // Ruxsat berilgan, lekin hali ishlatilmagan (test ochilmagan) — faqat shu holatda o'tadi
    return { status: "approved" as const, request: last };
  }

  if (last.status === "rejected" && last.decidedAt && Date.now() - last.decidedAt.getTime() < 60 * 1000) {
    return { status: "rejected" as const, request: last };
  }

  return { status: "none" as const, request: last };
}

/** Server tomonda ruxsat tekshiruvi (asosiy himoya qatlami).
 *  Client gate qanday bo'lishidan qat'i nazar: faqat admin yoki
 *  "approved" (hali ochilmagan) yoki "used" (ochilgan, 2 soat ichida)
 *  so'rov bor foydalanuvchi test kontentini/topshirishini o'tkaza oladi. */
export const ACCESS_SESSION_MS = 2 * 60 * 60 * 1000;

export async function hasApprovedAccess(target: AccessTarget): Promise<boolean> {
  const last = await findLast(target.userId, target);
  if (!last) return false;
  if (last.status === "approved") return true;
  if (last.status === "used") {
    const anchor = last.decidedAt?.getTime() ?? last.requestedAt.getTime();
    return Date.now() - anchor < ACCESS_SESSION_MS;
  }
  return false;
}

/**
 * Ruxsatni "ishlatilgan" deb belgilaydi — foydalanuvchi testni ochdi.
 * Keyingi tashrifda (chiqib qaytib kelsa) yangi ruxsat so'ranadi.
 */
export async function consumeAccess(requestId: string) {
  await prisma.testAccessRequest
    .updateMany({ where: { id: requestId, status: "approved" }, data: { status: "used" } })
    .catch(() => {});
  return { ok: true };
}

/** So'rov yaratadi (kerak bo'lsa) va Telegram botga xabar yuboradi */
export async function requestAccess(target: AccessTarget) {
  const current = await getAccessStatus(target);
  if (current.status === "pending" || current.status === "approved" || current.status === "rejected") {
    return { ...current, telegram: null };
  }

  const request = await prisma.testAccessRequest.create({
    data: {
      userId: target.userId,
      testId: target.targetType === "lesson" ? null : target.testId!,
      targetType: target.targetType,
      targetLabel: target.targetLabel,
      targetMeta: target.targetMeta ? metaKey(target.targetMeta) : null,
      status: "pending",
    },
  });

  let telegram: { ok: boolean; sent?: number; total?: number; error?: string } | null = null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: target.userId },
      select: { name: true, surname: true, email: true, department: true, position: true, phone: true },
    });
    const sent: any = await notifyTestAccessRequest({
      requestId: request.id,
      fullName: [user?.surname, user?.name].filter(Boolean).join(" ") || user?.email || "Noma'lum",
      testTitle: target.targetLabel,
      email: user?.email ?? null,
      department: user?.department ?? null,
      position: user?.position ?? null,
      phone: user?.phone ?? null,
      requestedAt: request.requestedAt,
      origin: target.origin,
    });
    telegram = { ok: !!sent?.ok, sent: sent?.sent, total: sent?.total };
    if (Array.isArray(sent?.messages) && sent.messages.length) {
      await prisma.testAccessRequest.update({
        where: { id: request.id },
        data: { telegramChats: JSON.stringify(sent.messages) },
      });
    }
  } catch (e: any) {
    telegram = { ok: false, error: e?.message || String(e) };
    console.error("Telegram ruxsat xabari yuborilmadi:", telegram.error);
  }

  return { status: "pending" as const, request, telegram };
}
