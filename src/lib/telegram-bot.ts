/**
 * Telegram Bot API вЂ” AKELA GROUP
 *
 * Bildirishnomalar (yangi ro'yxatdan o'tish, test natijasi va h.k.) botga
 * ulangan BARCHA obunachilarga bir xil yuboriladi вЂ” botda "admin" tushunchasi
 * yo'q, hamma teng.
 *
 * Obunachilar `BotSubscriber` jadvalida saqlanadi: botga /start bosgan yoki
 * biror xabar yozgan har bir odam avtomatik qo'shiladi.
 */

import { PrismaClient } from "@prisma/client";
import { timingSafeEqual } from "node:crypto";
import { levelForScore, renderResultCardPng } from "@/lib/result-card";

const BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || "8924345505:AAHc3WSg9CzhF_U-Eo5cJCSUo36ZNFVP8qg";
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * Webhook "secret token" вЂ” Telegram kelganda `X-Telegram-Bot-Api-Secret-Token`
 * sarlavhasida yuboradi. `setWebhook` da ham shu qiymat beriladi.
 *
 * Nima uchun: `POST /api/telegram` `approve:<userId>` va `reject:<userId>`
 * ni qayta ishlaydi. Secret bo'lmasa, butun internet soxta update yuborib
 * xodimlarni tasdiqlay/rad eta oladi вЂ” bu jiddiy xavfsizlik teshigi.
 */
const WEBHOOK_SECRET = process.env.TELEGRAM_BOT_WEBHOOK_SECRET || "";

/** Zaxira qabul qiluvchi: faqat obunachilar ro'yxati BO'SH bo'lganda ishlatiladi */
const FALLBACK_CHAT_ID = Number(process.env.TELEGRAM_ADMIN_CHAT_ID || "0") || 0;

const prisma = new PrismaClient();

export type InlineButton = { text: string; callback_data: string };

/** Telegram caption chegarasi 1024 вЂ” biz xavfsiz chegara bilan 1000 ishlatamiz */
const CAPTION_MAX = 1000;
/** Telegram xabar chegarasi 4096 belgi вЂ” uzunroq bo'lsa 400 "message is too long" */
const TEXT_MAX = 4000;

/** Xabar matnini Telegram chegarasiga sig'idiradi (belgi, kod nuqtasi bilan). */
function clipText(text: string, max = TEXT_MAX) {
  const out = String(text ?? "");
  if (out.length <= max) return out;
  return `${out.slice(0, max - 40)}\nвЂ¦ (${out.length - max + 40} belgi qisqartirildi)`;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ====== "Stiker" emoji larni olib tashlash ======
// Ikonkalar endi Liquid Glass PNG (rasm) ko'rinishida yuboriladi, shuning uchun
// matn va tugmalardagi bezak emoji lar kerak emas. вњ… вќЊ вљ пёЏ kabi ma'no
// bildiruvchi belgilar saqlanib qoladi.

const KEEP_EMOJI = new Set(["вњ…", "вќЊ", "вљ пёЏ", "рџ”ґ", "рџџў"]);
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
    text: clipText(cleanBody(text)),
    parse_mode: options?.parse_mode || "HTML",
    reply_markup: normalizeReplyMarkup(options?.reply_markup),
  });
}

/**
 * Telegram `reply_markup` faqat obyektni qabul qiladi: { inline_keyboard: [...] }.
 * Massiv [[btn]] bo'lib kelsa вЂ” avtomatik o'raymiz (400 xatolikning oldini oladi).
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
  form.append("caption", clipText(cleanBody(caption), CAPTION_MAX));
  form.append("parse_mode", options?.parse_mode || "HTML");
  if (options?.reply_markup) {
    form.append("reply_markup", JSON.stringify(normalizeReplyMarkup(options.reply_markup)));
  }
  const res = await fetch(`${API_BASE}/sendPhoto`, { method: "POST", body: form });
  return res.json().catch(() => ({ ok: false }));
}

/** Hujjat (PDF) yuborish вЂ” Telegram faylni ko'rsatilgan havoladan yuklab oladi */
export async function sendDocument(
  chatId: number,
  documentUrl: string,
  caption?: string,
  options?: { filename?: string; reply_markup?: any },
) {
  return callApi("sendDocument", {
    chat_id: chatId,
    document: documentUrl,
    caption: clipText(cleanBody(caption ?? ""), CAPTION_MAX),
    parse_mode: "HTML",
    reply_markup: normalizeReplyMarkup(options?.reply_markup),
  });
}

/**
 * Tayyor PDF baytlarini multipart orqali yuborish.
 *
 * Nega shu yo'l: `sendDocument` havolani Telegram serveri yuklab oladi вЂ” demak
 * hujjat umumiy (ochiq) URL bo'lishi kerak, admin sessiyasi esa ishlamaydi.
 * Vercel'da esa shu URL bir kun qo'lda deploy qilinmasligi mumkin. Bu yo'l
 * hujjatni shu yerda yig'ib, Telegram'ga to'g'ridan-to'g'ri beradi: URL ham,
 * `getSession()` ham kerak bo'lmaydi.
 */
export async function sendDocumentBuffer(
  chatId: number,
  pdf: ArrayBuffer | Uint8Array,
  filename: string,
  caption?: string,
  options?: { reply_markup?: any },
) {
  const bytes = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf);
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append(
    "document",
    new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }),
    filename || "hisobot.pdf",
  );
  if (caption) {
    form.append("caption", cleanBody(caption).slice(0, CAPTION_MAX));
    form.append("parse_mode", "HTML");
  }
  if (options?.reply_markup) {
    form.append("reply_markup", JSON.stringify(normalizeReplyMarkup(options.reply_markup)));
  }
  const res = await fetch(`${API_BASE}/sendDocument`, { method: "POST", body: form });
  return res.json().catch(() => ({ ok: false }));
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
    caption: caption ? clipText(cleanBody(caption), CAPTION_MAX) : undefined,
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
      [{ text: "рџ“Љ Statistika" }, { text: "рџ‘Ґ Foydalanuvchilar" }],
      [{ text: "вЏі Kutilayotgan" }, { text: "рџ“ќ Testlar" }],
      [{ text: "в„№пёЏ Yordam" }, { text: "рџ”„ Yangilash" }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

/** Doimiy inline menyu tugmalari */
export function mainInlineMenu(): InlineButton[][] {
  return [
    [
      { text: "рџ“Љ Statistika", callback_data: "menu:stats" },
      { text: "рџ‘Ґ Foydalanuvchilar", callback_data: "menu:users" },
    ],
    [
      { text: "вЏі Kutilayotgan", callback_data: "menu:pending" },
      { text: "рџ“ќ Testlar", callback_data: "menu:tests" },
    ],
    [
      { text: "в„№пёЏ Yordam", callback_data: "menu:help" },
      { text: "рџ”„ Yangilash", callback_data: "menu:refresh" },
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
    allowed_updates: ["message", "callback_query", "edited_message"],
    drop_pending_updates: false,
    // Telegram 6.6+ "secret token": kelganda `X-Telegram-Bot-Api-Secret-Token`
    // sarlavhasida yuboriladi. Biz shuni tekshiramiz вЂ” aks holda kimdir ham
    // soxta update yuborib `approve:<id>` orqali foydalanuvchini tasdiqlay oladi.
    ...(WEBHOOK_SECRET ? { secret_token: WEBHOOK_SECRET } : {}),
  });
}

/**
 * Webhook so'rovi haqiqatan Telegram'dan kelganmi tekshirish.
 *
 * `strict: false` вЂ” secret sozlanmagan (eski holat). U holda ogohlantirib
 * o'tkazamiz, lekin ishni to'xtatmaymiz: aks holda prod'da bot butunlay
 * o'chib qolardi.
 */
export function verifyWebhookSecret(headerValue: string | null): { ok: boolean; strict: boolean } {
  if (!WEBHOOK_SECRET) return { ok: true, strict: false };
  const given = String(headerValue || "");
  // Doimiy vaqtli taqqoslash: uzunlik va `timingSafeEqual`.
  const a = Buffer.from(given);
  const b = Buffer.from(WEBHOOK_SECRET);
  const ok = a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
  return { ok, strict: true };
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

// ====== Parol tiklash xabari ======

/**
 * Admin foydalanuvchining parolini tiklaganda xabar yuboradi.
 * Telegram ID bog'langan bo'lsa вЂ” unga, aks holda вЂ” bot obunachilariga.
 * `secret` вЂ” true bo'lsa, parol matni umuman yuborilmaydi (faqat "yo'qlandi").
 */
export async function notifyPasswordReset(input: {
  fullName: string;
  email: string;
  password?: string | null;
  telegramId?: string | null;
  secret?: boolean;
}): Promise<boolean> {
  const login = `https://akela.uz/login`;
  const lines = [
    "<b>Parol tiklandi</b>",
    `F.I.Sh: ${escapeHtml(input.fullName)}`,
    `Login: ${escapeHtml(input.email)}`,
  ];

  if (input.password && !input.secret) {
    lines.push(`Yangi parol: <code>${escapeHtml(input.password)}</code>`);
    lines.push("Iltimos, kirgandan keyin parolni darhol o'zgartiring.");
  } else {
    lines.push("Parol xabar qilinmadi вЂ” akela.uz orqali kirib, В«parolni tiklashВ»dan foydalaning.");
  }
  lines.push(`<a href="${login}">Saytga kirish в†’</a>`);

  const text = lines.join("\n");

  // 1) Foydalanuvchining o'z Telegram hisobi
  if (input.telegramId && /^-?\d+$/.test(String(input.telegramId))) {
    try {
      const res = await sendMessage(Number(input.telegramId), text);
      if (res && res.ok !== false) return true;
    } catch {
      /* keyingi yo'lni sinab ko'ramiz */
    }
  }

  // 2) Bot obunachilari (parol sir qilib yuborilmaydi)
  const ids = await getSubscriberIds();
  let sent = 0;
  for (const id of ids) {
    try {
      const res = await sendMessage(Number(id), text);
      if (res && res.ok !== false) sent++;
    } catch {
      /* o'tkazib ketamiz */
    }
  }
  return sent > 0;
}

// ====== Parol tiklash havolasi (reset token) вЂ” FAQAT shaxsiy chat ======

/**
 * Parol tiklash havolasini foydalanuvchining O'Z Telegram chat'iga yuboradi.
 *
 * Xavfsizlik prinsipi: token hech qachon API javobida, broadcast'da yoki
 * boshqa obunachida ko'rinmaydi вЂ” faqat hisob egasiga. Telegram yo'q bo'lsa
 * false qaytaramiz (chaqiruvchi umumiy javob beradi вЂ” email enumeratsiyasi yo'q).
 */
export async function sendPasswordResetLink(input: {
  fullName: string;
  email: string;
  telegramId?: string | null;
  resetUrl: string;
  expiresAt: Date;
}): Promise<boolean> {
  if (!input.telegramId || !/^-?\d+$/.test(String(input.telegramId))) return false;
  const lines = [
    "<b>AKELA вЂ” parol tiklash</b>",
    `F.I.Sh: ${escapeHtml(input.fullName)}`,
    `Login: ${escapeHtml(input.email)}`,
    "",
    "Quyidagi havola orqali yangi parol o'rnatishingiz mumkin (1 soat amal qiladi):",
    `<a href="${escapeHtml(input.resetUrl)}">Parolni tiklash</a>`,
    "",
    "Agar siz so'ramagan bo'lsangiz вЂ” e'tibor bermang, eski parolingiz kuchda qoladi.",
  ];
  try {
    const res = await sendMessage(Number(input.telegramId), lines.join("\n"));
    return Boolean(res && res.ok !== false);
  } catch {
    return false;
  }
}

// ====== Bot ichki xatolarini ko'rsatish ======

let adminErrorWarned = false;

/**
 * Bot ichida xato bo'lsa вЂ” admin chat'ga BIR marta xabar yuboriladi.
 *
 * Nima uchun: webhook har qanday holatda ham 200 qaytaradi (Telegram qayta
 * urinmasligi uchun), ya'ni xato faqat server logida ko'rinadi va prod'da
 * butunlay yo'qoladi. Foydalanuvchi esa "bot javob bermayapti" deydi va
 * sababini topolmaydi. Shu yerdan xato ko'rinadigan bo'ladi.
 */
export async function notifyAdminError(where: string, error: unknown) {
  const message = String((error as any)?.message || error || "noma'lum xato").slice(0, 600);
  console.error(`[telegram] ${where}: ${message}`);
  if (!FALLBACK_CHAT_ID || adminErrorWarned) return false;
  adminErrorWarned = true;
  try {
    await sendMessage(
      FALLBACK_CHAT_ID,
      [
        "в›” <b>Bot xatosi</b>",
        "",
        `рџ“Ќ <b>Joy:</b> ${escapeHtml(where)}`,
        `рџ”Ћ <b>Xato:</b> ${escapeHtml(message)}`,
      ].join("\n"),
    );
  } catch {
    /* yana urinish shart emas */
  }
  // Keyingi xatolar uchun ogohlantirishni qayta yoqish (1 daqiqadan keyin)
  setTimeout(() => {
    adminErrorWarned = false;
  }, 60_000);
  return true;
}

// ====== Hammaga bir xil xabar yuborish ======

export type BroadcastPayload = {
  text: string;
  /** Rasm bo'lsa вЂ” rasm + tagida yozma matn (caption) yuboriladi */
  photo?: ArrayBuffer | null;
  filename?: string;
  buttons?: InlineButton[][];
};

/**
 * Obunachini o'chirish kerakmi?
 *
 * Nega sezilarli: 400 xatosi har doim "obunachi o'ldi" degani EMAS. U ham
 * "message is too long", "can't parse entities", "photo_url_invalid" uchun ham
 * keladi. Eski kod har qanday 400 da obunachini o'chirar edi вЂ” ya'ni bitta
 * uzun xabar butun ro'yxatni yo'q qilardi. Endi faqat aniq "bu chat hamashu
 * yo'q/bloklangan" deydigan holatlar bekor qilinadi.
 */
export function shouldUnsubscribe(res: any): boolean {
  if (!res || res.ok !== false) return false;
  const code = Number(res.error_code || 0);
  const desc = String(res.description || "").toLowerCase();
  if (code === 403) return true; // bot bloklandi / foydalanuvchi chiqarib yubordi
  if (code !== 400) return false;
  return (
    /chat not found/.test(desc) ||
    /bot was kicked/.test(desc) ||
    /bot was blocked/.test(desc) ||
    /bot can't initiate/.test(desc) ||
    /user is deactivated/.test(desc) ||
    /bot can't send messages to non-private/.test(desc)
  );
}

export async function broadcast(payload: BroadcastPayload) {
  const ids = await getSubscriberIds();
  let sent = 0;
  let failed = 0;
  let unsubscribed = 0;

  const chats = ids
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id !== 0);

  const sendOne = async (chatId: number, id: string) => {
    try {
      const res = payload.photo
        ? await sendPhoto(chatId, payload.photo, payload.text, {
            filename: payload.filename,
            reply_markup: payload.buttons,
          })
        : await sendMessage(chatId, payload.text, { reply_markup: payload.buttons });

      if (res && res.ok === false) {
        failed++;
        if (shouldUnsubscribe(res)) {
          unsubscribed++;
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
  };

  // HAMMAGA BIR VAQTDA yetib borishi uchun parallel yuboriladi
  // (Telegram limitiga moslik uchun kichik partiyalarga bo'linadi)
  const BATCH = 20;
  for (let i = 0; i < chats.length; i += BATCH) {
    const batch = chats.slice(i, i + BATCH);
    await Promise.all(
      batch.map((chatId) => sendOne(chatId, ids[chats.indexOf(chatId)] || String(chatId))),
    );
  }

  console.log(
    `рџ“Ј Telegram: ${sent}/${ids.length} ga yuborildi (${failed} xato, ${unsubscribed} obunachi o'chirildi)`,
  );
  return { total: ids.length, sent, failed, unsubscribed };
}

// ====== Yangi foydalanuvchi (ruxsat / rad etish tugmalari bilan) ======

export type NewUserNotice = {
  /** Bazadagi user id вЂ” tugmalar shu id orqali ishlaydi */
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
    "рџ†• <b>Yangi foydalanuvchi qo'shildi!</b>",
    "",
    `рџ‘¤ <b>F.I.Sh:</b> ${escapeHtml(fullName)}`,
    `рџ“§ <b>Email:</b> ${escapeHtml(user.email || "yo'q")}`,
    `рџЏў <b>Bo'lim:</b> ${escapeHtml(user.department || "belgilanmagan")}`,
  ];
  if (user.position) lines.push(`рџ’ј <b>Lavozim:</b> ${escapeHtml(user.position)}`);
  lines.push("", "вЏі <b>Holat:</b> Tasdiqlash kutilmoqda", "", "рџ‘‡ Ruxsat bering yoki rad eting:");

  // Tugmalar user id bo'yicha ishlaydi (email bo'yicha emas) вЂ” uzunlik va
  // maxsus belgilar muammosi bo'lmaydi.
  const buttons: InlineButton[][] | undefined = user.id
    ? [
        [
          { text: "вњ… Ruxsat berish", callback_data: `approve:${user.id}` },
          { text: "вќЊ Rad etish", callback_data: `reject:${user.id}` },
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
  /** Nechta to'g'ri javob */
  correctCount?: number | null;
  /** Nechta xato javob */
  wrongCount?: number | null;
};

export async function notifyTestResult(result: TestResultNotice) {
  const level = result.level || levelForScore(result.score);
  const scoreText = typeof result.score === "number" ? `${result.score}%` : "baholanmagan";
  const statusText = result.passed ? "O'tdi вњ…" : "Yiqildi вќЊ";
  const when = result.completedAt ? new Date(result.completedAt) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timeText = `${pad(when.getDate())}.${pad(when.getMonth() + 1)}.${when.getFullYear()} ${pad(when.getHours())}:${pad(when.getMinutes())}`;

  const caption = [
    "рџЋ“ <b>Test natijasi</b>",
    "",
    `рџ‘¤ <b>F.I.Sh:</b> ${escapeHtml(result.fullName)}`,
    result.department ? `рџЏў <b>Bo'lim:</b> ${escapeHtml(result.department)}` : "",
    `рџ“ќ <b>Test:</b> ${escapeHtml(result.testTitle)}`,
    `рџ“Љ <b>Ball:</b> ${escapeHtml(scoreText)}${typeof result.passScore === "number" ? ` (o'tish bali: ${result.passScore}%)` : ""}`,
    ...(typeof result.correctCount === "number" && typeof result.wrongCount === "number" && result.correctCount + result.wrongCount > 0
      ? (() => {
          const totalAuto = result.correctCount! + result.wrongCount!;
          return [
            `вњ… <b>To'g'ri:</b> ${result.correctCount} ta (${Math.round((result.correctCount! / totalAuto) * 100)}%)`,
            `вќЊ <b>Xato:</b> ${result.wrongCount} ta (${Math.round((result.wrongCount! / totalAuto) * 100)}%)`,
          ];
        })()
      : []),
    `рџҐ‡ <b>Daraja:</b> ${escapeHtml(level)}`,
    `рџЏЃ <b>Holat:</b> ${statusText}`,
    `рџ•’ <b>Vaqt:</b> ${timeText}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Rasm (kartochka) generatsiyasi muvaffaqiyatsiz bo'lsa вЂ” faqat matn yuboriladi
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
            correctCount: result.correctCount ?? null,
            wrongCount: result.wrongCount ?? null,
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

// ====== Xavfsizlik hodisalari ======

export type SecurityAlert = {
  type: string;
  severity?: "info" | "warn" | "critical";
  fullName?: string | null;
  email?: string | null;
  department?: string | null;
  userId?: string | null;
  reason?: string | null;
  ip?: string | null;
  path?: string | null;
  detail?: string | null;
  blocked?: boolean;
};

const SEVERITY_ICON: Record<string, string> = { info: "в„№пёЏ", warn: "вљ пёЏ", critical: "рџ”ґ" };

/**
 * Xavfsizlik hodisasi (konsol/DevTools, ruxsat buzish, avtomatik bloklash).
 * Bot obunachilariga вЂ” shu jumladan adminlarga вЂ” bir xil yuboriladi.
 */
export async function notifySecurityAlert(alert: SecurityAlert) {
  const severity = alert.severity || "warn";
  const icon = SEVERITY_ICON[severity] || "вљ пёЏ";
  const lines = [
    `${icon} <b>XAVFSIZLIK XABARI</b>`,
    "",
    `рџљЁ <b>Hodisa:</b> ${escapeHtml(alert.type)}`,
  ];
  if (alert.fullName || alert.email) {
    lines.push(`рџ‘¤ <b>F.I.Sh:</b> ${escapeHtml(alert.fullName || "вЂ”")}`);
    lines.push(`рџ“§ ${escapeHtml(alert.email || "yo'q")}`);
  }
  if (alert.department) lines.push(`рџЏў <b>Bo'lim:</b> ${escapeHtml(alert.department)}`);
  if (alert.reason) lines.push(`рџ“ќ <b>Sabab:</b> ${escapeHtml(alert.reason)}`);
  if (alert.ip) lines.push(`рџЊђ <b>IP:</b> ${escapeHtml(alert.ip)}`);
  if (alert.path) lines.push(`рџ”— <b>Sahifa:</b> ${escapeHtml(alert.path)}`);
  if (alert.detail) lines.push(`рџ§ѕ ${escapeHtml(String(alert.detail).slice(0, 400))}`);
  lines.push(
    "",
    alert.blocked
      ? "в›” <b>Foydalanuvchi AVTOMATIK BLOKLANDI.</b> Admin panelda qo'lda blokdan chiqarish kerak."
      : "в„№пёЏ Holatni admin panelida tekshiring.",
  );

  const result = await broadcast({ text: lines.join("\n") });
  console.log(
    `[telegram] security alert: ${alert.type} -> ${result.sent}/${result.total} (blocked=${!!alert.blocked})`,
  );
  return result;
}

// ====== Testga kirish uchun ruxsat so'rovi ======
// Botga "Ruxsat berish" / "Rad etish" tugmalari bilan yuboriladi.

export const TEST_ACCESS_BOT_SECRET = process.env.TEST_ACCESS_SECRET || process.env.CRON_SECRET || "";

export type TestAccessNotice = {
  requestId: string;
  fullName: string;
  testTitle: string;
  email?: string | null;
  department?: string | null;
  position?: string | null;
  phone?: string | null;
  requestedAt: Date | string;
  origin: string;
};

function formatRequestTime(value: Date | string) {
  const when = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(when.getDate())}.${pad(when.getMonth() + 1)}.${when.getFullYear()} ${pad(when.getHours())}:${pad(when.getMinutes())}`;
}

/** Testga kirishga ruxsat so'rovi barcha bot obunachilariga yuboriladi */
export async function notifyTestAccessRequest(notice: TestAccessNotice) {
  const lines = [
    "📋 <b>Testga kirish uchun ruxsat so'rovi</b>",
    "",
    `👤 <b>F.I.Sh:</b> ${escapeHtml(notice.fullName)}`,
    notice.department ? `🏢 <b>Bo'lim:</b> ${escapeHtml(notice.department)}` : "",
    notice.position ? `💼 <b>Lavozim:</b> ${escapeHtml(notice.position)}` : "",
    notice.phone ? `📞 <b>Tel:</b> ${escapeHtml(notice.phone)}` : "",
    notice.email ? `📧 <b>Email:</b> ${escapeHtml(notice.email)}` : "",
    `📝 <b>Test:</b> ${escapeHtml(notice.testTitle)}`,
    `🕐 <b>So'rov vaqti:</b> ${formatRequestTime(notice.requestedAt)}`,
    "",
    "Xodim testni boshlashni kutmoqda. Ruxsat bering yoki rad eting.",
  ]
    .filter(Boolean)
    .join("\n");

  const keyboard: InlineButton[][] = [
    [
      { text: "✅ Ruxsat berish", callback_data: `testacc_yes:${notice.requestId}` },
      { text: "❌ Rad etish", callback_data: `testacc_no:${notice.requestId}` },
    ],
  ];

  const chatIds = await getSubscriberIds();
  const targets = chatIds.length ? chatIds : FALLBACK_CHAT_ID ? [String(FALLBACK_CHAT_ID)] : [];
  if (!targets.length) {
    console.error("notifyTestAccessRequest: hech qanday Telegram maqsadi yo'q");
    return { ok: false, error: "no targets", messages: [] as { chatId: number; messageId: number }[] };
  }

  // Hammasiga PARALLEL yuboriladi — bir vaqtda yetib boradi
  const results = await Promise.allSettled(
    targets.map((chatId) => sendMessage(Number(chatId), lines, { reply_markup: keyboard })),
  );

  const messages: { chatId: number; messageId: number }[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      const res: any = r.value;
      const messageId = res?.result?.message_id;
      if (messageId) messages.push({ chatId: Number(targets[i]), messageId });
    }
  });
  const sent = results.filter((r) => r.status === "fulfilled").length;
  return { ok: sent > 0, sent, total: targets.length, messages };
}

/**
 * Ruxsat berilganda/rad etilganda:
 *  1) so'rov xabari BORGAN barcha chatlarda tugmalar olib tashlanadi,
 *  2) botga ulangan hammaga bir xil natija xabari yuboriladi.
 */
export async function settleTestAccessRequest(opts: {
  telegramChats?: string | null;
  approved: boolean;
  fullName: string;
  testTitle: string;
}) {
  const approved = opts.approved;

  // 1) Eski so'rov xabaridagi tugmalarni hamma chatda olib tashlash
  let cleared = 0;
  try {
    const chats = JSON.parse(opts.telegramChats || "[]") as { chatId: number; messageId: number }[];
    await Promise.allSettled(
      chats.map((c) =>
        editMessageText(
          c.chatId,
          c.messageId,
          approved
            ? `✅ <b>Ruxsat berildi</b>\n👤 ${escapeHtml(opts.fullName)}\n📝 ${escapeHtml(opts.testTitle)}\n\nXodim testni boshlaydi.`
            : `❌ <b>Rad etildi</b>\n👤 ${escapeHtml(opts.fullName)}\n📝 ${escapeHtml(opts.testTitle)}\n\nXodimga ruxsat berilmadi.`,
          { parse_mode: "HTML", reply_markup: { inline_keyboard: [] } },
        ),
      ),
    );
    cleared = chats.length;
  } catch { /* ignore */ }

  // 2) Hammaga bir xil natija
  const result = await broadcast({
    text: approved
      ? `✅ <b>Testga kirishga ruxsat berildi</b>\n👤 ${escapeHtml(opts.fullName)}\n📝 ${escapeHtml(opts.testTitle)}\n\nRuxsat beruvchi: HR / nazoratchi. Xodim testni boshlaydi.`
      : `❌ <b>Testga kirish rad etildi</b>\n👤 ${escapeHtml(opts.fullName)}\n📝 ${escapeHtml(opts.testTitle)}\n\nXodimga ruxsat berilmadi. Sabab: HR bilan bog'lanish.`,
  }).catch(() => ({ total: 0, sent: 0, failed: 0 }));

  return { cleared, ...result };
}



