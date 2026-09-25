/**
 * Telegram Bot API — AKELA GROUP
 *
 * Bildirishnomalar (yangi ro'yxatdan o'tish, test natijasi va h.k.) botga
 * ulangan BARCHA obunachilarga bir xil yuboriladi — botda "admin" tushunchasi
 * yo'q, hamma teng.
 *
 * Obunachilar `BotSubscriber` jadvalida saqlanadi: botga /start bosgan yoki
 * biror xabar yozgan har bir odam avtomatik qo'shiladi.
 */

import { PrismaClient } from "@prisma/client";
import { levelForScore, renderResultCardPng } from "@/lib/result-card";

const BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || "8924345505:AAHc3WSg9CzhF_U-Eo5cJCSUo36ZNFVP8qg";
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

/** Zaxira qabul qiluvchi: faqat obunachilar ro'yxati BO'SH bo'lganda ishlatiladi */
const FALLBACK_CHAT_ID = Number(process.env.TELEGRAM_ADMIN_CHAT_ID || "0") || 0;

const prisma = new PrismaClient();

export type InlineButton = { text: string; callback_data: string };

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ====== "Stiker" emoji larni olib tashlash ======
// Ikonkalar endi Liquid Glass PNG (rasm) ko'rinishida yuboriladi, shuning uchun
// matn va tugmalardagi bezak emoji lar kerak emas. ✅ ❌ ⚠️ kabi ma'no
// bildiruvchi belgilar saqlanib qoladi.

const KEEP_EMOJI = new Set(["✅", "❌", "⚠️", "🔴", "🟢"]);
const LEADING_EMOJI = /^(\s*)([\p{Extended_Pictographic}\uFE0F\u200D]+)/u;

/** Qator boshidagi bezak emoji ni olib tashlaydi (ma'noli belgilar qoladi) */
function cleanLine(line: string): string {
  const m = line.match(LEADING_EMOJI);
  if (!m) return line;
  if (KEEP_EMOJI.has(m[2])) return line;
  return line
    .replace(/^[\s\uFE0F\u200D]*[\p{Extended_Pictographic}\uFE0F\u200D]+/u, "")
    .replace(/^\s{1,2}/, "");
}

/** Butun matn uchun (har bir qator alohida) */
export function cleanBody(text: unknown): string {
  return String(text ?? "")
    .split("\n")
    .map(cleanLine)
    .join("\n");
}

/** Tugma yozuvi uchun */
export function cleanButtonLabel(text: unknown): string {
  const cleaned = cleanLine(String(text ?? "")).trim();
  return cleaned || String(text ?? "");
}


// ====== Past darajadagi API ======

async function callApi(method: string, payload: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => ({ ok: false }));
}

export async function sendMessage(
  chatId: number,
  text: string,
  options?: { parse_mode?: "HTML" | "Markdown"; reply_markup?: any },
) {
  return callApi("sendMessage", {
    chat_id: chatId,
    text: cleanBody(text),
    parse_mode: options?.parse_mode || "HTML",
    reply_markup: normalizeReplyMarkup(options?.reply_markup),
  });
}

/**
 * Telegram `reply_markup` faqat obyektni qabul qiladi: { inline_keyboard: [...] }.
 * Massiv [[btn]] bo'lib kelsa — avtomatik o'raymiz (400 xatolikning oldini oladi).
 * Tugma yozuvlaridagi bezak emoji lar ham shu yerda olib tashlanadi.
 */
function normalizeReplyMarkup(markup: any): any {
  if (Array.isArray(markup)) {
    return {
      inline_keyboard: markup.map((row: any[]) =>
        (row || []).map((b: any) => ({ ...b, text: cleanButtonLabel(b?.text) })),
      ),
    };
  }
  if (markup && Array.isArray(markup.inline_keyboard)) {
    return {
      ...markup,
      inline_keyboard: markup.inline_keyboard.map((row: any[]) =>
        (row || []).map((b: any) => ({ ...b, text: cleanButtonLabel(b?.text) })),
      ),
    };
  }
  return markup ?? undefined;
}

/** Rasm + tagida yozma matn (caption) */
export async function sendPhoto(
  chatId: number,
  photo: ArrayBuffer,
  caption: string,
  options?: { filename?: string; reply_markup?: any; parse_mode?: "HTML" | "Markdown" },
) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("photo", new Blob([photo], { type: "image/png" }), options?.filename || "natija.png");
  form.append("caption", cleanBody(caption));
  form.append("parse_mode", options?.parse_mode || "HTML");
  if (options?.reply_markup) {
    form.append("reply_markup", JSON.stringify(normalizeReplyMarkup(options.reply_markup)));
  }
  const res = await fetch(`${API_BASE}/sendPhoto`, { method: "POST", body: form });
  return res.json().catch(() => ({ ok: false }));
}

/** Hujjat (PDF) yuborish — Telegram faylni ko'rsatilgan havoladan yuklab oladi */
export async function sendDocument(
  chatId: number,
  documentUrl: string,
  caption?: string,
  options?: { filename?: string; reply_markup?: any },
) {
  return callApi("sendDocument", {
    chat_id: chatId,
    document: documentUrl,
    caption: cleanBody(caption ?? ""),
    parse_mode: "HTML",
    reply_markup: normalizeReplyMarkup(options?.reply_markup),
  });
}

/** Havoladagi rasmni (masalan Liquid Glass ikonka) yuborish */
export async function sendPhotoUrl(
  chatId: number,
  photoUrl: string,
  caption?: string,
  options?: { reply_markup?: any },
) {
  return callApi("sendPhoto", {
    chat_id: chatId,
    photo: photoUrl,
    caption: caption ? cleanBody(caption) : undefined,
    parse_mode: "HTML",
    reply_markup: normalizeReplyMarkup(options?.reply_markup),
  });
}

/** Rasm ostidagi yozuvni (caption) tahrirlash */
export async function editMessageCaption(
  chatId: number,
  messageId: number,
  caption: string,
  buttons?: any,
) {
  return callApi("editMessageCaption", {
    chat_id: chatId,
    message_id: messageId,
    caption: cleanBody(caption),
    parse_mode: "HTML",
    reply_markup: normalizeReplyMarkup(buttons),
  });
}

/** Xabarni o'chirish (menyu yangilanganda eski xabar to'planmasligi uchun) */
export async function deleteMessage(chatId: number, messageId: number) {
  return callApi("deleteMessage", { chat_id: chatId, message_id: messageId });
}

export function sendInlineKeyboard(
  chatId: number,
  text: string,
  buttons: InlineButton[][],
) {
  return sendMessage(chatId, text, { reply_markup: { inline_keyboard: buttons } });
}

export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  options?: { parse_mode?: "HTML"; reply_markup?: any },
) {
  return callApi("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: cleanBody(text),
    parse_mode: options?.parse_mode || "HTML",
    reply_markup: normalizeReplyMarkup(options?.reply_markup),
  });
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return callApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: !!text,
  });
}


/** Doimiy Reply Keyboard menyusi (har doim klaviatura o'rnida turadi) */
export function persistentReplyKeyboard(): {
  keyboard: { text: string }[][];
  resize_keyboard: boolean;
  is_persistent: boolean;
} {
  return {
    keyboard: [
      [{ text: "📊 Statistika" }, { text: "👥 Foydalanuvchilar" }],
      [{ text: "⏳ Kutilayotgan" }, { text: "📝 Testlar" }],
      [{ text: "ℹ️ Yordam" }, { text: "🔄 Yangilash" }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

/** Doimiy inline menyu tugmalari */
export function mainInlineMenu(): InlineButton[][] {
  return [
    [
      { text: "📊 Statistika", callback_data: "menu:stats" },
      { text: "👥 Foydalanuvchilar", callback_data: "menu:users" },
    ],
    [
      { text: "⏳ Kutilayotgan", callback_data: "menu:pending" },
      { text: "📝 Testlar", callback_data: "menu:tests" },
    ],
    [
      { text: "ℹ️ Yordam", callback_data: "menu:help" },
      { text: "🔄 Yangilash", callback_data: "menu:refresh" },
    ],
  ];
}

export async function setMyCommands(): Promise<any> {
  return callApi("setMyCommands", {
    commands: [
      { command: "start", description: "Botni ishga tushirish va menyu" },
      { command: "stats", description: "Umumiy statistika" },
      { command: "users", description: "Oxirgi 10 ta foydalanuvchi" },
      { command: "pending", description: "Tasdiqlash kutilayotganlar" },
      { command: "tests", description: "Faol testlar ro'yxati" },
      { command: "help", description: "Yordam va qo'llanma" },
    ],
  });
}

export async function getMe() {
  const res = await fetch(`${API_BASE}/getMe`);
  return res.json();
}

export async function getWebhookInfo() {
  const res = await fetch(`${API_BASE}/getWebhookInfo`);
  return res.json();
}

export async function setWebhook(webhookUrl: string) {
  return callApi("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
}

export async function deleteWebhook() {
  return callApi("deleteWebhook", {});
}

// ====== Obunachilar (botga ulangan odamlar) ======

/** Botga /start bosgan yoki biror xabar yozgan odamni obunachilarga qo'shadi */
export async function registerSubscriber(tg: {
  chatId: number | string;
  firstName?: string;
  lastName?: string;
  username?: string;
}) {
  const chatId = String(tg.chatId ?? "").trim();
  if (!chatId) return null;
  const name =
    [tg.firstName, tg.lastName].filter(Boolean).join(" ").trim() || tg.username || null;
  try {
    return await prisma.botSubscriber.upsert({
      where: { chatId },
      create: { chatId, name, username: tg.username || null, isActive: true },
      update: { name, username: tg.username || null, isActive: true },
    });
  } catch (e: any) {
    console.error("registerSubscriber error:", e?.message || e);
    return null;
  }
}

/** Botga ulangan barcha obunachilar chat ID lari */
export async function getSubscriberIds(): Promise<string[]> {
  try {
    const rows = await prisma.botSubscriber.findMany({
      where: { isActive: true },
      select: { chatId: true },
    });
    const ids = rows.map((r) => r.chatId).filter(Boolean);
    if (ids.length === 0 && FALLBACK_CHAT_ID) return [String(FALLBACK_CHAT_ID)];
    return ids;
  } catch (e: any) {
    console.error("getSubscriberIds error:", e?.message || e);
    return FALLBACK_CHAT_ID ? [String(FALLBACK_CHAT_ID)] : [];
  }
}

export async function subscriberCount(): Promise<number> {
  try {
    return await prisma.botSubscriber.count({ where: { isActive: true } });
  } catch {
    return 0;
  }
}

// ====== Hammaga bir xil xabar yuborish ======

export type BroadcastPayload = {
  text: string;
  /** Rasm bo'lsa — rasm + tagida yozma matn (caption) yuboriladi */
  photo?: ArrayBuffer | null;
  filename?: string;
  buttons?: InlineButton[][];
};

export async function broadcast(payload: BroadcastPayload) {
  const ids = await getSubscriberIds();
  let sent = 0;
  let failed = 0;

  for (const id of ids) {
    const chatId = Number(id);
    if (!Number.isFinite(chatId) || chatId === 0) continue;
    try {
      const res = payload.photo
        ? await sendPhoto(chatId, payload.photo, payload.text, {
            filename: payload.filename,
            reply_markup: payload.buttons,
          })
        : await sendMessage(chatId, payload.text, { reply_markup: payload.buttons });

      if (res && res.ok === false) {
        failed++;
        // 403 — bot bloklangan, 400 — chat topilmadi: obunachini o'chiramiz
        if (res.error_code === 403 || res.error_code === 400) {
          await prisma.botSubscriber
            .updateMany({ where: { chatId: id }, data: { isActive: false } })
            .catch(() => {});
        }
      } else {
        sent++;
      }
    } catch {
      failed++;
    }
  }

  console.log(`📣 Telegram: ${sent}/${ids.length} ga yuborildi (${failed} xato)`);
  return { total: ids.length, sent, failed };
}

// ====== Yangi foydalanuvchi (ruxsat / rad etish tugmalari bilan) ======

export type NewUserNotice = {
  /** Bazadagi user id — tugmalar shu id orqali ishlaydi */
  id?: string;
  name?: string | null;
  surname?: string | null;
  email?: string | null;
  department?: string | null;
  position?: string | null;
};

export async function notifyNewUser(user: NewUserNotice) {
  const fullName =
    [user.surname, user.name].filter(Boolean).join(" ").trim() || user.email || "Noma'lum";
  const lines = [
    "🆕 <b>Yangi foydalanuvchi qo'shildi!</b>",
    "",
    `👤 <b>F.I.Sh:</b> ${escapeHtml(fullName)}`,
    `📧 <b>Email:</b> ${escapeHtml(user.email || "yo'q")}`,
    `🏢 <b>Bo'lim:</b> ${escapeHtml(user.department || "belgilanmagan")}`,
  ];
  if (user.position) lines.push(`💼 <b>Lavozim:</b> ${escapeHtml(user.position)}`);
  lines.push("", "⏳ <b>Holat:</b> Tasdiqlash kutilmoqda", "", "👇 Ruxsat bering yoki rad eting:");

  // Tugmalar user id bo'yicha ishlaydi (email bo'yicha emas) — uzunlik va
  // maxsus belgilar muammosi bo'lmaydi.
  const buttons: InlineButton[][] | undefined = user.id
    ? [
        [
          { text: "✅ Ruxsat berish", callback_data: `approve:${user.id}` },
          { text: "❌ Rad etish", callback_data: `reject:${user.id}` },
        ],
      ]
    : undefined;

  return broadcast({ text: lines.join("\n"), buttons });
}

/** Eski nom bilan moslik uchun */
export const notifyAdminNewUser = notifyNewUser;

// ====== Test natijasi (rasm + tagida yozma matn) ======

export type TestResultNotice = {
  fullName: string;
  testTitle: string;
  score: number | null;
  passed: boolean;
  passScore?: number | null;
  department?: string | null;
  position?: string | null;
  completedAt?: string | Date | null;
  level?: string;
  /** Rasm ichidagi shrift CDN dan olinishi uchun (ixtiyoriy) */
  origin?: string;
};

export async function notifyTestResult(result: TestResultNotice) {
  const level = result.level || levelForScore(result.score);
  const scoreText = typeof result.score === "number" ? `${result.score}%` : "baholanmagan";
  const statusText = result.passed ? "O'tdi ✅" : "Yiqildi ❌";
  const when = result.completedAt ? new Date(result.completedAt) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timeText = `${pad(when.getDate())}.${pad(when.getMonth() + 1)}.${when.getFullYear()} ${pad(when.getHours())}:${pad(when.getMinutes())}`;

  const caption = [
    "🎓 <b>Test natijasi</b>",
    "",
    `👤 <b>F.I.Sh:</b> ${escapeHtml(result.fullName)}`,
    result.department ? `🏢 <b>Bo'lim:</b> ${escapeHtml(result.department)}` : "",
    `📝 <b>Test:</b> ${escapeHtml(result.testTitle)}`,
    `📊 <b>Ball:</b> ${escapeHtml(scoreText)}${typeof result.passScore === "number" ? ` (o'tish bali: ${result.passScore}%)` : ""}`,
    `🥇 <b>Daraja:</b> ${escapeHtml(level)}`,
    `🏁 <b>Holat:</b> ${statusText}`,
    `🕒 <b>Vaqt:</b> ${timeText}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Rasm (kartochka) generatsiyasi muvaffaqiyatsiz bo'lsa — faqat matn yuboriladi
  let photo: ArrayBuffer | null = null;
  try {
    photo = await renderResultCardPng(
      {
        fullName: result.fullName,
        department: result.department,
        position: result.position,
        testTitle: result.testTitle,
        score: result.score,
        passScore: result.passScore ?? null,
        passed: result.passed,
        level,
        completedAt: when,
      },
      result.origin,
    );
  } catch (e: any) {
    console.error("Result card render error:", e?.message || e);
    photo = null;
  }

  return broadcast({
    text: caption,
    photo,
    filename: "akela-natija.png",
  });
}

/** Eski nom bilan moslik uchun */
export const notifyAdminTestResult = notifyTestResult;


