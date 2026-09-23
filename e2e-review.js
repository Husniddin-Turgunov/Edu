/* Attempt review E2E: blocked history → scroll panel with selected + correct answers */
const { chromium } = require("playwright");
const { encode } = require("next-auth/jwt");

const SECRET = process.env.NEXTAUTH_SECRET || "akela-onboarding-secret-key-2024";

const questions = [
  {
    id: "q1",
    text: "2 + 2 = ?",
    type: "single",
    points: 1,
    order: 0,
    explanation: "Oddiy qo'shish",
    correctAnswer: null,
    selected: "c-wrong",
    choices: [
      { id: "c-wrong", text: "3", order: 0, isCorrect: false },
      { id: "c-right", text: "4", order: 1, isCorrect: true },
    ],
  },
  {
    id: "q2",
    text: "Yozma javob savoli",
    type: "written",
    points: 1,
    order: 1,
    explanation: null,
    correctAnswer: "To'g'ri matn",
    selected: "Mening javobim",
    choices: [],
  },
];

const reviewFixture = {
  result: {
    id: "r1",
    score: 50,
    passed: false,
    completedAt: "2026-09-23T10:00:00.000Z",
    gradingStatus: "auto",
  },
  test: { id: "t1", title: "Matematika testi", passScore: 60, maxAttempts: 1 },
  attemptCount: 1,
  revealCorrect: true,
  questions,
};

(async () => {
  const token = await encode({
    token: {
      name: "Student",
      email: "student@akelagroup.com",
      sub: "u1",
      role: "student",
      id: "u1",
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
      url: "http://127.0.0.1:3000",
      httpOnly: false,
      sameSite: "Lax",
      secure: false,
    },
  ]);

  const page = await context.newPage();
  const reviewCalls = [];

  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        user: { id: "u1", email: "student@akelagroup.com", name: "Student", role: "student" },
        expires: "2099-01-01T00:00:00.000Z",
      },
    })
  );

  // Blocked test load (attempts exhausted)
  await page.route("**/api/tests/t1", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    route.fulfill({
      status: 403,
      json: {
        ok: false,
        blocked: true,
        attempts: 1,
        error: "Urinishlar tugadi (1 marta)",
      },
    });
  });

  await page.route("**/api/tests/history*", (route) =>
    route.fulfill({
      json: {
        ok: true,
        results: [
          {
            id: "r1",
            score: 50,
            passed: false,
            answers: '{"q1":"c-wrong","q2":"Mening javobim"}',
            completedAt: "2026-09-23T10:00:00.000Z",
            createdAt: "2026-09-23T10:00:00.000Z",
            startedAt: "2026-09-23T09:50:00.000Z",
          },
        ],
      },
    })
  );

  await page.route("**/api/tests/t1/review*", (route) => {
    reviewCalls.push(route.request().url());
    route.fulfill({ json: { ok: true, review: reviewFixture } });
  });

  await page.goto("http://127.0.0.1:3000/tests/t1", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.getByTestId("history-list").waitFor({ state: "visible", timeout: 20000 });

  const results = [];
  const assert = (name, ok) => {
    results.push({ name, ok });
    console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  };

  assert("blocked heading", await page.getByText("Urinishlar tugadi").first().isVisible());
  assert("history list", await page.getByTestId("history-list").isVisible());
  assert("history review button", await page.getByTestId("history-review-btn").first().isVisible());

  // Open latest review
  await page.getByTestId("open-latest-review").click();
  await page.getByTestId("review-panel").waitFor({ state: "visible", timeout: 5000 });
  assert("review panel open", true);
  assert("review API called", reviewCalls.length > 0);

  // Scroll container exists
  const scrollable = await page.getByTestId("review-scroll").evaluate((el) => {
    return {
      overflowY: getComputedStyle(el).overflowY,
      scrollable: el.scrollHeight > el.clientHeight || el.scrollHeight > 200,
      questionCount: el.querySelectorAll('[data-testid="review-question"]').length,
    };
  });
  assert("scroll container overflow-y", scrollable.overflowY === "auto" || scrollable.overflowY === "scroll");
  assert("questions rendered", scrollable.questionCount === 2);

  // Selected vs correct badges
  const choices = await page.getByTestId("review-choice").evaluateAll((els) =>
    els.map((el) => ({
      selected: el.getAttribute("data-selected"),
      correct: el.getAttribute("data-correct"),
      text: (el.textContent || "").trim(),
    }))
  );
  const wrongSelected = choices.find((c) => c.selected === "1" && c.correct === "0");
  const rightCorrect = choices.find((c) => c.correct === "1");
  assert("wrong selected marked", !!wrongSelected);
  assert("correct choice marked", !!rightCorrect);
  assert("badge Siz visible", await page.getByTestId("badge-selected").first().isVisible());
  assert("badge To'g'ri visible", await page.getByTestId("badge-correct").first().isVisible());

  // Written answer shown
  assert("written answer shown", await page.getByTestId("review-written-answer").isVisible());

  // Actual scroll works
  await page.getByTestId("review-scroll").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const scrolled = await page.getByTestId("review-scroll").evaluate((el) => el.scrollTop > 0);
  assert("panel scrolled", scrolled);

  // Close
  await page.getByTestId("review-close").click();
  await page.getByTestId("review-panel").waitFor({ state: "hidden", timeout: 3000 });
  assert("panel closed", true);

  await page.screenshot({ path: "attempt-review.png", fullPage: false });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
