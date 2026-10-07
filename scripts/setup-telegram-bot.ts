/**
 * Telegram Bot Webhook sozlash skripti
 * Ishga tushirish: npx tsx scripts/setup-telegram-bot.ts
 */

const BOT_TOKEN = "8924345505:AAHc3WSg9CzhF_U-Eo5cJCSUo36ZNFVP8qg";
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function setup() {
  console.log("🤖 Telegram Bot sozlanmoqda...\n");

  // 1. Bot haqida ma'lumot
  console.log("1️⃣ Bot tekshirilmoqda...");
  const meRes = await fetch(`${API_BASE}/getMe`);
  const me = await meRes.json();
  if (!me.ok) {
    console.error("❌ Bot tokeni noto'g'ri!");
    return;
  }
  console.log(`✅ Bot: @${me.result.username} (${me.result.first_name})`);
  console.log(`   ID: ${me.result.id}\n`);

  // 2. Webhook sozlash
  const host = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const webhookUrl = `${host}/api/telegram`;
  console.log(`2️⃣ Webhook sozlanmoqda: ${webhookUrl}`);

  const hookRes = await fetch(`${API_BASE}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message", "callback_query"],
    }),
  });
  const hook = await hookRes.json();
  console.log(hook.ok ? "✅ Webhook o'rnatildi!" : `❌ Xato: ${JSON.stringify(hook)}\n`);

  // 3. Bot buyruqlari
  console.log("3️⃣ Bot buyruqlari o'rnatilmoqda...");
  const commandsRes = await fetch(`${API_BASE}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commands: [
        { command: "start", description: "Boshlash" },
        { command: "help", description: "Yordam" },
        { command: "stats", description: "Statistika" },
        { command: "users", description: "Foydalanuvchilar" },
        { command: "pending", description: "Kutilayotgan tasdiqlar" },
        { command: "tests", description: "Testlar" },
        { command: "approve", description: "Foydalanuvchini tasdiqlash" },
        { command: "reject", description: "Foydalanuvchini rad etish" },
      ],
    }),
  });
  const cmds = await commandsRes.json();
  console.log(cmds.ok ? "✅ Buyruqlar o'rnatildi!" : `❌ Xato: ${JSON.stringify(cmds)}\n`);

  console.log("🎉 Bot tayyor! Telegram dan /start yozing.");
}

setup().catch(console.error);
