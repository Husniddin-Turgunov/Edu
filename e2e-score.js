const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route("**/api/auth/session", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { name: "Test" }, expires: "2099-01-01" }) }));
  const questions = [
    { id: "q1", text: "1-savol?", type: "choice", points: 1, choices: [
      { id: "c1", text: "A", order: 0 }, { id: "c2", text: "B", order: 1, isCorrect: true }
    ]},
    { id: "q2", text: "2-savol?", type: "choice", points: 5, choices: [
      { id: "c3", text: "A", order: 0, isCorrect: true }, { id: "c4", text: "B", order: 1 }
    ]},
    { id: "q3", text: "3-savol?", type: "choice", points: 2, choices: [
      { id: "c5", text: "A", order: 0 }, { id: "c6", text: "B", order: 1, isCorrect: true }
    ]}
  ];
  await page.route("**/api/tests/att1", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, test: { id: "att1", title: "Foiz testi", passScore: 70, maxAttempts: 0, timeLimit: null, description: "", questions, shuffleQuestions: false } }) }));
  await page.route("**/api/tests/history**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, results: [] }) }));
  await page.route("**/api/tests/att1/submit", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, result: { id: "r1", score: 100, passed: true } }) }));

  await page.goto("http://localhost:3000/tests/att1", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector('[data-testid="current-question"]', { timeout: 15000 });

  const proof = {};
  const qCards = await page.locator('[data-testid="current-question"]').count();
  proof.one_question_visible = qCards === 1;
  proof.step_label_q1 = ((await page.locator('[data-testid="step-label"]').textContent()) || "").trim();
  proof.q1_visible = await page.getByText("1-savol?").isVisible();
  proof.q2_hidden = !(await page.getByText("2-savol?").isVisible().catch(() => false));

  // next -> q2 (force click to bypass overlay)
  await page.locator('[data-testid="next-btn"]').click({ force: true });
  await page.waitForTimeout(300);
  proof.step_label_q2 = ((await page.locator('[data-testid="step-label"]').textContent()) || "").trim();
  proof.q2_visible = await page.getByText("2-savol?").isVisible();
  proof.q1_gone = !(await page.getByText("1-savol?").isVisible().catch(() => false));

  // prev -> q1
  await page.locator('[data-testid="prev-btn"]').click({ force: true });
  await page.waitForTimeout(300);
  proof.step_label_back = ((await page.locator('[data-testid="step-label"]').textContent()) || "").trim();

  // answer all correct inside current-question card only
  const pick = async (label) => {
    const card = page.locator('[data-testid="current-question"]');
    await card.getByRole("button", { name: new RegExp("^" + label) }).first().click({ force: true });
    await page.waitForTimeout(200);
  };
  await pick("B"); // q1
  proof.after_q1 = ((await page.locator('[data-testid="answered-count"]').textContent()) || "").trim();
  await page.locator('[data-testid="next-btn"]').click({ force: true });
  await page.waitForTimeout(250);
  await pick("A"); // q2
  await page.locator('[data-testid="next-btn"]').click({ force: true });
  await page.waitForTimeout(250);
  await pick("B"); // q3
  await page.waitForTimeout(300);

  proof.answered = ((await page.locator('[data-testid="answered-count"]').textContent()) || "").trim();
  proof.progress_full = await page.locator('[data-testid="progress-bar"]').evaluate((el) => el.style.width);
  proof.step_label_final = ((await page.locator('[data-testid="step-label"]').textContent()) || "").trim();

  // submit
  await page.locator('[data-testid="submit-btn"]').click({ force: true });
  await page.waitForSelector('[data-testid="confirm-modal"]', { timeout: 8000 });
  proof.confirm_open = await page.locator('[data-testid="confirm-modal"]').isVisible();
  await page.locator('[data-testid="confirm-submit"]').click({ force: true });
  await page.waitForSelector('[data-testid="result-panel"]', { timeout: 10000 });
  const panelText = ((await page.locator('[data-testid="result-panel"]').textContent()) || "");
  proof.result_has_100 = panelText.includes("100%");
  proof.result_passed = panelText.includes("Tabriklaymiz");
  await page.screenshot({ path: "score-100-proof.png", fullPage: false });

  console.log(JSON.stringify(proof, null, 2));
  const ok =
    proof.one_question_visible &&
    proof.q2_hidden &&
    proof.step_label_q1.includes("1 / 3") &&
    proof.step_label_q2.includes("2 / 3") &&
    proof.q1_gone &&
    proof.step_label_back.includes("1 / 3") &&
    proof.answered.includes("3/3") &&
    proof.progress_full === "100%" &&
    proof.confirm_open &&
    proof.result_has_100 &&
    proof.result_passed;
  console.log(ok ? "E2E ALL PASS" : "E2E FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
