/* Live E2E (lokal dev server + HAQIQIY DB):
 *  - review modalida tanlangan javob («Siz» / «Noto'g'ri») ko'rinadimi
 *  - eski (kesilgan) urinish uchun ogohlantirish va «Javob berilmagan» chiqadimi
 * Ishlatish: node check-review-live.mjs
 */
import { chromium } from "playwright";
import { createHmac } from "crypto";
import { encode } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SECRET = process.env.AKELA_SESSION_SECRET || "akela-dev-session-secret";
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "akela-onboarding-secret-key-2024";
const TEST_ID = process.argv[2] || "cmudoc4hm0000jt04jdroy06m";
const BASE = "http://localhost:3000";

function makeToken(user) {
  const payload = Buffer.from(
    JSON.stringify({
      userId: user.id,
      role: "admin",
      participantKind: null,
      employeeId: null,
      candidateId: null,
      name: user.name || user.email || "Admin",
      exp: Date.now() + 24 * 60 * 60 * 1000,
    }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

async function counts(page) {
  return page.evaluate(() => {
    const q = (sel) => document.querySelectorAll(sel).length;
    return {
      questions: q('[data-testid="review-question"]'),
      selected: q('[data-testid="badge-selected"]'),
      wrong: q('[data-testid="badge-wrong"]'),
      correct: q('[data-testid="badge-correct"]'),
      unanswered: q('[data-testid="badge-question-unanswered"]'),
      truncatedWarning: q('[data-testid="review-truncated-warning"]'),
      choicesSelectedAttr: document.querySelectorAll('[data-testid="review-choice"][data-selected="1"]').length,
    };
  });
}

(async () => {
  const user = await prisma.user.findFirst({ where: { email: "admin@akelagroup.com" } });
  if (!user) throw new Error("admin@akelagroup.com topilmadi");
  await prisma.$disconnect();

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // NextAuth sessiyasi (client `useSession` gate uchun) + akela_session (API getSession uchun)
  const nextAuthToken = await encode({
    token: { sub: user.id, id: user.id, role: "admin", email: user.email, name: user.name || "Admin" },
    secret: NEXTAUTH_SECRET,
    maxAge: 86400,
  });
  await context.addCookies([
    { name: "akela_session", value: makeToken(user), url: BASE, httpOnly: false, sameSite: "Lax", secure: false },
    { name: "next-auth.session-token", value: nextAuthToken, url: BASE, httpOnly: false, sameSite: "Lax", secure: false },
  ]);
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") console.log("   [browser error]", m.text()); });

  await page.goto(`${BASE}/tests/${TEST_ID}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByTestId("history-list").waitFor({ state: "visible", timeout: 45000 });

  const historyCount = await page.getByTestId("history-review-btn").count();
  console.log("history entries:", historyCount);

  const report = [];
  for (const idx of [1, 0]) {
    if (idx >= historyCount) continue;
    await page.getByTestId("history-review-btn").nth(idx).click();
    await page.getByTestId("review-panel").waitFor({ state: "visible", timeout: 30000 });
    // Dev server'da review API 3-7s oladi — yuklanish tugashini kutamiz
    await page
      .waitForFunction(
        () =>
          document.querySelectorAll('[data-testid="review-question"]').length > 0 ||
          !!document.querySelector('[data-testid="review-error"]'),
        null,
        { timeout: 45000 },
      )
      .catch(() => console.log(`   [warn] attempt #${idx + 1}: review kutish vaqti tugadi`));
    await page.waitForTimeout(300);
    const c = await counts(page);
    console.log(`--- attempt #${idx + 1} (history index ${idx})`, c);
    report.push({ idx, ...c });
    await page.screenshot({ path: `review-live-${idx}.png`, fullPage: false });
    await page.getByTestId("review-close").click();
    await page.waitForTimeout(400);
  }

  const withRecovered = report.find((r) => r.selected > 0);
  const noAnswers = report.find((r) => r.unanswered > 0);
  console.log("\nNATIJA:");
  console.log("  tiklanmagan (hammasi yo'qolgan) urinishda ham «Javob berilmagan» ko'rinadi:", !!noAnswers);
  console.log("  ogohlantirish banneri ko'rinadi:", report.every((r) => r.truncatedWarning > 0));
  if (withRecovered) {
    console.log("  tiklovchi parser bilan TANLANGAN javob ko'rinadi:", `selected=${withRecovered.selected}, wrong=${withRecovered.wrong}, correct=${withRecovered.correct}`);
  } else {
    console.log("  (bu testda tiklanadigan javob yo'q — faqat 'Javob berilmagan' holati)");
  }

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
