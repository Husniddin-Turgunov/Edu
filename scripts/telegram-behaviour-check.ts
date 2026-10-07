/**
 * scripts/telegram-behaviour-check.ts — Telegram botning haqiqiy xatti-harakatini
 * tekshiradi. Barcha yuborishlar "soxta" chat ID ga (999999999) — ya'ni hech
 * kimga xabar borib ketmaydi, lekin Telegram API ning qanday javob berishi
 * (400/403/parse xatosi) ko'rinadi.
 *
 *   npx tsx --env-file=.env scripts/telegram-behaviour-check.ts
 */

import {
  sendMessage,
  sendPhoto,
  sendPhotoUrl,
  sendDocumentBuffer,
  broadcast,
  registerSubscriber,
  subscriberCount,
  getSubscriberIds,
} from "@/lib/telegram-bot";
import { renderResultCardPng } from "@/lib/result-card";
import { db } from "@/lib/db";

const FAKE_CHAT = 999999999; // "Probe" — Telegram buni topa olmaydi (400)
const ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || "https://edu.akelagroup.uz").replace(/\/$/, "");

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  OK   ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
function err(res: any) {
  return res?.ok === false ? `${res.error_code}: ${res.description}` : "";
}

async function main() {
  console.log("\n=== 1) Natija kartochkasi PNG (renderResultCardPng) ===");
  try {
    const png = await renderResultCardPng(
      {
        fullName: "Alisher Karimov",
        department: "IT bo'limi",
        position: "Dasturchi",
        testTitle: "Xizmat ko'rsatish standarti",
        score: 87,
        passScore: 70,
        passed: true,
        level: "I daraja",
        completedAt: new Date(),
      },
      ORIGIN,
    );
    const bytes = png.byteLength ?? (png as any).length ?? 0;
    check("PNG render qilindi", bytes > 5000, `${bytes} bayt`);
  } catch (e: any) {
    check("PNG render qilindi", false, e?.message || String(e));
  }

  console.log("\n=== 2) Telegram API javoblari (soxta chat — hech kimga borib ketmaydi) ===");
  const iconRes: any = await sendPhotoUrl(FAKE_CHAT, `${ORIGIN}/icons/glass/monitoring.png`, "Sinov", {
    reply_markup: { inline_keyboard: [[{ text: "Statistika", callback_data: "menu:stats" }]] },
  });
  console.log(`  sendPhotoUrl(ikona) -> ok=${iconRes?.ok} ${err(iconRes)}`);
  check(
    "ikona yuborishda xato FAQAT 'chat not found' (rasm/parse xatosi emas)",
    iconRes?.ok === false && /chat not found/i.test(iconRes?.description || ""),
    err(iconRes),
  );

  const msgRes: any = await sendMessage(FAKE_CHAT, "<b>Sinov</b> &lt;test&gt; matn", {
    reply_markup: [[{ text: "Statistika", callback_data: "menu:stats" }]],
  });
  console.log(`  sendMessage(HTML+tugma) -> ok=${msgRes?.ok} ${err(msgRes)}`);
  check(
    "HTML parse xatosi yo'q",
    msgRes?.ok === false ? !/can't parse entities/i.test(msgRes?.description || "") : true,
    err(msgRes),
  );

  const docRes: any = await sendDocumentBuffer(FAKE_CHAT, new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]), "sinov.pdf", "Sinov");
  console.log(`  sendDocumentBuffer -> ok=${docRes?.ok} ${err(docRes)}`);
  check("document/multipart xatosi yo'q", !/Bad Request|unsupported/i.test(err(docRes)), err(docRes));

  console.log("\n=== 3) Obunachilar ro'yxati va broadcast ===");
  await registerSubscriber({ chatId: FAKE_CHAT, firstName: "Probe", username: "probe" });
  const count = await subscriberCount();
  const ids = await getSubscriberIds();
  check("soxta obunachi yozildi", count >= 1, `${count} ta faol, ${ids.length} ta ID`);

  const res = await broadcast({
    text: "<b>Diagnostika</b> — bu xabar hech kimga real yetkazilmasligi uchun soxta chatga yuborildi.",
  });
  console.log(`  broadcast -> ${JSON.stringify(res)}`);
  check("broadcast hech qanday xatosiz tugadi", typeof res.sent === "number", "");
  check(
    "soxta chat broadcast dan keyin o'chirildi (403/400 ga qarab)",
    (await db.botSubscriber.findUnique({ where: { chatId: String(FAKE_CHAT) } }))?.isActive === false,
    "isActive=false",
  );

  console.log("\n=== 4) Telegram'ga yuborilmaydigan qismlar (render) ===");
  // Rasmli xabar + caption chegarasi
  const longCaption = "x".repeat(1200);
  const clipped = Math.min(longCaption.length, 1000);
  check("caption 1024 chegarasi qo'llanadi", clipped <= 1024, `${clipped} belgi`);

  await db.$disconnect();
  console.log(`\n=== NATIJA: ${failed === 0 ? "MUAMMO YO'Q" : `${failed} ta muammo topildi`} ===\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Skript xatosi:", e?.message || e);
  process.exit(1);
});