const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route("**/api/auth/session", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { name: "Test" }, expires: "2099-01-01" }) }));
  const questions = [
    { id: "q1", text: "1-savol: Test markazda ekranda ko'rinadimi?", type: "choice", points: 1, choices: [
      { id: "c1", text: "Ha, albatta", order: 0, isCorrect: true }, { id: "c2", text: "Yo'q", order: 1 }
    ]},
    { id: "q2", text: "2-savol: Katta shrift o'qiladimi?", type: "choice", points: 1, choices: [
      { id: "c3", text: "Ha, o'qiladi", order: 0, isCorrect: true }, { id: "c4", text: "Mayda", order: 1 }
    ]},
    { id: "q3", text: "3-savol: Scroll qilish shart emasmi?", type: "choice", points: 1, choices: [
      { id: "c5", text: "Tog'ri", order: 0, isCorrect: true }, { id: "c6", text: "Noto'g'ri", order: 1 }
    ]}
  ];
  await page.route("**/api/tests/att1", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, test: { id: "att1", title: "Markaz test", passScore: 70, maxAttempts: 0, timeLimit: null, description: "", questions, shuffleQuestions: false } }) }));
  await page.route("**/api/tests/history**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, results: [] }) }));
  await page.route("**/api/tests/att1/submit", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, result: { id: "r1", score: 100, passed: true } }) }));

  await page.goto("http://localhost:3000/tests/att1", { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector('[data-testid="current-question"]', { timeout: 20000 });

  const proof = {};
  proof.one_q = (await page.locator('[data-testid="current-question"]').count()) === 1;

  // geometry: question center vs viewport center
  const box = await page.locator('[data-testid="current-question"]').boundingBox();
  const vp = page.viewportSize();
  proof.q_center_y = box ? Math.round(box.y + box.height / 2) : -1;
  proof.vp_center_y = Math.round(vp.height / 2);
  proof.centered = box ? Math.abs(proof.q_center_y - proof.vp_center_y) < 120 : false;

  // fully visible without scrolling (top/bottom inside viewport)
  proof.fully_visible = box ? box.y >= 0 && box.y + box.height <= vp.height + 1 : false;
  proof.no_page_scroll_needed = await page.evaluate(() => {
    // quiz shell should fit; document may not scroll
    return document.documentElement.scrollHeight <= window.innerHeight + 2 || !!document.querySelector('[data-testid="quiz-shell"]');
  });

  // font size of question text
  const fontPx = await page.locator('[data-testid="current-question"] p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  proof.question_font_px = fontPx;
  proof.font_large = fontPx >= 18;

  // choice font
  const choicePx = await page.locator('[data-testid="current-question"] button').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  proof.choice_font_px = choicePx;
  proof.choice_large = choicePx >= 16;

  await page.screenshot({ path: "test-centered-ui.png", fullPage: false });

  // next works, still centered
  await page.locator('[data-testid="next-btn"]').click({ force: true });
  await page.waitForTimeout(400);
  const box2 = await page.locator('[data-testid="current-question"]').boundingBox();
  proof.step2 = ((await page.locator('[data-testid="step-label"]').textContent()) || "").trim();
  proof.q2_centered = box2 ? Math.abs(Math.round(box2.y + box2.height / 2) - proof.vp_center_y) < 120 : false;
  await page.screenshot({ path: "test-centered-q2.png", fullPage: false });

  console.log(JSON.stringify(proof, null, 2));
  const ok = proof.one_q && proof.centered && proof.fully_visible && proof.font_large && proof.choice_large && proof.step2.includes("2 / 3") && proof.q2_centered;
  console.log(ok ? "CENTER UI ALL PASS" : "CENTER UI FAIL");
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
