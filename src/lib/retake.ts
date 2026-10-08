/**
 * "Qayta topshirish" (retake) ruxsati — vaqt chegarasi va yopilishi.
 *
 * OLDINGI XOLAT: ruxsat berilganda `TestResult` qatori yaratiladi
 * (`gradingStatus = "retake"`, `completedAt = null`) va u HECH QACHON
 * yopilmasdi. Foydalanuvchi testni topshirmasa, placeholder doim ochiq qoladi
 * va admin yangi imkoniyat bera olmaydi (POST idempotent: mavjud placeholder
 * topilsa `alreadyGranted` qaytaradi). Ro'yxatda bir xil "Qayta topshirish
 * berilgan" yozuvi yig'ilib qoladi.
 *
 * YANGI XOLAT:
 *   1. Ruxsat berilgan vaqtdan boshlab `RETAKE_TTL_DAYS` o'tadi.
 *   2. `sweepExpiredRetakes()` shu placeholder'ni avtomatik YOPADI —
 *      `gradingStatus = "retake_expired"`. Tarix saqlanadi (o'chirilmaydi).
 *   3. Yopilgandan keyin yangi ruxsat berish MUMKIN. Eski urinishlar ro'yxatda
 *      qoladi.
 *
 * Muhim: `completedAt` NULL qoladi — shuning uchun `getTestForTaking` /
 * `submitTestResult` hisoblariga placeholder hech qachon urinish sifatida
 * sanalmaydi va o'tgan natijalarni buzmaydi.
 */

import type { PrismaClient } from "@prisma/client";

/** Ruxsat berilgandan keyin foydalanuvchi shu muddatda topshirishi mumkin. */
export const RETAKE_TTL_DAYS = 3;
const RETAKE_TTL_MS = RETAKE_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Faol ruxsat (topshirilmagan, vaqti kelmagan). */
export const RETAKE_ACTIVE = "retake";
/** Vaqti tuggan, avtomatik yopilgan ruxsat (tarixda qoladi). */
export const RETAKE_EXPIRED = "retake_expired";

/**
 * Berilgan vaqtdan boshlab TTL o'tib ketganmi?
 * `grantedAt` — odatda `startedAt` (placeholder yaratilganda to'ldiriladi).
 */
export function isRetakeExpired(
  grantedAt: Date | string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!grantedAt) return false;
  const t = new Date(grantedAt).getTime();
  if (Number.isNaN(t)) return false;
  return now - t > RETAKE_TTL_MS;
}

/** Qolgan kunlar (0 = bugun tugaydi, manfiy = allaqachon tugagan). */
export function retakeDaysLeft(
  grantedAt: Date | string | null | undefined,
  now: number = Date.now(),
): number {
  if (!grantedAt) return RETAKE_TTL_DAYS;
  const t = new Date(grantedAt).getTime();
  if (Number.isNaN(t)) return RETAKE_TTL_DAYS;
  return Math.ceil((t + RETAKE_TTL_MS - now) / (24 * 60 * 60 * 1000));
}

type PrismaLike = PrismaClient | any;

/**
 * Vaqti o'tgan barcha faol retake placeholder'larini yopadi.
 * Xavfsiz: hech narsa o'chirilmaydi, faqat `gradingStatus` yangilanadi.
 * Qaytaradi: yopilgan qatorlar soni.
 */
export async function sweepExpiredRetakes(prisma: PrismaLike, now: number = Date.now()): Promise<number> {
  const active = await prisma.testResult.findMany({
    where: { gradingStatus: RETAKE_ACTIVE, completedAt: null },
    select: { id: true, startedAt: true },
  });
  const stale = active.filter((r: any) => isRetakeExpired(r.startedAt, now));
  if (!stale.length) return 0;
  await prisma.testResult.updateMany({
    where: { id: { in: stale.map((r: any) => r.id) } },
    data: { gradingStatus: RETAKE_EXPIRED },
  });
  return stale.length;
}

/** Foydalanuvchi + test uchun hali faol ruxsat bormi? */
export async function hasActiveRetake(
  prisma: PrismaLike,
  userId: string,
  testId: string,
  now: number = Date.now(),
): Promise<boolean> {
  await sweepExpiredRetakes(prisma, now);
  const found = await prisma.testResult.findFirst({
    where: { userId, testId, gradingStatus: RETAKE_ACTIVE, completedAt: null },
    select: { id: true },
  });
  return !!found;
}