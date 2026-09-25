/**
 * Telegram Bot — Local Polling Mode (DB bilan)
 * Ishga tushirish: npx tsx scripts/telegram-bot-poll.ts
 *
 * ⚠️ DEPRECATED: bot endi WEBHOOK orqali ishlaydi → /api/telegram
 * (rasmiy, adminsiz va hamma obunachi bir xil xabar oladi).
 * Bu skript faqat lokal sinov uchun. Ishga tushirishdan oldin webhookni
 * o'chirib qo'ying, aks holda Telegram "409 Conflict" beradi:
 *   curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
 * Keyin qayta webhook o'rnatish:
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://edu.akelagroup.uz/api/telegram"
 */

import { PrismaClient } from "@prisma/client";

const BOT_TOKEN = "8924345505:AAHc3WSg9CzhF_U-Eo5cJCSUo36ZNFVP8qg";
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || "6839364895";

const prisma = new PrismaClient();
let lastUpdateId = 0;

// ====== API ======

async function apiCall(method: string, body?: any) {
  const res = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  return apiCall("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  });
}

async function answerCallbackQuery(id: string, text?: string) {
  return apiCall("answerCallbackQuery", { callback_query_id: id, text, show_alert: true });
}

async function editMessageText(chatId: number, messageId: number, text: string, replyMarkup?: any) {
  return apiCall("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  });
}

// ====== Admin tekshirish ======

function isAdmin(userId?: number): boolean {
  if (!ADMIN_CHAT_ID || !userId) return false;
  return String(userId) === ADMIN_CHAT_ID;
}

// ====== Bot logikasi ======

async function handleMessage(msg: any) {
  const chatId = msg.chat.id;
  const text = msg.text || "";
  const firstName = msg.from?.first_name || "";
  const userId = msg.from?.id;

  console.log(`📩 [${firstName}] ${text}`);

  // /start
  if (text === "/start") {
    // Telegram ID ni DB ga saqlash
    try {
      await prisma.user.updateMany({
        where: { telegramId: String(userId) },
        data: { telegramId: String(userId) },
      });
    } catch {}

    if (isAdmin(userId)) {
      const pendingCount = await prisma.user.count({ where: { status: "pending" } });
      const activeCount = await prisma.user.count({ where: { status: "active" } });

      await sendMessage(chatId, [
        `Salom, <b>${firstName}</b>! 👋`,
        ``,
        `🎭 Siz <b>AKELA GROUP</b> admin paneli botidasiz.`,
        ``,
        `📊 <b>Tezkor ma'lumot:</b>`,
        `   👥 Faol: ${activeCount} | ⏳ Kutilayotgan: ${pendingCount}`,
        ``,
        `📋 Buyruqlar:`,
        `/stats — To'liq statistika`,
        `/users — Foydalanuvchilar ro'yxati`,
        `/pending — Tasdiqlash kutilayotganlar`,
        `/tests — Testlar`,
        `/approve email — Tasdiqlash`,
        `/reject email — Rad etish`,
      ].join("\n"));
    } else {
      await sendMessage(chatId, [
        `Salom, <b>${firstName}</b>! 👋`,
        ``,
        `🎭 Siz <b>AKELA GROUP</b> ta'lim portalisiz.`,
        ``,
        `📝 Testlarni saytdan topshiring.`,
        `📊 Natijalaringiz shu yerda ko'rinadi.`,
        ``,
        `🔗 Sayt: akela-app.vercel.app`,
      ].join("\n"));
    }
    return;
  }

  // /stats
  if (text === "/stats") {
    if (!isAdmin(userId)) {
      await sendMessage(chatId, "❌ Sizda ruxsat yo'q.");
      return;
    }

    const [totalUsers, activeUsers, pendingUsers, rejectedUsers, totalTests, totalResults, totalQuestions] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "active" } }),
      prisma.user.count({ where: { status: "pending" } }),
      prisma.user.count({ where: { status: "rejected" } }),
      prisma.test.count(),
      prisma.testResult.count(),
      prisma.question.count(),
    ]);

    await sendMessage(chatId, [
      `📊 <b>AKELA GROUP — Statistika</b>`,
      ``,
      `👥 <b>Foydalanuvchilar:</b>`,
      `   Jami: ${totalUsers}`,
      `   ✅ Faol: ${activeUsers}`,
      `   ⏳ Kutilayotgan: ${pendingUsers}`,
      `   ❌ Rad etilgan: ${rejectedUsers}`,
      ``,
      `📝 <b>Testlar:</b> ${totalTests}`,
      `❓ <b>Savollar:</b> ${totalQuestions}`,
      `📋 <b>Topshirishlar:</b> ${totalResults}`,
    ].join("\n"));
    return;
  }

  // /users
  if (text === "/users") {
    if (!isAdmin(userId)) {
      await sendMessage(chatId, "❌ Sizda ruxsat yo'q.");
      return;
    }

    const users = await prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: { name: true, surname: true, email: true, status: true, department: true },
    });

    const list = users.map((u, i) =>
      `${i + 1}. <b>${[u.surname, u.name].filter(Boolean).join(" ") || u.email}</b> — ${u.status === "active" ? "✅" : u.status === "pending" ? "⏳" : "❌"}`
    ).join("\n");

    await sendMessage(chatId, [
      `👥 <b>Foydalanuvchilar (oxirgi 10):</b>`,
      ``,
      list || "Yo'q",
    ].join("\n"));
    return;
  }

  // /pending
  if (text === "/pending") {
    if (!isAdmin(userId)) {
      await sendMessage(chatId, "❌ Sizda ruxsat yo'q.");
      return;
    }

    const pending = await prisma.user.findMany({
      where: { status: "pending" },
      take: 10,
      orderBy: { createdAt: "asc" },
      select: { name: true, email: true, surname: true, department: true },
    });

    if (pending.length === 0) {
      await sendMessage(chatId, "✅ Kutilayotgan foydalanuvchi yo'q!");
      return;
    }

    const buttons = pending.map(u => [
      { text: `✅ ${(u.surname || "") + " " + (u.name || u.email)}`, callback_data: `approve_${u.email}` },
    ]);

    await sendMessage(chatId, [
      `⏳ <b>Tasdiqlash kutilayotganlar (${pending.length}):</b>`,
      ``,
      ...pending.map((u, i) => `${i + 1}. <b>${u.name || u.email}</b> — ${u.department || "?"}`),
    ].join("\n"), { inline_keyboard: buttons });
    return;
  }

  // /tests
  if (text === "/tests") {
    if (!isAdmin(userId)) {
      await sendMessage(chatId, "❌ Sizda ruxsat yo'q.");
      return;
    }

    const tests = await prisma.test.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { title: true, status: true, _count: { select: { questions: true, results: true } } },
    });

    const list = tests.map((t, i) =>
      `${i + 1}. <b>${t.title}</b> — ${t.status === "active" ? "✅" : "📝"} (${t._count.questions} savol, ${t._count.results} topshirish)`
    ).join("\n");

    await sendMessage(chatId, [
      `📝 <b>Testlar (oxirgi 5):</b>`,
      ``,
      list || "Yo'q",
    ].join("\n"));
    return;
  }

  // /approve email
  if (text.startsWith("/approve ")) {
    if (!isAdmin(userId)) {
      await sendMessage(chatId, "❌ Sizda ruxsat yo'q.");
      return;
    }

    const email = text.replace("/approve ", "").trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await sendMessage(chatId, `❌ "${email}" topilmadi.`);
      return;
    }

    await prisma.user.update({
      where: { email },
      data: { status: "approved", approvedAt: user.approvedAt || new Date() },
    });
    await sendMessage(chatId, `✅ <b>${[user.surname, user.name].filter(Boolean).join(" ") || email}</b> tasdiqlandi!`);
    return;
  }

  // /reject email
  if (text.startsWith("/reject ")) {
    if (!isAdmin(userId)) {
      await sendMessage(chatId, "❌ Sizda ruxsat yo'q.");
      return;
    }

    const email = text.replace("/reject ", "").trim();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await sendMessage(chatId, `❌ "${email}" topilmadi.`);
      return;
    }

    await prisma.user.update({ where: { email }, data: { status: "rejected" } });
    await sendMessage(chatId, `❌ <b>${[user.surname, user.name].filter(Boolean).join(" ") || email}</b> rad etildi.`);
    return;
  }

  // /profile
  if (text === "/profile") {
    const user = await prisma.user.findFirst({
      where: { telegramId: String(userId) },
      select: { name: true, surname: true, email: true, department: true, status: true, role: true },
    });
    if (!user) {
      await sendMessage(chatId, "⚠️ Siz hali ro'yxatdan o'tmaganmisiz?\n\nSaytdan ro'yxatdan o'ting.");
      return;
    }
    await sendMessage(chatId, [
      `👤 <b>Sizning profilingiz:</b>`,
      ``,
      `Ism: ${[user.surname, user.name].filter(Boolean).join(" ")}`,
      `Email: ${user.email}`,
      `Bo'lim: ${user.department || "belgilanmagan"}`,
      `Lavozim: ${user.role}`,
      `Holat: ${user.status === "active" ? "✅ Faol" : user.status === "pending" ? "⏳ Kutilmoqda" : "❌ Rad etilgan"}`,
    ].join("\n"));
    return;
  }

  // /help
  if (text === "/help") {
    await sendMessage(chatId, [
      `📖 <b>Yordam</b>`,
      ``,
      `/start — Botni qayta ishga tushirish`,
      `/profile — Sizning profilingiz`,
      `/help — Yordam`,
      isAdmin(userId) ? `\n🔒 <b>Admin buyruqlari:</b>\n/stats — Statistika\n/users — Foydalanuvchilar\n/pending — Tasdiqlash kutilayotganlar\n/tests — Testlar` : "",
    ].join("\n"));
    return;
  }

  if (text.startsWith("/")) {
    await sendMessage(chatId, `❓ Noma'lum buyruq: ${text}\n\n/help uchun /help yozing`);
  }
}

async function handleCallbackQuery(cq: any) {
  const chatId = cq.message?.chat?.id;
  const data = cq.data || "";
  const messageId = cq.message?.message_id;
  const userId = cq.from?.id;

  await answerCallbackQuery(cq.id);

  if (!isAdmin(userId)) {
    await sendMessage(chatId, "❌ Sizda ruxsat yo'q.");
    return;
  }

  if (data.startsWith("approve_")) {
    const email = data.replace("approve_", "");
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await editMessageText(chatId, messageId, "❌ Foydalanuvchi topilmadi.");
      return;
    }
    await prisma.user.update({
      where: { email },
      data: { status: "approved", approvedAt: user.approvedAt || new Date() },
    });
    await editMessageText(chatId, messageId, `✅ <b>${[user.surname, user.name].filter(Boolean).join(" ") || email}</b> tasdiqlandi!`);
    return;
  }

  if (data.startsWith("reject_")) {
    const email = data.replace("reject_", "");
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await editMessageText(chatId, messageId, "❌ Foydalanuvchi topilmadi.");
      return;
    }
    await prisma.user.update({ where: { email }, data: { status: "rejected" } });
    await editMessageText(chatId, messageId, `❌ <b>${[user.surname, user.name].filter(Boolean).join(" ") || email}</b> rad etildi.`);
    return;
  }

  if (data.startsWith("profile_")) {
    const email = data.replace("profile_", "");
    const user = await prisma.user.findUnique({
      where: { email },
      select: { name: true, email: true, surname: true, department: true, status: true },
    });
    if (!user) {
      await sendMessage(chatId, "❌ Foydalanuvchi topilmadi.");
      return;
    }
    await sendMessage(chatId, [
      `👤 <b>${[user.surname, user.name].filter(Boolean).join(" ")}</b>`,
      `📧 ${user.email}`,
      `🏢 ${user.department || "belgilanmagan"}`,
      `📊 ${user.status === "active" ? "✅ Faol" : "⏳ Kutilmoqda"}`,
    ].join("\n"));
    return;
  }
}

// ====== Polling ======

async function poll() {
  try {
    const res = await fetch(`${API_BASE}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`);
    const data = await res.json();

    if (data.ok && data.result.length > 0) {
      for (const update of data.result) {
        lastUpdateId = update.update_id;
        try {
          if (update.message) await handleMessage(update.message);
          else if (update.callback_query) await handleCallbackQuery(update.callback_query);
        } catch (err) {
          console.error("Handler xatosi:", err);
        }
      }
    }
  } catch (err) {
    console.error("Polling xatosi:", err);
    await new Promise(r => setTimeout(r, 3000));
  }
  poll();
}

// ====== Ishga tushirish ======

console.log("🤖 Telegram Bot — Polling Mode (DB bilan)");
console.log(`   Bot: @Recrutingakela_bot`);
console.log(`   Admin: ${ADMIN_CHAT_ID}`);
console.log(`   Telegram dan /start yozing...\n`);

poll();
