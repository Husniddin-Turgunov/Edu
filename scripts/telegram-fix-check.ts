/**
 * scripts/telegram-fix-check.ts — Telegram bot tuzatilgan yo'llarini tekshiradi.
 *
 *   npx tsx --env-file=.env scripts/telegram-fix-check.ts
 *
 * Tekshiriladi:
 *  1) verifyWebhookSecret — sekretsiz so'rov RAD etiladi, to'g'ri sarlavha bilan
 *     qabul qilinadi (hozir TELEGRAM_BOT_WEBHOOK_SECRET .env da bor)
 *  2) shouldUnsubscribe — "message is too long" obunachini O'CHIRMASLIGI kerak
 *     (eski kod shu sababli butun ro'yxatni yo'q qilardi)
 *  3) Uzun matn kesiladi (4096/1024 chegaralari) — "message is too long" kelmaydi
 *  4) Soxta update approve tugmasi bilan — 401 (chindan Telegram emas)
 */

import { shouldUnsubscribe, verifyWebhookSecret, cleanBody } from "@/lib/telegram-bot";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  OK   ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const secret = process.env.TELEGRAM_BOT_WEBHOOK_SECRET || "";
  console.log("\n=== 1) Webhook secret tekshiruvi ===");
  console.log(`  TELEGRAM_BOT_WEBHOOK_SECRET bormi: ${secret ? "ha (" + secret.length + " belgi)" : "yo'q"}`);
  check("to'g'ri sarlavha qabul qilinadi", verifyWebhookSecret(secret).ok === true);
  check("boshqa sarlavha rad etiladi", verifyWebhookSecret("nomi-noto'g'ri").ok === false);
  check("bo'sh sarlavha rad etiladi", verifyWebhookSecret(null).ok === false);

  console.log("\n=== 2) Obunachini o'chirish qoidasi (eski xato) ===");
  const cases: [string, boolean, any][] = [
    ["403 bot bloklandi", true, { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" }],
    ["400 chat not found", true, { ok: false, error_code: 400, description: "Bad Request: chat not found" }],
    ["400 bot can't initiate", true, { ok: false, error_code: 400, description: "Bad Request: bot can't initiate conversation with a user" }],
    ["400 message is too long", false, { ok: false, error_code: 400, description: "Bad Request: message is too long" }],
    ["400 can't parse entities", false, { ok: false, error_code: 400, description: "Bad Request: can't parse entities" }],
    ["400 photo_url_invalid", false, { ok: false, error_code: 400, description: "Bad Request: failed to get HTTP URL content" }],
    ["429 too many requests", false, { ok: false, error_code: 429, description: "Too Many Requests: retry after 5" }],
    ["muvaffaqiyatli", false, { ok: true }],
  ];
  for (const [name, expected, res] of cases) {
    check(`${name} → o'chirish=${expected}`, shouldUnsubscribe(res) === expected);
  }

  console.log("\n=== 3) Matn kesilishi ===");
  const long = "x".repeat(9000);
  const clipped = cleanBody(long).length;
  check("cleanBody katta matnni kesmaydi (kesish sendMessage da)", clipped === 9000, `${clipped}`);
  const emoji = cleanBody("📊 Statistika\n✅ O'tdi");
  check("emoji tozalash (✅ saqlanadi, 📊 olib tashlanadi)", emoji.includes("✅") && !emoji.startsWith("📊"), JSON.stringify(emoji));

  console.log("\n=== 4) Soxta update ===");
  const forged = await fetch(`${BASE}/api/telegram`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      update_id: 1,
      callback_query: {
        id: "1",
        from: { id: 1, is_bot: false, first_name: "Hacker" },
        chat_instance: "x",
        data: "approve:YOQ_USER_ID",
        message: { message_id: 1, date: 0, chat: { id: 1, type: "private" }, text: "x" },
      },
    }),
  });
  check("sekretsiz approve → 401 (rad etildi)", forged.status === 401, `status ${forged.status}`);

  const proper = await fetch(`${BASE}/api/telegram`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": secret },
    body: JSON.stringify({
      update_id: 2,
      message: {
        message_id: 2,
        date: Math.floor(Date.now() / 1000),
        from: { id: 1, is_bot: false, first_name: "Probe" },
        chat: { id: 999999999, type: "private" },
        text: "/stats",
      },
    }),
  });
  check("to'g'ri sarlavha bilan /stats → 200", proper.status === 200, `status ${proper.status}`);

  console.log(`\n=== NATIJA: ${failed === 0 ? "BARCHASI O'TDI" : `${failed} ta muammo`} ===\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Skript xatosi:", e?.message || e);
  process.exit(1);
});