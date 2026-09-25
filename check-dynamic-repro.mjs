/* Repro: admin tests sahifasida YARATISH va O'CHIRISH sahifa yangilanmasdan
 * ro'yxatga tushadimi? (dev server + haqiqiy DB, test yaratiladi-o'chiriladi)
 * Ishlatish: npx tsx check-dynamic-repro.mjs  yoki node (playwright .mjs)
 */
import { chromium } from "playwright";
import { createHmac } from "crypto";
import { encode } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SECRET = process.env.AKELA_SESSION_SECRET || "akela-dev-session-secret";
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "akela-onboarding-secret-key-2024";
const BASE = "http://localhost:3000";
const TMP_TITLE = "ZZ-vaqtinchalik-test (avto-o'chiriladi)";

function makeToken(user) {
  const payload = Buffer.from(
    JSON.stringify({ userId: user.id, role: "admin", participantKind: null, employeeId: null, candidateId: null, name: user.name || "Admin", exp: Date.now() + 86400000 }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

(async () => {
  const user = await prisma.user.findFirst({ where: { email: "admin@akelagroup.com" } });
  if (!user) throw new Error("admin topilmadi");

  // Avvalgi qoldiq testlarni tozalash
  await prisma.test.deleteMany({ where: { title: TMP_TITLE } });
  await prisma.$disconnect();

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const nextAuthToken = await encode({ token: { sub: user.id, id: user.id, role: "admin", email: user.email, name: user.name || "Admin" }, secret: NEXTAUTH_SECRET, maxAge: 86400 });
  await context.addCookies([
    { name: "akela_session", value: makeToken(user), url: BASE, httpOnly: false, sameSite: "Lax", secure: false },
    { name: "next-auth.session-token", value: nextAuthToken, url: BASE, httpOnly: false, sameSite: "Lax", secure: false },
  ]);
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());

  // /api/admin/tests GET/DELETE so'rovlarini kuzatamiz
  const netlog = [];
  page.on("response", async (r) => {
    if (r.url().includes("/api/admin/tests")) {
      netlog.push({ method: r.request().method(), url: r.url().replace(BASE, ""), status: r.status(), age: r.headers()["age"] || "-", cache: r.headers()["cache-control"] || "-", xc: r.headers()["x-vercel-cache"] || "-" });
    }
  });

  const results = {};
  const cardCount = () => page.getByTestId("admin-test-card").count();

  // 1) Sahifani ochish
  await page.goto(`${BASE}/admin/lms/tests`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByTestId("admin-test-card").first().waitFor({ state: "visible", timeout: 60000 });
  const before = await cardCount();
  console.log("1) sahifa ochildi, kartalar:", before);

  // 2) YARATISH — sahifa yangilanmasdan karta paydo bo'ladimi?
  await page.getByRole("button", { name: /Test yaratish/ }).first().click();
  await page.getByPlaceholder(/Masalan:/).fill(TMP_TITLE);
  await page.locator("button", { hasText: "Test yaratish" }).last().click();
  await page.waitForTimeout(3500);
  const afterCreate = await cardCount();
  const createdVisible = (await page.getByText(TMP_TITLE).count()) > 0;
  results.createShowsWithoutReload = createdVisible;
  console.log(`2) yaratishdan keyin (F5'siz): kartalar ${before} -> ${afterCreate}, yangi karta ko'rinadi: ${createdVisible}`);
  if (!createdVisible) await page.screenshot({ path: "repro-create.png" });

  // 2.5) Savol qo'shish modali avto ochiladi — yopamiz (Esc)
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const modalLeft = await page.locator('input[placeholder*="Variant"]').count();
  console.log("2.5) savol modali yopildi (qoldi inputlar):", modalLeft);

  // 3) O'CHIRISH — sahifa yangilanmasdan karta yo'qoladimi?
  const tmpCard = page.locator('[data-testid="admin-test-card"]').filter({ hasText: TMP_TITLE }).first();
  const hasTmp = await tmpCard.count();
  if (hasTmp) {
    // Kartadagi O'chirish (Trash2) tugmasi
    const delBtn = tmpCard.getByRole("button").last();
    await delBtn.click();
    await page.waitForTimeout(3000);
    const afterDelete = (await page.getByText(TMP_TITLE).count()) > 0;
    results.deleteHidesWithoutReload = !afterDelete;
    console.log(`3) o'chirishdan keyin (F5'siz): karta hali ko'rinadimi: ${afterDelete}`);
    if (afterDelete) await page.screenshot({ path: "repro-delete.png" });
  } else {
    console.log("3) SKIP — vaqtinchalik test karta topilmadi");
    results.deleteHidesWithoutReload = "skipped";
  }

  // 4) API orqali haqiqat tekshiruvi (DB holati)
  const p2 = new PrismaClient();
  const dbCount = await p2.test.count({ where: { title: TMP_TITLE } });
  await p2.test.deleteMany({ where: { title: TMP_TITLE } }).catch(() => {});
  await p2.$disconnect();
  console.log("4) DB da qoldi:", dbCount);
  console.log("\nNetwork (/api/admin/tests):");
  for (const n of netlog) console.log("  ", n.method, n.url.slice(0, 90), "->", n.status, "| age:", n.age, "| cache-control:", n.cache, "| x-vercel-cache:", n.xc);

  console.log("\nNATIJA:", JSON.stringify(results, null, 2));
  await browser.close();
})().catch((e) => {
  console.error("REPRO XATO:", e.message);
  process.exit(1);
});
