const BOT = "8924345505:AAHc3WSg9CzhF_U-Eo5cJCSUo36ZNFVP8qg";
const API = `https://api.telegram.org/bot${BOT}`;
const ADMIN = "6839364895";
const SITE = "http://localhost:3000";
const SECRET = "akela-bot-secret-2024";

let offset = 0;

async function send(chatId, text, buttons) {
  const body = { chat_id: chatId, text, parse_mode: "HTML" };
  if (buttons) body.reply_markup = { inline_keyboard: buttons };
  const r = await fetch(`${API}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

async function edit(chatId, msgId, text, buttons) {
  const body = { chat_id: chatId, message_id: msgId, text, parse_mode: "HTML" };
  if (buttons) body.reply_markup = { inline_keyboard: buttons };
  const r = await fetch(`${API}/editMessageText`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

async function answer(id) {
  await fetch(`${API}/answerCallbackQuery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callback_query_id: id, show_alert: true }) });
}

async function api(action, params = {}) {
  const url = new URL(`${SITE}/api/telegram-bot`);
  url.searchParams.set("action", action);
  url.searchParams.set("secret", SECRET);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const r = await fetch(url.toString());
  return r.json();
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || "";
  const name = msg.from.first_name || "";
  const uid = String(msg.from.id);
  const isAdmin = uid === ADMIN;

  console.log(`[${name}] ${text}`);

  if (text === "/start") {
    if (isAdmin) {
      const s = await api("stats");
      const st = s.ok ? s.stats : {};
      await send(chatId,
        `Salom, ${name}! 👋\n\n` +
        `🎭 AKELA GROUP admin bot\n\n` +
        `📊 Faol: ${st.activeUsers||0} | Kutilayotgan: ${st.pendingUsers||0}\n` +
        `📝 Testlar: ${st.totalTests||0} | Topshirishlar: ${st.totalResults||0}\n\n` +
        `Buyruqlar:\n` +
        `/stats — Statistika\n` +
        `/users — Foydalanuvchilar\n` +
        `/pending — Tasdiqlash kutilayotganlar`,
        [
          [{ text: "📊 Statistika", callback_data: "b_stats" }],
          [{ text: "👥 Foydalanuvchilar", callback_data: "b_users" }],
          [{ text: "⏳ Kutilayotganlar", callback_data: "b_pending" }],
        ]
      );
    } else {
      await send(chatId, `Salom, ${name}! 👋\n\nAKELA GROUP ta'lim portali.\nTestlarni saytdan topshiring.`);
    }
    return;
  }

  if (text === "/stats" && isAdmin) {
    const s = await api("stats");
    if (!s.ok) return send(chatId, "Xato!");
    const st = s.stats;
    await send(chatId,
      `📊 Statistika\n\n` +
      `👥 Jami: ${st.totalUsers}\n` +
      `✅ Faol: ${st.activeUsers}\n` +
      `⏳ Kutilayotgan: ${st.pendingUsers}\n` +
      `❌ Rad etilgan: ${st.rejectedUsers}\n\n` +
      `📝 Testlar: ${st.totalTests}\n` +
      `📋 Topshirishlar: ${st.totalResults}`
    );
    return;
  }

  if (text === "/users" && isAdmin) {
    const d = await api("users");
    if (!d.ok) return send(chatId, "Xato!");
    const buttons = d.users.map(u => {
      if (u.status === "active") return [{ text: "🔒 Blokla", callback_data: `b_block_${u.email}` }];
      if (u.status === "pending") return [{ text: "❌ Rad", callback_data: `b_reject_${u.email}` }, { text: "✅ Tasdiqlash", callback_data: `b_approve_${u.email}` }];
      return [{ text: "🔄 Qayta", callback_data: `b_approve_${u.email}` }];
    });
    const list = d.users.map((u, i) => {
      const n = [u.surname, u.name].filter(Boolean).join(" ") || u.email;
      const s = u.status === "active" ? "✅" : u.status === "pending" ? "⏳" : "❌";
      return `${i+1}. ${s} ${n}\n   ${u.email}`;
    }).join("\n");
    await send(chatId, `👥 Foydalanuvchilar:\n\n${list}`, buttons);
    return;
  }

  if (text === "/pending" && isAdmin) {
    const d = await api("pending");
    if (!d.ok) return send(chatId, "Xato!");
    if (!d.pending.length) return send(chatId, "✅ Kutilayotgan yo'q!");
    const buttons = d.pending.map(u => [
      { text: "❌ Rad etish", callback_data: `b_reject_${u.email}` },
      { text: "✅ Tasdiqlash", callback_data: `b_approve_${u.email}` },
    ]);
    const list = d.pending.map((u, i) => `${i+1}. ${u.name||u.email}\n   ${u.email}\n   ${u.department||"?"}`).join("\n\n");
    await send(chatId, `⏳ Tasdiqlash kutilayotganlar (${d.pending.length}):\n\n${list}`, buttons);
    return;
  }
}

async function handleCb(cq) {
  const chatId = cq.message?.chat?.id;
  const msgId = cq.message?.message_id;
  const data = cq.data || "";
  const uid = String(cq.from?.id);
  await answer(cq.id);

  if (uid !== ADMIN) return send(chatId, "❌ Ruxsat yo'q");

  if (data === "b_stats") {
    const s = await api("stats");
    if (s.ok) {
      const st = s.stats;
      await edit(chatId, msgId,
        `📊 Statistika\n\n👥 Jami: ${st.totalUsers} | ✅ Faol: ${st.activeUsers}\n⏳ Kutilayotgan: ${st.pendingUsers} | ❌ Rad: ${st.rejectedUsers}\n📝 Testlar: ${st.totalTests} | 📋 Topshirishlar: ${st.totalResults}`,
        [[{ text: "🔄 Yangilash", callback_data: "b_stats" }]]
      );
    }
    return;
  }

  if (data === "b_users") {
    const d = await api("users");
    if (d.ok) {
      const buttons = d.users.map(u => {
        if (u.status === "active") return [{ text: "🔒 Blokla", callback_data: `b_block_${u.email}` }];
        if (u.status === "pending") return [{ text: "❌ Rad", callback_data: `b_reject_${u.email}` }, { text: "✅ Tasdiqlash", callback_data: `b_approve_${u.email}` }];
        return [{ text: "🔄 Qayta", callback_data: `b_approve_${u.email}` }];
      });
      const list = d.users.map((u, i) => {
        const n = [u.surname, u.name].filter(Boolean).join(" ") || u.email;
        const s = u.status === "active" ? "✅" : u.status === "pending" ? "⏳" : "❌";
        return `${i+1}. ${s} ${n}\n   ${u.email}`;
      }).join("\n");
      await edit(chatId, msgId, `👥 Foydalanuvchilar:\n\n${list}`, [...buttons, [{ text: "🔄 Yangilash", callback_data: "b_users" }]]);
    }
    return;
  }

  if (data === "b_pending") {
    const d = await api("pending");
    if (d.ok) {
      if (!d.pending.length) return edit(chatId, msgId, "✅ Kutilayotgan yo'q!");
      const buttons = d.pending.map(u => [
        { text: "❌ Rad etish", callback_data: `b_reject_${u.email}` },
        { text: "✅ Tasdiqlash", callback_data: `b_approve_${u.email}` },
      ]);
      const list = d.pending.map((u, i) => `${i+1}. ${u.name||u.email}\n   ${u.email}`).join("\n\n");
      await edit(chatId, msgId, `⏳ Kutilayotganlar (${d.pending.length}):\n\n${list}`, buttons);
    }
    return;
  }

  if (data.startsWith("b_approve_")) {
    const email = data.replace("b_approve_", "");
    const r = await api("approve", { email });
    await edit(chatId, msgId, r.ok ? `✅ ${email} tasdiqlandi!` : `❌ Xato: ${r.error}`, [[{ text: "📋 Ro'yxat", callback_data: "b_users" }]]);
    return;
  }

  if (data.startsWith("b_reject_")) {
    const email = data.replace("b_reject_", "");
    const r = await api("reject", { email });
    await edit(chatId, msgId, r.ok ? `❌ ${email} rad etildi.` : `❌ Xato: ${r.error}`, [[{ text: "📋 Ro'yxat", callback_data: "b_users" }]]);
    return;
  }

  if (data.startsWith("b_block_")) {
    const email = data.replace("b_block_", "");
    const r = await api("block", { email });
    await edit(chatId, msgId, r.ok ? `🔒 ${email} bloklandi.` : `❌ Xato: ${r.error}`, [
      [{ text: "🔄 Blokdan chiqar", callback_data: `b_unblock_${email}` }],
      [{ text: "📋 Ro'yxat", callback_data: "b_users" }],
    ]);
    return;
  }

  if (data.startsWith("b_unblock_")) {
    const email = data.replace("b_unblock_", "");
    const r = await api("unblock", { email });
    await edit(chatId, msgId, r.ok ? `✅ ${email} blokdan chiqarildi.` : `❌ Xato: ${r.error}`, [[{ text: "📋 Ro'yxat", callback_data: "b_users" }]]);
    return;
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
          if (u.message) await handleMessage(u.message);
          else if (u.callback_query) await handleCb(u.callback_query);
        } catch (e) { console.error("Xato:", e.message); }
      }
    }
  } catch (e) {
    console.error("Poll xatosi:", e.message);
    await new Promise(r => setTimeout(r, 3000));
  }
  poll();
}

console.log("Bot ishlayapti... Telegram dan /start yozing");
poll();
