// Sinov: haqiqiy admin chatga xabar yuborish (delivery tekshiruvi)
const token = process.env.TELEGRAM_BOT_TOKEN || "8924345505:AAHc3WSg9CzhF_U-Eo5cJCSUo36ZNFVP8qg";
const adminChat = process.env.TELEGRAM_ADMIN_CHAT_ID || "";

async function send(chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  const j = await res.json().catch(() => ({ ok: false }));
  return j;
}

async function main() {
  console.log("ADMIN_CHAT_ID:", adminChat || "(bo'sh)");
  if (adminChat) {
    const r = await send(adminChat, "🔧 <b>AKELA bot tekshiruvi</b> — bu xabar test rejimida yuborildi.");
    console.log("admin chatga yuborish:", JSON.stringify(r));
  }
  // Bazadagi barcha obunachilarga sinov broadcast
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const subs = await prisma.botSubscriber.findMany({ select: { chatId: true, name: true, isActive: true } });
  console.log("obunachilar:", JSON.stringify(subs));
  for (const s of subs.filter((x) => x.isActive)) {
    const r = await send(s.chatId, "🧪 Broadcast sinovi — javob bormi?");
    console.log(`  -> ${s.name} (${s.chatId}): ok=${r.ok}${r.description ? " " + r.description : ""}`);
  }
  await prisma.$disconnect();
}
main().catch((e) => console.error("ERR:", e.message));
