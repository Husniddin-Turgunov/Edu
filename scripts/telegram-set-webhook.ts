/**
 * scripts/telegram-set-webhook.ts — Telegram webhook'ni maxfiy token bilan
 * qayta ro'yxatdan o'tkazadi.
 *
 *   npx tsx --env-file=.env scripts/telegram-set-webhook.ts <webhook-url>
 *
 * Nima uchun shart: `POST /api/telegram` endi `X-Telegram-Bot-Api-Secret-Token`
 * sarlavhasini MAJBURIY tekshiradi. Telegram bu sarlavhani faqat `setWebhook`
 * da `secret_token` berilganda yuboradi — aks holda haqiqiy xabarlar ham
 * rad etiladi (bot o'chadi).
 */
import { setWebhook, getWebhookInfo } from "@/lib/telegram-bot";

async function main() {
  const url = process.argv[2] || "https://edu.akelagroup.uz/api/telegram";
  const secret = process.env.TELEGRAM_BOT_WEBHOOK_SECRET || "";
  console.log(`  secret_token bormi: ${secret ? "ha (" + secret.length + " belgi)" : "YO'Q — xavfsizlik tekshiruvi o'chadi!"}`);

  const res: any = await setWebhook(url);
  console.log(`  setWebhook ok=${res?.ok} ${res?.ok ? "" : JSON.stringify(res)}`);

  const info: any = await getWebhookInfo();
  console.log(`  url = ${info?.result?.url}`);
  console.log(`  allowed_updates = ${JSON.stringify(info?.result?.allowed_updates)}`);
  console.log(`  pending_update_count = ${info?.result?.pending_update_count}`);
  console.log(`  last_error_message = ${info?.result?.last_error_message || "(yo'q)"}`);
  process.exit(res?.ok ? 0 : 1);
}
main();