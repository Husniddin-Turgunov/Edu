/* Eye toggle E2E with valid next-auth JWT cookie (middleware) + API mocks */
const { chromium } = require("playwright");
const { encode } = require("next-auth/jwt");

const SECRET = process.env.NEXTAUTH_SECRET || "akela-onboarding-secret-key-2024";

const testsFixture = [
  {
    id: "t1",
    title: "Matematika testi",
    description: "Boshlang'ich algebra",
    language: "uz",
    timeLimit: 30,
    passScore: 60,
    status: "draft",
    maxAttempts: 1,
    shuffleQuestions: true,
    shuffleChoices: true,
    visibility: "all",
    assignedUserIds: "[]",
    questionCount: 10,
    _count: { questions: 5 },
  },
  {
    id: "t2",
    title: "Ingliz tili testi",
    description: "Grammar A2",
    language: "uz",
    timeLimit: 20,
    passScore: 70,
    status: "active",
    maxAttempts: 2,
    shuffleQuestions: false,
    shuffleChoices: true,
    visibility: "all",
    assignedUserIds: "[]",
    questionCount: 10,
    _count: { questions: 8 },
  },
];

(async () => {
  const token = await encode({
    token: {
      name: "Admin",
      email: "admin@akelagroup.com",
      sub: "admin1",
      role: "admin",
      id: "admin1",
    },
    secret: SECRET,
    maxAge: 30 * 24 * 60 * 60,
  });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    {
      name: "next-auth.session-token",
      value: token,
      url: "http://localhost:3000",
      httpOnly: false,
      sameSite: "Lax",
      secure: false,
    },
  ]);

  const page = await context.newPage();
  const patchCalls = [];

  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        user: { id: "admin1", email: "admin@akelagroup.com", name: "Admin", role: "admin" },
        expires: "2099-01-01T00:00:00.000Z",
      },
    })
  );
  await page.route("**/api/admin/users", (route) =>
    route.fulfill({ json: { ok: true, users: [] } })
  );
  await page.route("**/api/portal-settings", (route) =>
    route.fulfill({ json: { ok: true, settings: {} } })
  );
  await page.route("**/api/admin/tests/t1", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      patchCalls.push({ id: "t1", ...body });
      route.fulfill({ json: { ok: true, test: { ...testsFixture[0], status: body.status } } });
    } else route.continue();
  });
  await page.route("**/api/admin/tests/t2", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      patchCalls.push({ id: "t2", ...body });
      route.fulfill({ json: { ok: true, test: { ...testsFixture[1], status: body.status } } });
    } else route.continue();
  });
  await page.route("**/api/admin/tests", (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({ json: { ok: true, tests: testsFixture } });
    } else route.continue();
  });

  await page.goto("http://localhost:3000/admin/lms/tests", {
    waitUntil: "networkidle",
    timeout: 45000,
  });

  await page.waitForSelector('[data-testid="admin-test-card"]', { timeout: 20000 });
  const cardCount = await page.locator('[data-testid="admin-test-card"]').count();

  const t1 = page.locator('[data-testid="admin-test-card"]').filter({ hasText: "Matematika" });
  const t1Toggle = t1.locator('[data-testid="test-visibility-toggle"]');
  await t1Toggle.waitFor({ state: "visible", timeout: 10000 });

  const beforeBadge = await t1
    .locator("span")
    .filter({ hasText: /KO'RINADI|YASHIRIN|ARXIV/ })
    .first()
    .innerText();
  const beforeActive = await t1Toggle.getAttribute("data-active");
  const beforeTitle = await t1Toggle.getAttribute("title");

  // click show
  await t1Toggle.click({ force: true });
  await page.waitForTimeout(700);

  const afterBadge = await t1
    .locator("span")
    .filter({ hasText: /KO'RINADI|YASHIRIN|ARXIV/ })
    .first()
    .innerText();
  const afterActive = await t1Toggle.getAttribute("data-active");
  const afterTitle = await t1Toggle.getAttribute("title");
  const eyeIconVisible = await t1Toggle.locator("svg").isVisible();

  // click hide
  await t1Toggle.click({ force: true });
  await page.waitForTimeout(700);

  const secondBadge = await t1
    .locator("span")
    .filter({ hasText: /KO'RINADI|YASHIRIN|ARXIV/ })
    .first()
    .innerText();
  const secondActive = await t1Toggle.getAttribute("data-active");
  const secondTitle = await t1Toggle.getAttribute("title");

  const t2 = page.locator('[data-testid="admin-test-card"]').filter({ hasText: "Ingliz" });
  const t2Active = await t2.locator('[data-testid="test-visibility-toggle"]').getAttribute("data-active");
  const t2Title = await t2.locator('[data-testid="test-visibility-toggle"]').getAttribute("title");

  const checks = {
    cards_present: cardCount >= 2,
    eye_visible: await t1Toggle.isVisible(),
    badge_hidden_before: beforeBadge.includes("YASHIRIN"),
    active_flag_0: beforeActive === "0",
    title_show_before: /Ko'rsatish|ochish/i.test(beforeTitle || ""),
    patch_show: patchCalls[0] && patchCalls[0].status === "active",
    badge_shown_after: afterBadge.includes("KO'RINADI"),
    active_flag_1: afterActive === "1",
    title_hide_after: /Yashirish|berkit/i.test(afterTitle || ""),
    icon_still_there: eyeIconVisible,
    patch_hide: patchCalls[1] && patchCalls[1].status === "draft",
    badge_hidden_again: secondBadge.includes("YASHIRIN"),
    active_flag_0_again: secondActive === "0",
    title_show_again: /Ko'rsatish|ochish/i.test(secondTitle || ""),
    card2_active: t2Active === "1",
    card2_title_hide: /Yashirish|berkit/i.test(t2Title || ""),
  };

  await page.screenshot({ path: "test-eye-toggle.png", fullPage: false });

  const allPass = Object.values(checks).every((v) => v === true);
  console.log("EYE TOGGLE CHECKS:", JSON.stringify(checks, null, 2));
  console.log("PATCH calls:", JSON.stringify(patchCalls));
  console.log(allPass ? "ALL PASS" : "SOME FAIL: " + Object.entries(checks).filter(([, v]) => v !== true).map(([k]) => k).join(","));

  await browser.close();
  process.exit(allPass ? 0 : 1);
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(2);
});
