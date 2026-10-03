/**
 * scripts/ai-agent-e2e.ts
 *
 * AGENT darajasidagi dalil (Faza 4): tekshiruv tizimi va fayl guard'i
 * haqiqiy HTTP orqali tekshiriladi.
 *
 * Ishga tushirish:
 *   npx tsx --env-file=.env scripts/ai-agent-e2e.ts
 *
 * Tekshiriladi:
 *  1) "Excel fayl yasab ber..." → haqiqiy doc.excel natijasi + verified
 *  2) "faylni qayta yasab, yangi fayl ber..." → doc.recreate / file.list
 *  3) "jadval yasay, lekin ma'lumot yo'q" → bo'sh fayl YARATILMAYDI,
 *     balki bir aniq savol bilan to'xtaydi (guard ishlayapti)
 */

import { encodeSessionToken, SESSION_COOKIE } from "@/lib/auth-core";
import { db } from "@/lib/db";

const BASE = process.env.E2E_BASE || "http://localhost:3000";

type Event = { type: string; [k: string]: any };

async function chat(message: string, cookie: string): Promise<{ events: Event[]; reply: string }> {
  const res = await fetch(`${BASE}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `${SESSION_COOKIE}=${cookie}` },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const raw = await res.text();
  const events: Event[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("data:")) continue;
    const payload = t.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      events.push(JSON.parse(payload));
    } catch {
      /* bo'lakli SSE */
    }
  }
  const reply = String(events.find((e) => e.type === "reply")?.reply || "");
  return { events, reply };
}

function summarize(events: Event[]) {
  const tools = events.filter((e) => e.type === "step" && e.step?.type === "action").map((e) => e.step.tool);
  const results = events
    .filter((e) => e.type === "step" && e.step?.type === "result")
    .map((e) => ({ tool: e.step.tool, ok: e.step.ok, verified: e.step.verified, note: e.step.verifyNote }));
  const warns = events.filter((e) => e.type === "step" && e.step?.type === "warning").map((e) => e.step.summary);
  return { tools, results, warns };
}

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  OK   ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const admin: any = await db.user.findFirst({ where: { role: "admin" }, select: { id: true, email: true, name: true, surname: true, role: true } });
  if (!admin) throw new Error("Admin topilmadi");
  const token = encodeSessionToken(
    { userId: admin.id, email: admin.email, name: admin.name || "", surname: admin.surname || "", role: admin.role },
    1,
  );

  console.log("\n=== 1) Excel fayl yaratish (to'liq HTTP oqimi) ===");
  const one = await chat("Excel fayl yasab ber: 3 bo'lim bo'yicha xodimlar soni va o'tish darajasi. Jadval nomi bo'limlar_statistikasi", token);
  const s1 = summarize(one.events);
  console.log(`  vositalar: ${s1.tools.join(", ") || "(yo'q)"}`);
  console.log(`  javob: ${one.reply.slice(0, 220)}`);
  check("doc.excel chaqirildi", s1.tools.includes("doc.excel"), s1.tools.join(", "));
  const fileResult = s1.results.find((r) => r.tool === "doc.excel");
  check("fayl natijasi muvaffaqiyatli", fileResult?.ok === true, fileResult?.note || "");
  check("natiga TEKSHIRUV qo'yildi (verified)", fileResult?.verified !== undefined, String(fileResult?.verified));
  check("javob fayl nomini aytadi", /\.(xlsx|docx|pdf)/i.test(one.reply), one.reply.slice(0, 120));

  console.log("\n=== 2) Qayta yaratish + yangi fayl ===");
  const two = await chat('Avvalgi Excel faylni qayta yasab, yangi yuklash uchun fayl ber', token);
  const s2 = summarize(two.events);
  console.log(`  vositalar: ${s2.tools.join(", ") || "(yo'q)"}`);
  console.log(`  javob: ${two.reply.slice(0, 220)}`);
  check(
    "fayl vositasi ishlagan (recreate/list/excel/word/pdf)",
    s2.tools.some((t) => /^(doc\.recreate|file\.list|doc\.excel|doc\.word|doc\.pdf)$/.test(t)),
    s2.tools.join(", "),
  );

  console.log("\n=== 3) GUARD: ma'lumot yetishmasligi — bo'sh fayl qurilmasligi ===");
  const three = await chat("Excel fayl yasab ber", token);
  const s3 = summarize(three.events);
  console.log(`  vositalar: ${s3.tools.join(", ") || "(yo'q)"}`);
  console.log(`  javob: ${three.reply.slice(0, 260)}`);
  const claimed = /qildim|yaratdim|tayyor|faqat sizning/i.test(three.reply);
  const asked = /\?|ayting|kerak|yozing|aytib/i.test(three.reply);
  check("soxta 'yaratdim' yo'q", !claimed, three.reply.slice(0, 140));
  check("aniq savol bilan to'xtadi", asked);

  console.log(`\n=== NATIJA: ${failed === 0 ? "BARCHASI O'TDI" : `${failed} ta xato`} ===\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("E2E xatosi:", err?.message || err);
  process.exit(1);
});