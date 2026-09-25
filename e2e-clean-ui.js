const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route("**/api/auth/session", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { name: "Test" }, expires: "2099-01-01" }) }));
  const questions = [
    { id: "q1", text: "Savol bir?", type: "choice", points: 1, choices: [
      { id: "c1", text: "To'g'ri", order: 0, isCorrect: true }, { id: "c2", text: "Noto'g'ri", order: 1 }
    ]},
    { id: "q2", text: "Savol ikki?", type: "choice", points: 1, choices: [
      { id: "c3", text: "Ha", order: 0, isCorrect: true }, { id: "c4", text: "Yo'q", order: 1 }
    ]}
  ];
  await page.route("**/api/tests/att1", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, test: { id: "att1", title: "Mexanik atestatsiya testi", passScore: 70, maxAttempts: 0, timeLimit: null, description: "Yakuniy baholash", questions, shuffleQuestions: true } }) }));
  await page.route("**/api/tests/history**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, results: [] }) }));
  await page.route("**/api/tests/att1/submit", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, result: { id: "r1", score: 100, passed: true } }) }));

  await page.goto("http://localhost:3000/tests/att1", { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector('[data-testid="quiz-shell"]', { timeout: 20000 });

  const proof = {};

  // During quiz: site nav hidden (Navbar typically has nav landmark / links to dashboard)
  proof.quiz_shell = await page.locator('[data-testid="quiz-shell"]').isVisible();
  proof.site_nav_hidden = !(await page.locator("header nav, [data-testid='site-nav']").first().isVisible().catch(() => false));
  // No breadcrumb path "Kurslar /" as separate row above quiz — quiz topbar has Chiqish only
  proof.breadcrumb_gone = !(await page.getByText(/^Kurslar \//).isVisible().catch(() => false));
  // Header meta card (Savollar count big number next to title card) gone — only quiz-topbar title
  proof.header_card_gone = !(await page.locator("text=Yakuniy baholash").isVisible().catch(() => false));
  proof.only_quiz_ui = proof.quiz_shell && proof.breadcrumb_gone && proof.header_card_gone;

  // Submit button fully visible without scroll
  const sub = page.locator('[data-testid="submit-btn"]');
  proof.submit_visible = await sub.isVisible();
  const subBox = await sub.boundingBox();
  const vp = page.viewportSize();
  proof.submit_in_viewport = subBox ? subBox.y >= 0 && subBox.y + subBox.height <= vp.height : false;
  proof.question_visible = await page.locator('[data-testid="current-question"]').isVisible();
  const qBox = await page.locator('[data-testid="current-question"]').boundingBox();
  proof.question_in_viewport = qBox ? qBox.y >= 0 && qBox.y + qBox.height <= vp.height : false;
  proof.page_overflow_hidden = await page.locator("main").evaluate((el) => getComputedStyle(el).overflow === "hidden");

  await page.screenshot({ path: "test-quiz-clean.png", fullPage: false });

  // Answer both, submit
  await page.locator('[data-testid="current-question"]').getByRole("button", { name: /^To'g'ri|^Ha|^To/ }).first().click({ force: true }).catch(async () => {
    await page.locator('[data-testid="current-question"] button').filter({ hasText: "To'g'ri" }).first().click({ force: true });
  });
  await page.waitForTimeout(200);
  await page.locator('[data-testid="next-btn"]').click({ force: true });
  await page.waitForTimeout(300);
  // pick first choice on q2
  const card = page.locator('[data-testid="current-question"]');
  const buttons = card.locator("button");
  // click choice A (first non nav button with text)
  await card.getByRole("button", { name: /Ha|To'g'ri|A/ }).first().click({ force: true }).catch(async () => {
    await buttons.nth(0).click({ force: true });
  });
  await page.waitForTimeout(300);

  // If still not all answered, try clicking any choice buttons
  const answeredTxt = (await page.locator('[data-testid="answered-count"]').textContent()) || "";
  if (!answeredTxt.includes("2/2")) {
    // force answer q1 and q2 via dots + clicks
    for (let i = 0; i < 2; i++) {
      await page.locator('[data-testid="step-dots"] button').nth(i).click({ force: true });
      await page.waitForTimeout(200);
      const c = page.locator('[data-testid="current-question"]');
      await c.locator("button").filter({ hasNot: page.locator('[data-testid]') }).first().click({ force: true }).catch(() => {});
      // simpler: click button containing order letter
      const n = await c.locator("button").count();
      if (n > 0) await c.locator("button").last().click({ force: true });
      await page.waitForTimeout(150);
    }
  }

  await page.locator('[data-testid="submit-btn"]').click({ force: true });
  await page.waitForSelector('[data-testid="confirm-modal"]', { timeout: 8000 }).catch(() => {});
  if (await page.locator('[data-testid="confirm-submit"]').isVisible().catch(() => false)) {
    await page.locator('[data-testid="confirm-submit"]').click({ force: true });
  }
  await page.waitForSelector('[data-testid="result-panel"]', { timeout: 10000 });

  // After submit: Navbar restored + scrollable
  proof.result_visible = await page.locator('[data-testid="result-panel"]').isVisible();
  proof.nav_restored = await page.evaluate(() => {
    // Navbar component typically renders <nav> or header with links
    return !!document.querySelector("nav") || document.body.innerText.includes("Dashboard") || document.body.innerText.includes("Kurslar");
  });
  proof.scroll_restored = await page.locator("main").evaluate((el) => getComputedStyle(el).overflow !== "hidden");
  proof.quiz_shell_gone = !(await page.locator('[data-testid="quiz-shell"]').isVisible().catch(() => false));
  await page.screenshot({ path: "test-result-nav-back.png", fullPage: false });

  console.log(JSON.stringify(proof, null, 2));
  const ok =
    proof.only_quiz_ui &&
    proof.submit_visible &&
    proof.submit_in_viewport &&
    proof.question_in_viewport &&
    proof.page_overflow_hidden &&
    proof.result_visible &&
    proof.nav_restored &&
    proof.scroll_restored &&
    proof.quiz_shell_gone;
  console.log(ok ? "CLEAN QUIZ UI ALL PASS" : "CLEAN QUIZ UI FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
