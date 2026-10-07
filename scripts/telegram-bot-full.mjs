/**
 * Telegram Bot — To'liq versiya (DB ma'lumotlari bilan)
 * Ishga tushirish: node scripts/telegram-bot-full.mjs
 */

const BOT_TOKEN = "8924345505:AAHc3WSg9CzhF_U-Eo5cJCSUo36ZNFVP8qg";
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const ADMIN_ID = "6839364895";
const SITE = "http://localhost:3000"; // Production: https://akela-app.vercel.app
const BOT_SECRET = "akela-bot-secret-2024";

let offset = 0;

// ====== Telegram API ======

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

async function edit(chatId, msgId, text, buttons) {
  const payload = { chat_id: chatId, message_id: msgId, text, parse_mode: "HTML" };
  if (buttons) payload.reply_markup = { inline_keyboard: buttons };
  return api("editMessageText", payload);
}

async function answerCb(id, text) {
  return api("answerCallbackQuery", { callback_query_id: id, text, show_alert: true });
}

// ====== Sayt API ======

async function siteApi(action, params = {}) {
  const url = new URL(`${SITE}/api/telegram-bot`);
  url.searchParams.set("action", action);
  url.searchParams.set("secret", BOT_SECRET);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  const r = await fetch(url.toString());
  return r.json();
}

// ====== Admin tekshirish ======

function isAdmin(userId) {
  return String(userId) === ADMIN_ID;
}

// ====== Xabarlar ======

async function onMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || "";
  const name = msg.from.first_name || "";
  const uid = msg.from.id;

  console.log(`📩 [${name}] ${text}`);

  // /start
  if (text === "/start") {
    if (isAdmin(uid)) {
      const stats = await siteApi("stats");
      const s = stats.ok ? stats.stats : {};
      await send(chatId,
        `Salom, <b>${name}</b>! 👋\n\n` +
        `🎭 Siz <b>AKELA GROUP</b> admin botidasiz.\n\n` +
        `📊 <b>Tezkor ma'lumot:</b>\n` +
        `   👥 Faol: ${s.activeUsers || "?"} | ⏳ Kutilayotgan: ${s.pendingUsers || "?"}\n` +
        `   📝 Testlar: ${s.totalTests || "?"} | 📋 Topshirishlar: ${s.totalResults || "?"}\n\n` +
        `📋 <b>Buyruqlar:</b>\n` +
        `/stats — To'liq statistika\n` +
        `/users — Foydalanuvchilar\n` +
        `/pending — Tasdiqlash kutilayotganlar\n` +
        `/tests — Testlar`,
        [
          [{ text: "📊 Statistika", callback_data: "bot_stats" }],
          [{ text: "👥 Foydalanuvchilar", callback_data: "bot_users" }],
          [{ text: "⏳ Kutilayotganlar", callback_data: "bot_pending" }],
        ]
      );
    } else {
      await send(chatId,
        `Salom, <b>${name}</b>! 👋\n\n` +
        `🎭 Siz <b>AKELA GROUP</b> ta'lim portalisiz.\n\n` +
        `📝 Testlarni saytdan topshiring.\n` +
        `🔗 Sayt: akela-app.vercel.app`
      );
    }
    return;
  }

  // /stats
  if (text === "/stats" || text === "📊 Statistika") {
    if (!isAdmin(uid)) return send(chatId, "❌ Sizda ruxsat yo'q.");
    const stats = await siteApi("stats");
    if (!stats.ok) return send(chatId, "❌ Server xatosi");
    const s = stats.stats;
    await send(chatId,
      `📊 <b>AKELA GROUP — Statistika</b>\n\n` +
      `👥 <b>Foydalanuvchilar:</b>\n` +
      `   Jami: ${s.totalUsers}\n` +
      `   ✅ Faol: ${s.activeUsers}\n` +
      `   ⏳ Kutilayotgan: ${s.pendingUsers}\n` +
      `   ❌ Rad etilgan: ${s.rejectedUsers}\n\n` +
      `📝 <b>Testlar:</b> ${s.totalTests}\n` +
      `📋 <b>Topshirishlar:</b> ${s.totalResults}`
    );
    return;
  }

  // /users
  if (text === "/users" || text === "👥 Foydalanuvchilar") {
    if (!isAdmin(uid)) return send(chatId, "❌ Sizda ruxsat yo'q.");
    const data = await siteApi("users");
    if (!data.ok) return send(chatId, "❌ Server xatosi");

    // Har bir foydalanuvchi uchun tugmalar (holatiga qarab)
    const buttons = data.users.map(u => {
      const name = [u.surname, u.name].filter(Boolean).join(" ") || u.email;
      if (u.status === "active") {
        return [{ text: `🔒 Blokla`, callback_data: `block_${u.email}` }];
      } else if (u.status === "pending") {
        return [
          { text: "❌ Rad etish", callback_data: `reject_${u.email}` },
          { text: "✅ Tasdiqlash", callback_data: `approve_${u.email}` },
        ];
      } else {
        return [{ text: "🔄 Qayta tasdiqlash", callback_data: `approve_${u.email}` }];
      }
    });

    const list = data.users.map((u, i) => {
      const name = [u.surname, u.name].filter(Boolean).join(" ") || u.email;
      const status = u.status === "active" ? "✅ Faol" : u.status === "pending" ? "⏳ Kutilmoqda" : "❌ Rad etilgan";
      return `${i + 1}. <b>${name}</b> — ${status}\n   📧 ${u.email}\n   🏢 ${u.department || "?"}`;
    }).join("\n\n");

    await send(chatId,
      `👥 <b>Foydalanuvchilar (oxirgi 10):</b>\n\n${list || "Yo'q"}`,
      buttons
    );
    return;
  }

  // /pending
  if (text === "/pending" || text === "⏳ Kutilayotganlar") {
    if (!isAdmin(uid)) return send(chatId, "❌ Sizda ruxsat yo'q.");
    const data = await siteApi("pending");
    if (!data.ok) return send(chatId, "❌ Server xatosi");
    if (data.pending.length === 0) return send(chatId, "✅ Kutilayotgan foydalanuvchi yo'q!");

    const buttons = data.pending.map(u => [
      { text: `❌ Rad etish`, callback_data: `reject_${u.email}` },
      { text: `✅ Tasdiqlash`, callback_data: `approve_${u.email}` },
    ]);

    const list = data.pending.map((u, i) =>
      `${i + 1}. <b>${[u.surname, u.name].filter(Boolean).join(" ") || u.email}</b>\n   📧 ${u.email}\n   🏢 ${u.department || "?"}`
    ).join("\n\n");

    await send(chatId,
      `⏳ <b>Tasdiqlash kutilayotganlar (${data.pending.length}):</b>\n\n${list}`,
      buttons
    );
    return;
  }

  // /tests
  if (text === "/tests") {
    if (!isAdmin(uid)) return send(chatId, "❌ Sizda ruxsat yo'q.");
    const data = await siteApi("tests");
    if (!data.ok) return send(chatId, "❌ Server xatosi");
    const list = data.tests.map((t, i) =>
      `${i + 1}. <b>${t.title}</b> — ${t.status === "active" ? "✅" : "📝"} (${t._count.questions} savol, ${t._count.results} topshirish)`
    ).join("\n");
    await send(chatId, `📝 <b>Testlar (oxirgi 5):</b>\n\n${list || "Yo'q"}`);
    return;
  }

  // /approve email
  if (text.startsWith("/approve ")) {
    if (!isAdmin(uid)) return send(chatId, "❌ Sizda ruxsat yo'q.");
    const email = text.replace("/approve ", "").trim();
    const r = await siteApi("approve", { email });
    await send(chatId, r.ok ? `✅ ${r.message}` : `❌ ${r.error}`);
    return;
  }

  // /reject email
  if (text.startsWith("/reject ")) {
    if (!isAdmin(uid)) return send(chatId, "❌ Sizda ruxsat yo'q.");
    const email = text.replace("/reject ", "").trim();
    const r = await siteApi("reject", { email });
    await send(chatId, r.ok ? `❌ ${r.message}` : `❌ ${r.error}`);
    return;
  }

  // /help
  if (text === "/help") {
    await send(chatId,
      `📖 <b>Yordam</b>\n\n` +
      `/start — Botni qayta ishga tushirish\n` +
      `/stats — Statistika\n` +
      `/users — Foydalanuvchilar\n` +
      `/pending — Tasdiqlash kutilayotganlar\n` +
      `/tests — Testlar\n` +
      `/help — Yordam`
    );
    return;
  }
}

// ====== Callback query (tugmalar) ======

async function onCallback(cq) {
  const chatId = cq.message?.chat?.id;
  const data = cq.data || "";
  const msgId = cq.message?.message_id;
  const uid = cq.from?.id;

  if (!isAdmin(uid)) {
    await answerCb(cq.id, "Sizda ruxsat yo'q");
    await send(chatId, "❌ Sizda ruxsat yo'q.");
    return;
  }

  // Stats tugmasi
  if (data === "bot_stats") {
    await answerCb(cq.id, "Statistika yuklanmoqda...");
    const stats = await siteApi("stats");
    if (stats.ok) {
      const s = stats.stats;
      await edit(chatId, msgId,
        `📊 <b>AKELA GROUP — Statistika</b>\n\n` +
        `👥 <b>Foydalanuvchilar:</b>\n` +
        `   Jami: ${s.totalUsers}\n` +
        `   ✅ Faol: ${s.activeUsers}\n` +
        `   ⏳ Kutilayotgan: ${s.pendingUsers}\n` +
        `   ❌ Rad etilgan: ${s.rejectedUsers}\n\n` +
        `📝 <b>Testlar:</b> ${s.totalTests}\n` +
        `📋 <b>Topshirishlar:</b> ${s.totalResults}`,
        [[{ text: "🔄 Yangilash", callback_data: "bot_stats" }]]
      );
    }
    return;
  }

  // Users tugmasi
  if (data === "bot_users") {
    await answerCb(cq.id, "Foydalanuvchilar yuklanmoqda...");
    const d = await siteApi("users");
    if (d.ok) {
      const buttons = d.users.map(u => {
        if (u.status === "active") {
          return [{ text: `🔒 Blokla`, callback_data: `block_${u.email}` }];
        } else if (u.status === "pending") {
          return [
            { text: "❌ Rad etish", callback_data: `reject_${u.email}` },
            { text: "✅ Tasdiqlash", callback_data: `approve_${u.email}` },
          ];
        } else {
          return [{ text: "🔄 Qayta tasdiqlash", callback_data: `approve_${u.email}` }];
        }
      });
      const list = d.users.map((u, i) => {
        const name = [u.surname, u.name].filter(Boolean).join(" ") || u.email;
        const status = u.status === "active" ? "✅ Faol" : u.status === "pending" ? "⏳ Kutilmoqda" : "❌ Rad etilgan";
        return `${i + 1}. <b>${name}</b> — ${status}\n   📧 ${u.email}\n   🏢 ${u.department || "?"}`;
      }).join("\n\n");
      await edit(chatId, msgId,
        `👥 <b>Foydalanuvchilar (oxirgi 10):</b>\n\n${list || "Yo'q"}`,
        [...buttons, [{ text: "🔄 Yangilash", callback_data: "bot_users" }]]
      );
    }
    return;
  }

  // Pending tugmasi
  if (data === "bot_pending") {
    await answerCb(cq.id, "Kutilayotganlar yuklanmoqda...");
    const d = await siteApi("pending");
    if (d.ok) {
      if (d.pending.length === 0) {
        await edit(chatId, msgId, "✅ Kutilayotgan foydalanuvchi yo'q!");
        return;
      }
      const buttons = d.pending.map(u => [
        { text: `❌ Rad etish`, callback_data: `reject_${u.email}` },
        { text: `✅ Tasdiqlash`, callback_data: `approve_${u.email}` },
      ]);
      const list = d.pending.map((u, i) =>
        `${i + 1}. <b>${[u.surname, u.name].filter(Boolean).join(" ") || u.email}</b>\n   📧 ${u.email}\n   🏢 ${u.department || "?"}`
      ).join("\n\n");
      await edit(chatId, msgId,
        `⏳ <b>Tasdiqlash kutilayotganlar (${d.pending.length}):</b>\n\n${list}`,
        buttons
      );
    }
    return;
  }

  // Tasdiqlash tugmasi
  if (data.startsWith("approve_")) {
    const email = data.replace("approve_", "");
    await answerCb(cq.id, `${email} tasdiqlanmoqda...`);
    const r = await siteApi("approve", { email });
    if (r.ok) {
      await edit(chatId, msgId,
        `✅ <b>${email}</b> tasdiqlandi!\n\n🆕 Foydalanuvchi faollashtirildi.`,
        [[{ text: "📋 Ro'yxat", callback_data: "bot_pending" }]]
      );
    } else {
      await edit(chatId, msgId, `❌ Xato: ${r.error}`);
    }
    return;
  }

  // Rad etish tugmasi
  if (data.startsWith("reject_")) {
    const email = data.replace("reject_", "");
    await answerCb(cq.id, `${email} rad etilmoqda...`);
    const r = await siteApi("reject", { email });
    if (r.ok) {
      await edit(chatId, msgId,
        `❌ <b>${email}</b> rad etildi.\n\n🚫 Foydalanuvchi rad etildi.`,
        [[{ text: "📋 Ro'yxat", callback_data: "bot_users" }]]
      );
    } else {
      await edit(chatId, msgId, `❌ Xato: ${r.error}`);
    }
    return;
  }

  // Blokla tugmasi
  if (data.startsWith("block_")) {
    const email = data.replace("block_", "");
    await answerCb(cq.id, `${email} bloklanmoqda...`);
    const r = await siteApi("block", { email });
    if (r.ok) {
      await edit(chatId, msgId,
        `🔒 <b>${email}</b> bloklandi.\n\n🚫 Foydalanuvchi bloklandi.`,
        [
          [{ text: "🔄 Blokdan chiqar", callback_data: `unblock_${email}` }],
          [{ text: "📋 Ro'yxat", callback_data: "bot_users" }],
        ]
      );
    } else {
      await edit(chatId, msgId, `❌ Xato: ${r.error}`);
    }
    return;
  }

  // Blokdan chiqarish tugmasi
  if (data.startsWith("unblock_")) {
    const email = data.replace("unblock_", "");
    await answerCb(cq.id, `${email} blokdan chiqarilmoqda...`);
    const r = await siteApi("unblock", { email });
    if (r.ok) {
      await edit(chatId, msgId,
        `✅ <b>${email}</b> blokdan chiqarildi.\n\n🆕 Foydalanuvchi faollashtirildi.`,
        [[{ text: "📋 Ro'yxat", callback_data: "bot_users" }]]
      );
    } else {
      await edit(chatId, msgId, `❌ Xato: ${r.error}`);
    }
    return;
  }
}

// ====== Yangi foydalanuvchi xabari ======

export async function notifyNewUser(user) {
  const name = [user.surname, user.name].filter(Boolean).join(" ") || user.email;
  const text =
    `🆕 <b>Yangi foydalanuvchi!</b>\n\n` +
    `👤 <b>Ism:</b> ${name}\n` +
    `📧 <b>Email:</b> ${user.email}\n` +
    `🏢 <b>Bo'lim:</b> ${user.department || "belgilanmagan"}\n\n` +
    `⏳ <b>Holat:</b> Tasdiqlash kutilmoqda`;

  const buttons = [
    [
      { text: "❌ Rad etish", callback_data: `reject_${user.email}` },
      { text: "✅ Tasdiqlash", callback_data: `approve_${user.email}` },
    ],
  ];

  await send(ADMIN_ID, text, buttons);
}

// ====== Polling ======

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

// ====== Ishga tushirish ======

console.log("🤖 Telegram Bot — Full Mode");
console.log(`   Admin: ${ADMIN_ID}`);
console.log(`   Sayt: ${SITE}`);
console.log(`   /start yozing...\n`);
poll();
