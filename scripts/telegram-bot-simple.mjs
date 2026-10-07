/**
 * Telegram Bot — Oddiy Polling (DB'siz, faqat test)
 * Ishga tushirish: node scripts/telegram-bot-simple.mjs
 */

const BOT_TOKEN = "8924345505:AAHc3WSg9CzhF_U-Eo5cJCSUo36ZNFVP8qg";
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const ADMIN_ID = "6839364895";

let offset = 0;

async function api(method, body) {
  const r = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

async function send(chatId, text, buttons) {
  const payload = { chat_id: chatId, text, parse_mode: "HTML" };
  if (buttons) payload.reply_markup = { inline_keyboard: buttons };
  return api("sendMessage", payload);
}

async function edit(chatId, msgId, text) {
  return api("editMessageText", { chat_id: chatId, message_id: msgId, text, parse_mode: "HTML" });
}

async function answerCb(id) {
  return api("answerCallbackQuery", { callback_query_id: id, show_alert: true });
}

function isAdmin(userId) {
  return String(userId) === ADMIN_ID;
}

async function onMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || "";
  const name = msg.from.first_name || "";
  const uid = msg.from.id;

  console.log(`📩 [${name} (${uid})] ${text}`);

  if (text === "/start") {
    if (isAdmin(uid)) {
      await send(chatId, 
        `Salom, <b>${name}</b>! 👋\n\n` +
        `🎭 Siz <b>AKELA GROUP</b> admin botidasiz.\n\n` +
        `📋 Buyruqlar:\n` +
        `/stats — Statistika\n` +
        `/users — Foydalanuvchilar\n` +
        `/pending — Tasdiqlash kutilayotganlar\n` +
        `/approve email — Tasdiqlash\n` +
        `/reject email — Rad etish`
      );
    } else {
      await send(chatId,
        `Salom, <b>${name}</b>! 👋\n\n` +
        `🎭 Siz <b>AKELA GROUP</b> ta'lim portalisiz.\n\n` +
        `📝 Testlarni saytdan topshiring.`
      );
    }
    return;
  }

  if (text === "/stats" && isAdmin(uid)) {
    await send(chatId, `📊 <b>Statistika</b>\n\n⏳ API server orqali olish kerak.\n\nSaytda ko'ring: /admin`);
    return;
  }

  if (text === "/users" && isAdmin(uid)) {
    await send(chatId, `👥 <b>Foydalanuvchilar</b>\n\nAPI server orqali olish kerak.`);
    return;
  }

  if (text === "/pending" && isAdmin(uid)) {
    await send(chatId, `⏳ <b>Kutilayotganlar</b>\n\nAPI server orqali olish kerak.`);
    return;
  }

  if (text.startsWith("/approve ") && isAdmin(uid)) {
    const email = text.replace("/approve ", "").trim();
    await send(chatId, `✅ <b>${email}</b> tasdiqlanmoqda...\n\nAPI server orqali.`);
    return;
  }

  if (text.startsWith("/reject ") && isAdmin(uid)) {
    const email = text.replace("/reject ", "").trim();
    await send(chatId, `❌ <b>${email}</b> rad etilmoqda...\n\nAPI server orqali.`);
    return;
  }

  if (text === "/help") {
    await send(chatId, `📖 <b>Yordam</b>\n\n/start — Boshlash\n/help — Yordam`);
    return;
  }
}

async function onCallback(cq) {
  const chatId = cq.message?.chat?.id;
  const data = cq.data || "";
  const msgId = cq.message?.message_id;
  const uid = cq.from?.id;

  await answerCb(cq.id);

  if (!isAdmin(uid)) {
    await send(chatId, "❌ Sizda ruxsat yo'q.");
    return;
  }

  if (data.startsWith("approve_")) {
    const email = data.replace("approve_", "");
    await edit(chatId, msgId, `✅ <b>${email}</b> tasdiqlandi!\n\nAPI server orqali.`);
  }

  if (data.startsWith("reject_")) {
    const email = data.replace("reject_", "");
    await edit(chatId, msgId, `❌ <b>${email}</b> rad etildi.\n\nAPI server orqali.`);
  }
}

async function poll() {
  try {
    const r = await fetch(`${API}/getUpdates?offset=${offset + 1}&timeout=30`);
    const d = await r.json();
    if (d.ok && d.result.length > 0) {
      for (const u of d.result) {
        offset = u.update_id;
        try {
          if (u.message) await onMessage(u.message);
          else if (u.callback_query) await onCallback(u.callback_query);
        } catch (e) {
          console.error("Xato:", e.message);
        }
      }
    }
  } catch (e) {
    console.error("Poll xatosi:", e.message);
    await new Promise(r => setTimeout(r, 3000));
  }
  poll();
}

console.log("🤖 Telegram Bot — Simple Mode");
console.log(`   Admin: ${ADMIN_ID}`);
console.log(`   /start yozing...\n`);
poll();
