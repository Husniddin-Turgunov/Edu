/**
 * scripts/telegram-simulate.ts — Webhook'ni Telegram kabi taqlid qilib
 * chaqiradi va botning BARCHA yo'llarini (matn, buyruq, tugma) tekshiradi.
 *
 *   npx tsx --env-file=.env scripts/telegram-simulate.ts
 *
 * Barcha so'rovlar soxta chat 999999999 ga — ya'ni Telegram "chat not found"
 * qaytaradi, lekin shu bilan botning DB/render/menu kodi TO'LIQ ishlaydi.
 * Hech kimga haqiqiy xabar borib ketmaydi.
 */

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const FAKE = 999999999;

type Payload = Record<string, unknown>;

function message(text: string, id: number): Payload {
  return {
    update_id: id,
    message: {
      message_id: id,
      date: Math.floor(Date.now() / 1000),
      from: { id: 1, is_bot: false, first_name: "Probe", username: "probe" },
      chat: { id: FAKE, type: "private" },
      text,
    },
  };
}

function callback(data: string, id: number, withPhoto = false): Payload {
  return {
    update_id: id,
    callback_query: {
      id: String(id),
      from: { id: 1, is_bot: false, first_name: "Probe" },
      chat_instance: "probe",
      data,
      message: {
        message_id: id,
        date: Math.floor(Date.now() / 1000),
        chat: { id: FAKE, type: "private" },
        ...(withPhoto ? { photo: [{ file_id: "x", file_unique_id: "y" }] } : { text: "old" }),
      },
    },
  };
}

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ${cond ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failed++;
}

async function post(label: string, payload: Payload) {
  const started = Date.now();
  // Telegram har doim `X-Telegram-Bot-Api-Secret-Token` sarlavhasini yuboradi —
  // bizning sun'iy chaqiruvimiz ham shuni qo'shadi (secret .env dan).
  const secret = process.env.TELEGRAM_BOT_WEBHOOK_SECRET || "";
  const res = await fetch(`${BASE}/api/telegram`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": secret },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  const ms = Date.now() - started;
  const okBody = text.includes('"ok":true');
  check(`${label} → ${res.status} (${ms}ms)`, res.ok && okBody, text.slice(0, 60));
  return ms;
}

async function main() {
  console.log(`\n=== Webhook simulyatsiyasi (chat ${FAKE}) ===`);
  const cases: [string, Payload][] = [
    ["/start", message("/start", 1001)],
    ["/help", message("/help", 1002)],
    ["/stats", message("/stats", 1003)],
    ["/users", message("/users", 1004)],
    ["/pending", message("/pending", 1005)],
    ["/tests", message("/tests", 1006)],
    ["noma'lum buyruq /foo", message("/foo", 1007)],
    ["matn: statistika", message("statistika", 1008)],
    ["matn: 🔄 Yangilash (eski klaviatura)", message("🔄 Yangilash", 1009)],
    ["matn: tushunilmagan", message("blabla", 1010)],
    ["tugma: menu:stats", callback("menu:stats", 1011)],
    ["tugma: menu:stats (rasm xabar ostida)", callback("menu:stats", 1012, true)],
    ["tugma: menu:users", callback("menu:users", 1013)],
    ["tugma: menu:pending", callback("menu:pending", 1014)],
    ["tugma: menu:tests (takers)", callback("menu:tests", 1015)],
    ["tugma: menu:activetests", callback("menu:activetests", 1016)],
    ["tugma: menu:help", callback("menu:help", 1017)],
    ["tugma: menu:refresh", callback("menu:refresh", 1018)],
    ["tugma: tu:<yo'q user>", callback("tu:yoquser", 1019)],
    ["tugma: ti:<yo'q natija>", callback("ti:yoqnatija", 1020)],
    ["tugma: tp:<yo'q natija>", callback("tp:yoqnatija", 1021)],
    ["tugma: tur:<yo'q user>", callback("tur:yoquser", 1022)],
    ["tugma: approve:<yo'q user>", callback("approve:yoquser", 1023)],
    ["tugma: noma'lum", callback("nonsense:1", 1024)],
    ["bo'sh body", {}],
    ["noto'g'ri JSON emas ({} update_id)", { update_id: 1025 }],
  ];

  let slowest = { label: "", ms: 0 };
  for (const [label, payload] of cases) {
    const ms = await post(label, payload);
    if (ms > slowest.ms) slowest = { label, ms };
  }

  console.log(`\n  eng sekin yo'l: ${slowest.label} (${slowest.ms}ms)`);
  check("barcha yo'llar 200 qaytardi (xatoni yashirmadi)", failed === 0, `${failed} ta muammo`);
  console.log(`\n=== NATIJA: ${failed === 0 ? "BARCHASI O'TDI" : `${failed} ta muammo`} ===\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Skript xatosi:", e?.message || e);
  process.exit(1);
});