/**
 * scripts/telegram-check.ts вЂ” Telegram bot diagnostikasi.
 *
 *   npx tsx --env-file=.env scripts/telegram-check.ts
 *
 * Tekshiriladi:
 *  1) getMe / getWebhookInfo вЂ” token va webhook holati
 *  2) BotSubscriber вЂ” obunachilar bormi
 *  3) public/icons/glass/*.png вЂ” Liquid Glass ikonkalar joyida-mi
 *  4) APP_ORIGIN вЂ” sayt havolasi qayeridan olinadi
 *  5) Test xabar вЂ” faqat TELEGRAM_ADMIN_CHAT_ID ga (barchaga emas!)
 */

import { getMe, getWebhookInfo, sendMessage, getSubscriberIds, subscriberCount } from "@/lib/telegram-bot";
import { db } from "@/lib/db";
import { existsSync } from "node:fs";
import path from "node:path";

function line(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  line("1) Bot va webhook");
  const me: any = await getMe();
  console.log(`  getMe ok=${me?.ok} @${me?.result?.username} (${me?.result?.first_name})`);
  const wh: any = await getWebhookInfo();
  console.log(`  webhook url = ${wh?.result?.url || "(yo'q)"}`);
  console.log(`  pending_update_count = ${wh?.result?.pending_update_count}`);
  console.log(`  last_error_message = ${wh?.result?.last_error_message || "(yo'q)"}`);
  console.log(`  allowed_updates = ${JSON.stringify(wh?.result?.allowed_updates)}`);

  line("2) Obunachilar (BotSubscriber)");
  const total = await db.botSubscriber.count();
  const active = await subscriberCount();
  const ids = await getSubscriberIds();
  console.log(`  jami yozuvlar: ${total}, faol: ${active}, yuborish uchun ID: ${ids.length}`);
  const rows = await db.botSubscriber.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { chatId: true, name: true, isActive: true },
  });
  for (const r of rows) console.log(`   - ${r.chatId} ${r.name || "(nom yo'q)"} faol=${r.isActive}`);
  const adminChat = process.env.TELEGRAM_ADMIN_CHAT_ID;
  console.log(`  TELEGRAM_ADMIN_CHAT_ID = ${adminChat || "(yo'q)"}`);

  line("3) Liquid Glass ikonkalari (public/icons/glass)");
  const dir = path.join(process.cwd(), "public", "icons", "glass");
  console.log(`  papka: ${dir} mavjud=${existsSync(dir)}`);
  const names = ["apps", "monitoring", "group", "pending_actions", "fact_check", "checklist", "info", "refresh"];
  for (const n of names) {
    const p = path.join(dir, `${n}.png`);
    console.log(`   - ${n}.png ${existsSync(p) ? "OK" : "YO'Q"}`);
  }

  line("4) APP_ORIGIN");
  const origin = (process.env.NEXT_PUBLIC_APP_URL || "https://edu.akelagroup.uz").replace(/\/$/, "");
  console.log(`  origin = ${origin}`);
  try {
    const res = await fetch(`${origin}/icons/glass/apps.png`, { method: "HEAD" });
    console.log(`  ikonka HEAD = ${res.status} ${res.headers.get("content-type") || ""}`);
  } catch (e: any) {
    console.log(`  ikonka HEAD xato: ${e?.message || e}`);
  }
  try {
    const res = await fetch(`${origin}/api/telegram`, { method: "GET" });
    console.log(`  webhook endpoint GET = ${res.status}`);
  } catch (e: any) {
    console.log(`  webhook endpoint xato: ${e?.message || e}`);
  }

  line("5) Test xabar (faqat admin chat ID ga)");
  if (!adminChat || adminChat === "0") {
    console.log("  TELEGRAM_ADMIN_CHAT_ID yo'q вЂ” test yuborilmadi.");
  } else {
    const chatId = Number(adminChat);
    const sent: any = await sendMessage(
      chatId,
      "AKELA bot diagnostikasi: <b>test xabar</b>.\nSana: " + new Date().toISOString().slice(0, 16).replace("T", " "),
    );
    console.log(`  yuborildi = ${sent?.ok} ${sent?.ok ? "" : JSON.stringify(sent)}`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error("Diagnostika xatosi:", e?.message || e);
  process.exit(1);
});
