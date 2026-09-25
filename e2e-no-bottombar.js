const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route("**/api/auth/session", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { name: "T" }, expires: "2099-01-01" }) }));
  const questions = [
    { id: "q1", text: "Savol 1?", type: "choice", points: 1, choices: [{ id: "c1", text: "A", order: 0, isCorrect: true }, { id: "c2", text: "B", order: 1 }] },
    { id: "q2", text: "Savol 2?", type: "choice", points: 1, choices: [{ id: "c3", text: "A", order: 0 }, { id: "c4", text: "B", order: 1, isCorrect: true }] }
  ];
  await page.route("**/api/tests/att1", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, test: { id: "att1", title: "T", passScore: 70, maxAttempts: 0, timeLimit: null, description: "", questions, shuffleQuestions: false } }) }));
  await page.route("**/api/tests/history**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, results: [] }) }));
  await page.route("**/api/tests/att1/submit", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, result: { id: "r", score: 100, passed: true } }) }));
  await page.goto("http://localhost:3000/tests/att1", { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector('[data-testid="quiz-shell"]', { timeout: 20000 });
  const proof = {};
  proof.no_chiqish = !(await page.getByText("Chiqish").isVisible().catch(() => false));
  proof.no_bekor = !(await page.getByText("Bekor qilish").isVisible().catch(() => false));
  proof.no_javobsiz_bar = !(await page.getByText(/javobsiz/).isVisible().catch(() => false));
  proof.no_bottom_bar = !(await page.getByText("Barcha savollarga javob berildi").isVisible().catch(() => false));
  proof.no_submit_yet = !(await page.locator('[data-testid="submit-btn"], [data-testid="submit-btn-center"]').first().isVisible().catch(() => false));
  await page.locator('[data-testid="current-question"] button').filter({ hasText: "A" }).first().click({ force: true });
  await page.waitForTimeout(200);
  proof.q1_submit_hidden = !(await page.locator('[data-testid="submit-btn"], [data-testid="submit-btn-center"]').first().isVisible().catch(() => false));
  await page.locator('[data-testid="next-btn"]').click({ force: true });
  await page.waitForTimeout(300);
  await page.locator('[data-testid="current-question"] button').filter({ hasText: "B" }).first().click({ force: true });
  await page.waitForTimeout(300);
  proof.submit_appears = await page.locator('[data-testid="submit-btn-center"]').isVisible().catch(() => false);
  await page.screenshot({ path: "test-no-bottombar.png", fullPage: false });
  if (proof.submit_appears) {
    await page.locator('[data-testid="submit-btn-center"]').click({ force: true });
    await page.waitForSelector('[data-testid="confirm-modal"]', { timeout: 8000 });
    proof.confirm_ok = await page.locator('[data-testid="confirm-submit"]').isVisible();
    await page.locator('[data-testid="confirm-submit"]').click({ force: true });
    await page.waitForSelector('[data-testid="result-panel"]', { timeout: 10000 });
    proof.result_ok = await page.locator('[data-testid="result-panel"]').isVisible();
  }
  console.log(JSON.stringify(proof, null, 2));
  const ok = proof.no_chiqish && proof.no_bekor && proof.no_javobsiz_bar && proof.no_submit_yet && proof.q1_submit_hidden && proof.submit_appears && proof.confirm_ok && proof.result_ok;
  console.log(ok ? "NO BOTTOMBAR ALL PASS" : "NO BOTTOMBAR FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
