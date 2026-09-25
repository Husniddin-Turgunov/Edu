/* PRODUCTION: DELETE dan keyin GET /api/admin/tests eski (keshdagi) ro'yxat
 * qaytarmaydimi? — aynan shu brauzer/UI da "o'zgarmadi" hissini beradi.
 * Ishlatish: node check-prod-cache.mjs [url]
 */
import { chromium } from "playwright";
import { createHmac } from "crypto";
import { PrismaClient } from "@prisma/client";

const BASE = (process.argv[2] || "https://edu.akelagroup.uz").replace(/\/$/, "");
const SECRET = process.env.AKELA_SESSION_SECRET || "akela-dev-session-secret";
const TMP_TITLE = "ZZ-cache-test (avto-o'chiriladi)";

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
  await prisma.test.deleteMany({ where: { title: TMP_TITLE } });
  await prisma.$disconnect();

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await context.addCookies([
    { name: "akela_session", value: makeToken(user), url: BASE, httpOnly: false, sameSite: "Lax", secure: true },
  ]);
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });

  const call = (method, url, body) =>
    page.evaluate(
      async ([m, u, b]) => {
        const res = await fetch(u, {
          method: m,
          headers: b ? { "Content-Type": "application/json" } : undefined,
          body: b ? JSON.stringify(b) : undefined,
          credentials: "include",
        });
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch {}
        return {
          status: res.status,
          cc: res.headers.get("cache-control"),
          age: res.headers.get("age"),
          xc: res.headers.get("x-vercel-cache"),
          etag: res.headers.get("etag"),
          json,
        };
      },
      [method, url, body]
    );

  const show = (label, r, pick) => {
    const ids = r.json?.tests?.map((t) => t.title) || [];
    console.log(`${label}: status=${r.status} cc=${r.cc || "-"} age=${r.age || "-"} xc=${r.xc || "-"} etag=${r.etag ? "yes" : "-"} tests=${ids.length} tmp=${ids.filter((t) => t.startsWith("ZZ-")).length}`);
  };

  console.log("== 1) Autentifikatsiya + joriy ro'yxat");
  const r1 = await call("GET", "/api/admin/tests");
  if (r1.status !== 200) {
    console.log("SESSIYA ISHLAMADI:", r1.status, JSON.stringify(r1.json)?.slice(0, 200));
    await browser.close();
    process.exit(2);
  }
  show("   GET #1", r1);

  console.log("== 2) CREATE");
  const r2 = await call("POST", "/api/admin/tests", { title: TMP_TITLE, language: "uz", timeLimit: 0, passScore: 60, maxAttempts: 1, questionCount: 5 });
  console.log(`   POST: status=${r2.status} ok=${r2.json?.ok} id=${r2.json?.test?.id || "-"}`);
  const newId = r2.json?.test?.id;
  if (!newId) { await browser.close(); process.exit(3); }

  console.log("== 3) CREATE dan keyin darhol GET (UI shu ni qiladi)");
  const r3 = await call("GET", "/api/admin/tests");
  show("   GET #2", r3);
  const visibleAfterCreate = (r3.json?.tests || []).some((t) => t.id === newId);
  console.log(`   yangi test ko'rinishi: ${visibleAfterCreate ? "HA ✅" : "YO'Q ❌ (KESH!)"}`);

  console.log("== 4) DELETE");
  const r4 = await call("DELETE", `/api/admin/tests/${newId}`);
  console.log(`   DELETE: status=${r4.status} ok=${r4.json?.ok}`);

  console.log("== 5) DELETE dan keyin darhol GET (asosiy savol!)");
  const r5 = await call("GET", "/api/admin/tests");
  show("   GET #3", r5);
  const stillThere = (r5.json?.tests || []).some((t) => t.id === newId);
  console.log(`   o'chirilgan test hali ko'rinadimi: ${stillThere ? "HA ❌ (KESH MUAMMOSI!)" : "YO'Q ✅"}`);

  await browser.close();

  // DB tozalash (DELETE ishlamagan bo'lsa ham)
  const p2 = new PrismaClient();
  await p2.test.deleteMany({ where: { title: TMP_TITLE } });
  const left = await p2.test.count({ where: { title: TMP_TITLE } });
  await p2.$disconnect();
  console.log("DB qoldi:", left);

  const verdict = visibleAfterCreate && !stillThere;
  console.log("\nXULOSA:", verdict ? "API darajasida KESH YO'Q — UI refetch mantiqida muammo" : "API darajasida KESH/topshirish muammosi BOR");
})().catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});
