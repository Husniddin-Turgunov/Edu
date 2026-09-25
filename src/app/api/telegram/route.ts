import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  sendMessage,
  sendInlineKeyboard,
  answerCallbackQuery,
  editMessageText,
  getMe,
  getWebhookInfo,
  setWebhook,
  escapeHtml,
  registerSubscriber,
  subscriberCount,
  broadcast,
  type InlineButton,
} from "@/lib/telegram-bot";
import { renderResultCardPng, levelForScore } from "@/lib/result-card";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const prisma = new PrismaClient();

/**
 * Telegram Bot webhook — AKELA GROUP
 *
 * ⚠️ Botda "admin" tushunchasi YO'Q: botga ulangan har bir odam bir xil
 * xabarlarni oladi va tugmalar hamma uchun ishlaydi.
 */

// ====== Inline menyu — barcha buyruqlar suhbatdagi tugmalar orqali ishlaydi ======

/** Doimiy inline menyu tugmalari (har bir javobga biriktiriladi) */
function mainMenu(): InlineButton[][] {
  return [
    [
      { text: "📊 Statistika", callback_data: "menu:stats" },
      { text: "👥 Foydalanuvchilar", callback_data: "menu:users" },
    ],
    [
      { text: "⏳ Kutilayotgan", callback_data: "menu:pending" },
      { text: "📝 Testlar", callback_data: "menu:tests" },
    ],
    [
      { text: "ℹ️ Yordam", callback_data: "menu:help" },
      { text: "🔄 Yangilash", callback_data: "menu:refresh" },
    ],
  ];
}

/**
 * Eski (avvalgi versiyada yuborilgan) doimiy reply-klaviatura mijozda saqlanib
 * qoladi va uni bosganda oddiy MATN keladi (callback emas). Shu matnlarni
 * bo'limlarga aylantiramiz, klaviaturani esa bir marta olib tashlaymiz.
 */
const keyboardCleaned = new Set<number>();

async function ensureNoOldKeyboard(chatId: number) {
  if (!chatId || keyboardCleaned.has(chatId)) return;
  keyboardCleaned.add(chatId);
  try {
    await sendMessage(chatId, "⌨️ Klaviatura yangilandi — barcha tugmalar endi xabar ichida.", {
      reply_markup: { remove_keyboard: true },
    });
  } catch {
    /* muhim emas */
  }
}

/** Matn (tugma yozuvi yoki /buyruq) ni menyu bo'limiga aylantiradi */
function sectionFromText(text: string): string | null {
  const key = String(text || "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
  const map: Record<string, string> = {
    statistika: "stats",
    статистика: "stats",
    foydalanuvchilar: "users",
    пользователи: "users",
    kutilayotgan: "pending",
    ожидают: "pending",
    testlar: "tests",
    тесты: "tests",
    yordam: "help",
    помощь: "help",
    yangilash: "refresh",
    menyu: "home",
    бошменю: "home",
  };
  return map[key] || null;
}

/** Bo'limni matn + inline tugmalar bilan yuborish (yuborilganini qaytaradi) */
async function sendSection(chatId: number, section: string) {
  const { text, buttons } = await menuSection(section);
  return sendMessage(chatId, text, { reply_markup: buttons });
}

const HELP_TEXT = [
  "ℹ️ <b>AKELA GROUP bot — yordam</b>",
  "ℹ️ <b>AKELA GROUP bot — yordam</b>",
  "",
  "Barcha bo'limlar pastdagi <b>tugmalar</b> orqali ochiladi:",
  "📊 Statistika — umumiy raqamlar",
  "👥 Foydalanuvchilar — oxirgi 10 ta yozilgan",
  "⏳ Kutilayotgan — tasdiqlash kutayotganlar",
  "📝 Testlar — faol testlar",
  "🔄 Yangilash — ma'lumotlarni yangilash",
  "",
  "Matn ko'rinishida ham ishlaydi:",
  "/start — ulanish va menyu",
  "/help — shu yordam",
  "/stats — statistika",
  "/users — foydalanuvchilar",
  "/pending — kutilayotganlar",
  "/tests — testlar ro'yxati",
  "",
  "Test topshirganda natija rasm kartochka + yozma shaklda keladi.",
].join("\n");

async function statsText(): Promise<string> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [totalUsers, approved, pending, tests, dayResults] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "approved" } }),
    prisma.user.count({ where: { status: "pending" } }),
    prisma.test.count({ where: { status: "active" } }),
    prisma.testResult.count({ where: { startedAt: { gte: dayAgo } } }),
  ]);
  const latest = await prisma.testResult.findFirst({
    orderBy: { startedAt: "desc" },
    include: {
      user: { select: { name: true, surname: true, email: true } },
      test: { select: { title: true } },
    },
  });
  const latestLine = latest
    ? `Oxirgi natija: <b>${escapeHtml(latest.test?.title || "?")}</b> — ${escapeHtml(
        [latest.user?.surname, latest.user?.name].filter(Boolean).join(" ") || latest.user?.email || "?",
      )} (${latest.score ?? 0}%)`
    : "Hozircha natijalar yo'q";
  return [
    "📊 <b>AKELA GROUP — umumiy statistika</b>",
    "",
    `👥 Foydalanuvchilar: <b>${totalUsers}</b> (tasdiqlangan: ${approved}, kutilmoqda: ${pending})`,
    `📝 Faol testlar: <b>${tests}</b>`,
    `⏱ So'nggi 24 soatda topshirishlar: <b>${dayResults}</b>`,
    "",
    latestLine,
  ].join("\n");
}

async function usersText(): Promise<string> {
  const list = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { name: true, surname: true, email: true, status: true, createdAt: true },
  });
  const icon = (s: string) => (s === "approved" ? "✅" : s === "pending" ? "⏳" : "⛔");
  if (!list.length) return "👥 Hozircha foydalanuvchilar yo'q.";
  return [
    "👥 <b>Oxirgi 10 ta foydalanuvchi</b>",
    "",
    ...list.map(
      (u, i) =>
        `${i + 1}. ${icon(u.status)} ${escapeHtml(
          [u.surname, u.name].filter(Boolean).join(" ") || u.email,
        )} — ${u.status}`,
    ),
    "",
    `Jami: ${await prisma.user.count()} ta`,
  ].join("\n");
}

/** Tasdiqlash kutayotgan foydalanuvchilar: matn + inline tugmalar (ruxsat/rad etish) */
async function pendingSection(): Promise<{ text: string; buttons: InlineButton[][] }> {
  const list = await prisma.user.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: { id: true, name: true, surname: true, email: true, department: true },
  });
  if (!list.length) {
    return { text: "⏳ Tasdiqlash kutayotgan foydalanuvchi yo'q.", buttons: mainMenu() };
  }
  const lines: string[] = ["⏳ <b>Tasdiqlash kutmoqda</b>", ""];
  for (const u of list) {
    const fullName = [u.surname, u.name].filter(Boolean).join(" ") || u.email;
    lines.push(`👤 <b>${escapeHtml(fullName)}</b>`);
    lines.push(`📧 ${escapeHtml(u.email)}`);
    if (u.department) lines.push(`🏢 ${escapeHtml(u.department)}`);
    lines.push("");
  }
  lines.push("👇 Pastdagi tugmalar orqali ruxsat bering yoki rad eting:");
  const buttons: InlineButton[][] = list.map((u) => [
    {
      text: `✅ ${[u.surname, u.name].filter(Boolean).join(" ") || u.email}`,
      callback_data: `approve:${u.id}`,
    },
    { text: "❌ Rad etish", callback_data: `reject:${u.id}` },
  ]);
  // Har doim asosiy menyuga qaytish tugmasi bo'lsin
  buttons.push([{ text: "⬅️ Asosiy menyu", callback_data: "menu:home" }]);
  return { text: lines.join("\n"), buttons };
}

async function testsText(): Promise<string> {
  const list = await prisma.test.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { title: true, passScore: true, _count: { select: { questions: true } } },
  });
  if (!list.length) return "📝 Faol testlar yo'q.";
  return [
    "📝 <b>Faol testlar</b>",
    "",
    ...list.map(
      (t, i) =>
        `${i + 1}. ${escapeHtml(t.title)} — ${t._count.questions} savol, o'tish: ${t.passScore}%`,
    ),
  ].join("\n");
}

/** Menyu bo'limi matni + inline tugmalar (callback tugma bosilganda) */
async function menuSection(section: string): Promise<{ text: string; buttons: InlineButton[][] }> {
  switch (section) {
    case "stats":
      return { text: await statsText(), buttons: mainMenu() };
    case "users":
      return { text: await usersText(), buttons: mainMenu() };
    case "pending":
      return pendingSection();
    case "tests":
      return { text: await testsText(), buttons: mainMenu() };
    case "help":
      return { text: HELP_TEXT, buttons: mainMenu() };
    case "home":
    case "refresh":
    default:
      return { text: await statsText(), buttons: mainMenu() };
  }
}

// ====== GET: webhook sozlash / bot info / obunachilar / kartochka sinovi ======
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "set-webhook") {
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "https";
    const webhookUrl = `${protocol}://${host}/api/telegram`;
    const result = await setWebhook(webhookUrl);
    return NextResponse.json({ ok: true, webhookUrl, result });
  }

  if (action === "webhook-info") {
    const info = await getWebhookInfo();
    return NextResponse.json({ ok: true, info: info?.result });
  }

  if (action === "bot-info") {
    const me = await getMe();
    return NextResponse.json({ ok: true, bot: me?.result });
  }

  if (action === "subscribers") {
    const [count, list] = await Promise.all([
      subscriberCount(),
      prisma.botSubscriber.findMany({
        orderBy: { createdAt: "desc" },
        select: { chatId: true, name: true, username: true, isActive: true, createdAt: true },
      }),
    ]);
    return NextResponse.json({ ok: true, count, subscribers: list });
  }

  // Rasm (natija kartochkasi) sinovi — brauzerda ochib ko'rish mumkin
  if (action === "test-card") {
    try {
      const png = await renderResultCardPng(
        {
          fullName: searchParams.get("name") || "Dilnoza Karimova",
          department: searchParams.get("department") || "Отдел Маркетинга AGM/103/08",
          testTitle: searchParams.get("test") || "Kommunikatsiya ko'nikmalari",
          score: Number(searchParams.get("score") || 87),
          passScore: Number(searchParams.get("pass") || 70),
          passed: true,
          level: levelForScore(Number(searchParams.get("score") || 87)),
          completedAt: new Date(),
        },
        new URL(req.url).origin,
      );
      return new NextResponse(png, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-store",
        },
      });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.message || "render error" }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    message: "Telegram Bot Webhook — AKELA GROUP (adminsiz, hamma teng)",
    endpoints: {
      "GET ?action=set-webhook": "Webhookni sozlash",
      "GET ?action=webhook-info": "Webhook holati",
      "GET ?action=bot-info": "Bot haqida ma'lumot",
      "GET ?action=subscribers": "Botga ulanganlar ro'yxati",
      "GET ?action=test-card": "Natija kartochkasi (PNG) sinovi",
      "POST": "Webhook handler (Telegram dan keladi)",
    },
  });
}

// ====== POST: webhook handler ======
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.callback_query) {
      await handleCallbackQuery(body.callback_query);
      return NextResponse.json({ ok: true });
    }

    if (body.message) {
      await handleMessage(body.message);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Telegram webhook error:", error?.message || error);
    // Telegram qayta urinmasligi uchun baribir 200 qaytaramiz
    return NextResponse.json({ ok: true });
  }
}

// ====== Xabar handler ======
async function handleMessage(msg: any) {
  const chatId: number = msg.chat?.id;
  if (!chatId) return;
  const text: string = (msg.text || "").trim();
  const firstName: string = msg.from?.first_name || "";

  // Kim yozsa — obunachilarga qo'shamiz (saytda akkaunti bo'lishi shart emas)
  await registerSubscriber({
    chatId,
    firstName,
    lastName: msg.from?.last_name,
    username: msg.from?.username,
  });

  if (!text) return;

  // Eski reply-klaviatura tugmalari ("📊 Statistika" kabi) yoki erkin matn
  if (!text.startsWith("/")) {
    await ensureNoOldKeyboard(chatId);
    const section = sectionFromText(text);
    if (section) {
      const sent: any = await sendSection(chatId, section);
      console.log("[telegram] text->section", JSON.stringify({ text, section, sent: sent?.ok }));
      return;
    }
    // Tushunilmagan matn — baribir inline menyu bilan javob qaytaramiz
    const { text: menuText, buttons } = await menuSection("home");
    const sent: any = await sendMessage(
      chatId,
      `${menuText}\n\n❓ "<b>${escapeHtml(text)}</b>" tushunilmadi. Pastdagi tugmalardan foydalaning.`,
      { reply_markup: buttons },
    );
    console.log("[telegram] text->menu(home)", JSON.stringify({ text, sent: sent?.ok }));
    return;
  }

  // /start — inline klaviyatura (DOM menyusi) bilan, hamma buyruqlar shu tugmalardan
  if (text.startsWith("/start")) {
    // Eski doimiy (reply) klaviatura bo'lsa — uni olib tashlaymiz
    await ensureNoOldKeyboard(chatId);
    const total = await subscriberCount();
    await sendMessage(
      chatId,
      [
        `Salom, <b>${escapeHtml(firstName || "do'st")}</b>! 👋`,
        "",
        "🎓 Siz <b>AKELA GROUP</b> ta'lim portali botidasiz.",
        "",
        "📌 <b>Muhim:</b> botda admin yo'q — yangi ro'yxatdan o'tganlar va test",
        "natijalari haqidagi xabarlar <b>botga ulangan barcha</b> foydalanuvchilarga",
        "bir xil yuboriladi.",
        "",
        `👥 Hozir botga ulanganlar: <b>${total}</b>`,
        "",
        "📋 Hamma bo'limlar quyidagi <b>inline tugmalar</b> orqali ochiladi:",
      ].join("\n"),
      { reply_markup: mainMenu() },
    );
    return;
  }

  // /help — inline klaviyatura bilan
  if (text.startsWith("/help")) {
    await sendMessage(
      chatId,
      [
        "📖 <b>Yordam</b>",
        "",
        "📊 Statistika — umumiy raqamlar",
        "👥 Foydalanuvchilar — oxirgi 10 ta yozilgan",
        "⏳ Kutilayotgan — tasdiqlash kutayotganlar (ruxsat/rad etish tugmalari)",
        "📝 Testlar — faol testlar",
        "🔄 Yangilash — ma'lumotlarni yangilash",
        "",
        "🔔 Yangi foydalanuvchi yoki test natijasi haqidagi xabarlar barcha",
        "obunachilarga avtomatik yuboriladi.",
      ].join("\n"),
      { reply_markup: mainMenu() },
    );
    return;
  }

  // /stats
  if (text.startsWith("/stats")) {
    const [totalUsers, approvedUsers, pendingUsers, rejectedUsers, totalTests, totalResults, subs] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { status: "approved" } }),
        prisma.user.count({ where: { status: "pending" } }),
        prisma.user.count({ where: { status: "rejected" } }),
        prisma.test.count(),
        prisma.testResult.count({ where: { completedAt: { not: null } } }),
        subscriberCount(),
      ]);

    await sendMessage(
      chatId,
      [
        "📊 <b>AKELA GROUP — Statistika</b>",
        "",
        "👥 <b>Foydalanuvchilar:</b>",
        `   Jami: ${totalUsers}`,
        `   Tasdiqlangan: ${approvedUsers}`,
        `   Kutilayotgan: ${pendingUsers}`,
        `   Rad etilgan: ${rejectedUsers}`,
        "",
        `📝 <b>Testlar:</b> ${totalTests}`,
        `📋 <b>Topshirishlar:</b> ${totalResults}`,
        `🤖 <b>Bot obunachilari:</b> ${subs}`,
      ].join("\n"),
    );
    return;
  }

  // /users
  if (text.startsWith("/users")) {
    const users = await prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: { name: true, surname: true, email: true, status: true, department: true },
    });

    const statusIcon = (s: string) =>
      s === "approved" ? "✅" : s === "rejected" ? "❌" : "⏳";

    const list = users
      .map((u, i) => {
        const full = [u.surname, u.name].filter(Boolean).join(" ") || u.email;
        return `${i + 1}. <b>${escapeHtml(full)}</b> — ${statusIcon(u.status)} ${escapeHtml(u.department || "bo'lim yo'q")}`;
      })
      .join("\n");

    await sendMessage(
      chatId,
      ["👥 <b>Foydalanuvchilar (oxirgi 10):</b>", "", list || "Yo'q"].join("\n"),
    );
    return;
  }

  // /pending — inline tugmalar bilan (ruxsat/rad etish)
  if (text.startsWith("/pending")) {
    const { text: msg, buttons } = await pendingSection();
    await sendMessage(chatId, msg, { reply_markup: buttons });
    return;
  }

  // /tests
  if (text.startsWith("/tests")) {
    const tests = await prisma.test.findMany({
      take: 7,
      orderBy: { createdAt: "desc" },
      select: {
        title: true,
        status: true,
        passScore: true,
        _count: { select: { questions: true, results: true } },
      },
    });

    const list = tests
      .map(
        (t, i) =>
          `${i + 1}. <b>${escapeHtml(t.title)}</b> — ${t.status === "active" ? "✅ faol" : "📝 " + escapeHtml(t.status)} (${t._count.questions} savol, ${t._count.results} topshirish, o'tish: ${t.passScore}%)`,
      )
      .join("\n");

    await sendMessage(chatId, ["📝 <b>Testlar (oxirgi 7):</b>", "", list || "Yo'q"].join("\n"));
    return;
  }

  // Noma'lum buyruq
  await sendMessage(
    chatId,
    `❓ Noma'lum buyruq: ${escapeHtml(text)}\n\nYordam uchun /help yozing.`,
  );
}

// ====== Callback query handler (ruxsat / rad etish tugmalari) ======

async function handleCallbackQuery(cq: any) {
  const chatId: number = cq.message?.chat?.id;
  const messageId: number = cq.message?.message_id;
  const data: string = cq.data || "";
  const pressedBy: string = [cq.from?.first_name, cq.from?.last_name].filter(Boolean).join(" ");

  // ====== Inline menyu tugmalari — barcha buyruqlar shu tugmalardan yuboriladi ======
  if (data.startsWith("menu:")) {
    const section = data.slice("menu:".length);
    await answerCallbackQuery(cq.id);
    if (chatId && messageId) {
      const { text, buttons } = await menuSection(section);
      const edited: any = await editMessageText(chatId, messageId, text, {
        parse_mode: "HTML",
        reply_markup: buttons,
      });
      // Tahrirlash imkoni bo'lmasa (juda eski xabar va h.k.) — yangi xabar yuboramiz
      if (!edited?.ok && !String(edited?.description || "").includes("not modified")) {
        await sendMessage(chatId, text, { reply_markup: buttons });
      }
      console.log(
        "[telegram] callback->menu",
        JSON.stringify({ data, edited: edited?.ok, desc: edited?.description }),
      );
    }
    return;
  }

  const isApprove = data.startsWith("approve") || data.startsWith("appr:");
  const isReject = data.startsWith("reject") || data.startsWith("rej:");

  // user id bilan (yangi format) yoki email bilan (eski xabarlar) topamiz
  const raw = data.replace(/^(approve|reject|appr|rej):?/, "");
  let user = null as null | {
    id: string;
    email: string;
    name: string | null;
    surname: string | null;
    department: string | null;
    status: string;
  };

  try {
    user = raw.includes("@")
      ? await prisma.user.findUnique({
          where: { email: raw },
          select: { id: true, email: true, name: true, surname: true, department: true, status: true },
        })
      : await prisma.user.findUnique({
          where: { id: raw },
          select: { id: true, email: true, name: true, surname: true, department: true, status: true },
        });
  } catch {
    user = null;
  }

  if (!user) {
    await answerCallbackQuery(cq.id, "Foydalanuvchi topilmadi");
    return;
  }

  const fullName = [user.surname, user.name].filter(Boolean).join(" ") || user.email;
  const nextStatus = isApprove ? "approved" : "rejected";

  // Allaqachon shu holatda bo'lsa — qayta yozmaymiz
  if (user.status !== nextStatus) {
    await prisma.user.update({
      where: { id: user.id },
      data: isApprove
        ? { status: "approved", approvedAt: new Date() }
        : { status: "rejected" },
    });
  }

  await answerCallbackQuery(
    cq.id,
    isApprove ? `✅ ${fullName} ruxsat berildi` : `❌ ${fullName} rad etildi`,
  );

  // Tasdiqlash/rad etishdan keyin — tugmalarni yangilab, qolgan
  // kutilayotganlarni ko'rsatib, inline menyuni qo'LLIB turadi.
  if (chatId && messageId) {
    const { text, buttons } = await pendingSection();
    await editMessageText(chatId, messageId, text, { parse_mode: "HTML", reply_markup: buttons });
  }

  // Botga ulanganlarga ham qisqa xabar (bir xil ma'lumot)
  await broadcast({
    text: isApprove
      ? `✅ <b>${escapeHtml(fullName)}</b> tasdiqlandi (ruxsat berildi).`
      : `❌ <b>${escapeHtml(fullName)}</b> rad etildi.`,
  });
}

