/**
 * lib/ai/session.ts
 *
 * KUNLIK SESSIYA: 07:00 → keyingi kuni 06:59.
 *
 * Qoidalar:
 *  - Sessiya kuni = (hozir - 7 soat) dan keyingi sana (YYYY-MM-DD).
 *    Demak 07:00 dan keyingi har bir xabar yangi kunlik sessiyani ochadi va
 *    avvalgisini yopadi.
 *  - Bir kun ichidagi barcha savol-javoblar bitta sessiyada qoladi: model
 *    o'sha kunning barcha muhokamasini (xotira + so'nggi xabarlar) ko'radi.
 *  - 07:00 da eski sessiya `status: "closed"` bo'lib, `memory` (kunlik xulosa)
 *    saqlanib qoladi — keyingi kunlarda "o'tkazilgan suhbat" sifatida o'qilishi
 *    mumkin, lekin yangi ishni aralashtirmaydi.
 */

import { db } from "@/lib/db";

/** Sessiya kuni kaliti. 07:00 dan oldingi vaqt avvalgi kunga tegadi. */
export function sessionDayKey(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - 7 * 60 * 60 * 1000);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, "0");
  const d = String(shifted.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Keyingi sessiya ochilishiga qolgan vaqt (ms). */
export function msUntilRollover(now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(7, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

/** "Bugungi sessiya 07:00 da yangilanadi" — UI uchun. */
export function rolloverInfo(now: Date = new Date()) {
  const ms = msUntilRollover(now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return {
    dayKey: sessionDayKey(now),
    at: "07:00",
    inHuman: h > 0 ? `${h} soat ${m} daqiqa` : `${m} daqiqa`,
  };
}

export type DailySession = {
  id: string;
  title: string;
  dayKey: string;
  status: string;
  messageCount: number;
  memory: string;
};

/**
 * Foydalanuvchining bugungi sessiyasini qaytaradi, yo'q bo'lsa yaratadi.
 * `requestedId` berilgan bo'lsa va u boshqa kunga tegishli yoki yopiq bo'lsa —
 * yangisini ochadi (eski sessiyani unutmadan).
 */
export async function openDailySession(
  userId: string,
  requestedId?: string | null,
  now: Date = new Date(),
): Promise<DailySession> {
  const dayKey = sessionDayKey(now);

  if (requestedId) {
    const requested = await db.aiConversation.findFirst({
      where: { id: requestedId, userId },
      select: { id: true, title: true, dayKey: true, status: true, messageCount: true, memory: true },
    });
    if (requested && requested.dayKey === dayKey && requested.status === "open") return requested;
  }

  const today = await db.aiConversation.findFirst({
    where: { userId, dayKey, status: "open" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, dayKey: true, status: true, messageCount: true, memory: true },
  });
  if (today) return today;

  // Yangi kun — avvalgi ochiq sessiyalar yopiladi, xotirasi saqlanadi.
  const stale = await db.aiConversation.findMany({
    where: { userId, status: "open", NOT: { dayKey } },
    select: { id: true },
  });
  if (stale.length) {
    for (const row of stale) {
      await db.aiConversation
        .update({
          where: { id: row.id },
          data: { status: "closed", memory: await summarizeDay(row.id) },
        })
        .catch(() => {});
    }
  }

  const created = await db.aiConversation.create({
    data: { userId, dayKey, status: "open", title: `Sessiya ${dayKey}` },
    select: { id: true, title: true, dayKey: true, status: true, messageCount: true, memory: true },
  });
  return created;
}

/** Kunning barcha muhokamasidan qisqa xulosa — "eslab qolish" qatlami. */
export async function summarizeDay(conversationId: string): Promise<string> {
  const rows = await db.aiMessage.findMany({
    where: { conversationId, role: "user" },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { content: true, createdAt: true },
  });
  if (!rows.length) return "";
  return rows
    .map((r, i) => `${i + 1}. [${r.createdAt.toISOString().slice(11, 16)}] ${r.content.slice(0, 300)}`)
    .join("\n")
    .slice(0, 12_000);
}

/**
 * Model uchun kunlik xotira bloki: bugungi sessiyada so'ralgan hamma narsa.
 * Bu MAX_HISTORY_MESSAGES dan qat'i narsa — sessiya tugamaguncha eslab qoladi.
 */
export async function sessionMemory(conversationId: string, currentMessage: string): Promise<string> {
  const rows = await db.aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 300,
    select: { role: true, content: true, createdAt: true },
  });
  if (!rows.length) return "";

  const lines = rows
    .filter((m) => m.content && m.content !== currentMessage)
    .map((m) => {
      const t = m.createdAt.toISOString().slice(11, 16);
      const who = m.role === "assistant" ? "AI" : m.role === "tool" ? "vosita" : "foydalanuvchi";
      return `[${t}] ${who}: ${m.content.replace(/\s+/g, " ").slice(0, 400)}`;
    });

  return lines.join("\n").slice(-16_000);
}

/** Eski sessiyalar (oxirgi N ta) — arxiv ko'rinishi. */
export async function closedSessions(userId: string, take = 10) {
  return db.aiConversation.findMany({
    where: { userId, status: "closed" },
    orderBy: { updatedAt: "desc" },
    take,
    select: { id: true, title: true, dayKey: true, messageCount: true, memory: true, updatedAt: true },
  });
}