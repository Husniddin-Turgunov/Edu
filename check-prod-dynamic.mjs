/* PRODUCTION dinamiklik tekshiruvi: edu.akelagroup.uz da test yaratish/o'chirish
 * sahifa yangilanmasdan aks ettiriladimi? + API cache headerlari.
 * Ishlatish: node check-prod-dynamic.mjs [url]
 */
import { chromium } from "playwright";
import { createHmac } from "crypto";
import { encode } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";

const BASE = (process.argv[2] || "https://edu.akelagroup.uz").replace(/\/$/, "");
const SECRET = process.env.AKELA_SESSION_SECRET || "akela-dev-session-secret";
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "akela-onboarding-secret-key-2024";
const TMP_TITLE = "ZZ-vaqtinchalik-test (avto-o'chiriladi)";

const prisma = new PrismaClient();

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
  await prisma.test.deleteMany({ where: { title: TMP_TITLE } }); // oldingi qoldiq
  await prisma.$disconnect();

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const nextAuthToken = await encode({ token: { sub: user.id, id: user.id, role: "admin", email: user.email, name: user.name || "Admin" }, secret: NEXTAUTH_SECRET, maxAge: 86400 });
  await context.addCookies([
    { name: "akela_session", value: makeToken(user), url: BASE, httpOnly: false, sameSite: "Lax", secure: true },
    { name: "next-auth.session-token", value: nextAuthToken, url: BASE, httpOnly: false, sameSite: "Lax", secure: true },
  ]);
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());

  const netlog = [];
  page.on("response", async (r) => {
    if (r.url().includes("/api/admin/tests")) {
      const h = r.headers();
      netlog.push({
        m: r.request().method(),
        u: r.url().replace(BASE, "").slice(0, 70),
        st: r.status(),
        cc: h["cache-control"] || "-",
        age: h["age"] || "-",
        xc: h["x-vercel-cache"] || "-",
        etag: h["etag"] ? "yes" : "-",
      });
    }
  });

  const results = {};
  const cardCount = () => page.getByTestId("admin-test-card").count();

  await page.goto(`${BASE}/admin/lms/tests`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2000);

  // Sessiya ishlamasa — login'ga redirect
  if (page.url().includes("/login")) {
    console.log("SESSIYA ISHLAMADI — /login ga redirect bo'ldi (token sir kutilganidan farq qiladi)");
    await browser.close();
    process.exit(2);
  }

  try {
    await page.getByTestId("admin-test-card").first().waitFor({ state: "visible", timeout: 60000 });
  } catch {
    console.log("Kartalar topilmadi. URL:", page.url());
    await page.screenshot({ path: "prod-dynamic.png" });
    await browser.close();
    process.exit(3);
  }
  const before = await cardCount();
  console.log("1) sahifa ochildi, kartalar:", before);

  // YARATISH
  await page.getByRole("button", { name: /Test yaratish/ }).first().click();
  await page.getByPlaceholder(/Masalan:/).fill(TMP_TITLE);
  await page.locator("button", { hasText: "Test yaratish" }).last().click();
  await page.waitForTimeout(4000);
  const createdVisible = (await page.getByText(TMP_TITLE).count()) > 0;
  results.createShowsWithoutReload = createdVisible;
  console.log(`2) yaratish (F5'siz): kartalar ${before} -> ${await cardCount()}, yangi ko'rindi: ${createdVisible}`);
  if (!createdVisible) await page.screenshot({ path: "prod-create.png" });

  // Savol modali avto ochiladi — yopamiz
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);

  // O'CHIRISH
  const tmpCard = page.locator('[data-testid="admin-test-card"]').filter({ hasText: TMP_TITLE }).first();
  if ((await tmpCard.count()) > 0) {
    await tmpCard.getByRole("button").last().click();
    await page.waitForTimeout(4000);
    const stillThere = (await page.getByText(TMP_TITLE).count()) > 0;
    results.deleteHidesWithoutReload = !stillThere;
    console.log(`3) o'chirish (F5'siz): karta hali ko'rinadimi: ${stillThere}`);
    if (stillThere) await page.screenshot({ path: "prod-delete.png" });
  } else {
    console.log("3) SKIP — karta topilmadi");
    results.deleteHidesWithoutReload = "skipped";
  }

  console.log("\nNetwork /api/admin/tests:");
  for (const n of netlog) console.log("  ", n.m, n.u, "->", n.st, "| cc:", n.cc, "| age:", n.age, "| xc:", n.xc, "| etag:", n.etag);

  // DB tozalash
  const p2 = new PrismaClient();
  const left = await p2.test.count({ where: { title: TMP_TITLE } });
  await p2.test.deleteMany({ where: { title: TMP_TITLE } });
  await p2.$disconnect();
  console.log("\nDB qoldi:", left, "(0 bo'lsa toza)");

  console.log("\nNATIJA:", JSON.stringify(results, null, 2));
  await browser.close();
})().catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});
