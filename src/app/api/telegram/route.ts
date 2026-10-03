import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  sendMessage,
  sendInlineKeyboard,
  sendPhoto,
  sendPhotoUrl,
  sendDocumentBuffer,
  answerCallbackQuery,
  editMessageText,
  editMessageCaption,
  deleteMessage,
  getMe,
  getWebhookInfo,
  setWebhook,
  escapeHtml,
  registerSubscriber,
  subscriberCount,
  broadcast,
  verifyWebhookSecret,
  notifyAdminError,
  type InlineButton,
} from "@/lib/telegram-bot";
import { renderResultCardPng, levelForScore } from "@/lib/result-card";
import { computeResultStats } from "@/lib/result-stats";
import {
  buildResultReportPdf,
  buildUserReportPdf,
  resultReportFileName,
  userReportFileName,
} from "@/lib/pdf-report";
import { getSession } from "@/lib/auth";

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
 * qoladi va uni bosganda oddiy MATN keladi (callback emas).
 *
 * Nima uchun endi hech narsa yuborilmaydi:
 *  1) Eski klaviatura tugmalari allaqachon `sectionFromText()` orqali ishlaydi —
 *     demak tugma bosilsa, to'g'ri bo'lim ochiladi.
 *  2) Ilgari har bir chat uchun "⌨️ Klaviatura yangilandi" degan YANI xabar
 *     yuborilardi (har server qayta ishga tushganda, `keyboardCleaned` xotirada
 *     yo'qolgani uchun). Bu odamlar uchun shovqin edi — endi yo'q.
 */
async function ensureNoOldKeyboard(chatId: number) {
  void chatId;
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

/** Bo'limni Liquid Glass ikonka + matn + tugmalar bilan yuborish */
async function sendSection(chatId: number, section: string) {
  const { text, buttons } = await menuSection(section);
  return sendWithIcon(chatId, SECTION_ICON[section] || "apps", text, buttons);
}

const HELP_TEXT = [
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

/** Loyiha domeni — rasm va PDF havolalari shu domendan olinadi */
const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || "https://edu.akelagroup.uz").replace(/\/$/, "");

/**
 * Bo'lim -> Liquid Glass ikonka (public/icons/glass/*.png).
 * Ikonkalar Google Material Symbols dan yasaladi:
 *   node scripts/build-glass-icons.mjs
 */
const SECTION_ICON: Record<string, string> = {
  home: "apps",
  stats: "monitoring",
  users: "group",
  pending: "pending_actions",
  tests: "fact_check",
  activetests: "checklist",
  help: "info",
  refresh: "refresh",
};

function iconUrl(name: string): string {
  return `${APP_ORIGIN}/icons/glass/${name}.png`;
}

/** Telegram caption chegarasi (1024) dan past xavfsiz chegara */
const CAPTION_LIMIT = 1000;

/** Matn + inline tugmalar, tepasida Liquid Glass ikonka (rasm) bilan */
async function sendWithIcon(
  chatId: number,
  icon: string,
  text: string,
  buttons: InlineButton[][],
) {
  const fitAsCaption = text.length <= CAPTION_LIMIT;
  const res: any = await sendPhotoUrl(chatId, iconUrl(icon), fitAsCaption ? text : undefined, {
    reply_markup: buttons,
  });
  if (res?.ok) {
    // Matn caption ga sig'magan bo'lsa — tugmalar bilan alohida xabar
    if (!fitAsCaption) return sendMessage(chatId, text, { reply_markup: buttons });
    return res;
  }
  // Rasm yuborilmasa — oddiy matn sifatida davom etamiz
  return sendMessage(chatId, text, { reply_markup: buttons });
}

/**
 * Joriy xabarni yangilaydi: matn bo'lsa `editMessageText`, rasm bo'lsa
 * `editMessageCaption`; imkoni bo'lmasa eski xabarni o'chirib, yangisini
 * ikonka bilan yuboradi (chat to'planib ketmasligi uchun).
 */
async function updateSectionMessage(
  chatId: number,
  messageId: number | undefined,
  isPhoto: boolean,
  icon: string,
  text: string,
  buttons: InlineButton[][],
) {
  if (messageId) {
    if (isPhoto) {
      if (text.length <= CAPTION_LIMIT) {
        const res: any = await editMessageCaption(chatId, messageId, text, buttons);
        if (res?.ok) return res;
      }
    } else {
      const res: any = await editMessageText(chatId, messageId, text, {
        parse_mode: "HTML",
        reply_markup: buttons,
      });
      if (res?.ok) return res;
      if (String(res?.description || "").includes("not modified")) return res;
    }
    await deleteMessage(chatId, messageId);
  }
  return sendWithIcon(chatId, icon, text, buttons);
}


function shortName(name: string, max = 26) {
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

/** Test topshirganlar ro'yxati: kim necha marta topshirgan, o'rtacha ball */
async function takersSection(): Promise<{ text: string; buttons: InlineButton[][] }> {
  const rows = await prisma.testResult.findMany({
    where: { completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    take: 300,
    select: {
      userId: true,
      score: true,
      passed: true,
      user: { select: { id: true, name: true, surname: true, email: true } },
    },
  });

  const map = new Map<
    string,
    { id: string; name: string; count: number; sum: number; passed: number }
  >();
  for (const r of rows) {
    if (!r.user) continue;
    const id = r.user.id;
    const name =
      [r.user.surname, r.user.name].filter(Boolean).join(" ").trim() || r.user.email || "Noma'lum";
    const item = map.get(id) || { id, name, count: 0, sum: 0, passed: 0 };
    item.count += 1;
    item.sum += typeof r.score === "number" ? r.score : 0;
    if (r.passed) item.passed += 1;
    map.set(id, item);
  }

  const list = Array.from(map.values()).slice(0, 12);
  if (!list.length) {
    return {
      text: "📝 <b>Test topshirganlar</b>\n\nHozircha hech kim test topshirmagan.",
      buttons: mainMenu(),
    };
  }

  const lines = [
    "📝 <b>Test topshirganlar</b>",
    "",
    "Kimning natijasini ko'ramiz?",
    "",
  ];
  list.forEach((u, i) => {
    lines.push(
      `${i + 1}. <b>${escapeHtml(u.name)}</b> — ${u.count} marta topshirgan · o'rtacha <b>${Math.round(
        u.sum / u.count,
      )}%</b>`,
    );
  });

  const buttons: InlineButton[][] = list.map((u) => [
    { text: `👤 ${shortName(u.name)} (${u.count})`, callback_data: `tu:${u.id}` },
  ]);
  buttons.push([{ text: "📋 Faol testlar ro'yxati", callback_data: "menu:activetests" }]);
  buttons.push([{ text: "⬅️ Asosiy menyu", callback_data: "menu:home" }]);
  return { text: lines.join("\n"), buttons };
}

/** Bitta odam: necha marta topshirgan, jami ball, har bir natija (rasm + PDF) */
async function takerSection(
  userId: string,
): Promise<{ text: string; buttons: InlineButton[][] }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { text: "❌ Foydalanuvchi topilmadi.", buttons: mainMenu() };
  }

  const results = await prisma.testResult.findMany({
    where: { userId, completedAt: { not: null } },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: {
      test: {
        select: {
          id: true,
          title: true,
          passScore: true,
          questions: { include: { choices: true } },
        },
      },
    },
  });

  const fullName = [user.surname, user.name].filter(Boolean).join(" ").trim() || user.email;
  const scores = results.map((r) => r.score).filter((s) => typeof s === "number") as number[];
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const totalScore = scores.reduce((a, b) => a + b, 0);
  const passedCount = results.filter((r) => r.passed).length;
  const level = !scores.length
    ? "Baholanmagan"
    : avg >= 86
      ? "I daraja"
      : avg >= 70
        ? "II daraja"
        : "III daraja";

  let totalCorrect = 0;
  let totalWrong = 0;
  const perResult = results.map((r: any) => {
    const stats = computeResultStats(r.test?.questions || [], r.answers);
    totalCorrect += stats.correct;
    totalWrong += stats.wrong + stats.pending;
    return { result: r, stats };
  });

  const lines = [
    `👤 <b>${escapeHtml(fullName)}</b>`,
    user.email ? `📧 ${escapeHtml(user.email)}` : "",
    user.department ? `🏢 ${escapeHtml(user.department)}` : "",
    (user as any).position ? `💼 ${escapeHtml((user as any).position)}` : "",
    "",
    `🏅 <b>Daraja:</b> ${level} · o'rtacha ball: <b>${avg}%</b>`,
    `📊 <b>Topshirishlar:</b> ${results.length} marta · o'tgan: ${passedCount} · yig'ilgan jami ball: <b>${totalScore}%</b>`,
    `✅ <b>To'g'ri javoblar:</b> ${totalCorrect} · ❌ <b>Xato:</b> ${totalWrong}`,
    "",
    "📄 <b>Natijalar</b> (har biri uchun rasm va PDF alohida):",
    "",
  ];

  perResult.forEach((item: any, i: number) => {
    const r: any = item.result;
    const when = r.completedAt ? new Date(r.completedAt) : null;
    const p = (n: number) => String(n).padStart(2, "0");
    const dateStr = when
      ? `${p(when.getDate())}.${p(when.getMonth() + 1)}.${when.getFullYear()} ${p(
          when.getHours(),
        )}:${p(when.getMinutes())}`
      : "—";
    lines.push(
      `${i + 1}. <b>${escapeHtml(r.test?.title || "Test")}</b> — ${r.score ?? "—"}% · ${
        r.passed ? "✅ O'tdi" : "❌ Yiqildi"
      }`,
    );
    lines.push(
      `     ✅ ${item.stats.correct}/${item.stats.total} to'g'ri · ❌ ${item.stats.wrong} xato · 🕒 ${dateStr}`,
    );
  });

  if (!results.length) lines.push("Hali test topshirmagan.");

  const buttons: InlineButton[][] = perResult.map((item: any, i: number) => [
    { text: `🖼 ${i + 1}-rasm`, callback_data: `ti:${item.result.id}` },
    { text: `📄 ${i + 1}-PDF`, callback_data: `tp:${item.result.id}` },
  ]);
  buttons.push([
    { text: "📄 Umumiy PDF hisobot (barcha testlar)", callback_data: `tur:${user.id}` },
  ]);
  buttons.push([
    { text: "⬅️ Ro'yxatga qaytish", callback_data: "menu:tests" },
    { text: "🏠 Asosiy menyu", callback_data: "menu:home" },
  ]);

  return { text: lines.join("\n"), buttons };
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
      // Endi "Testlar" — test topshirganlar ro'yxati (natijalar + PDF/rasm)
      return takersSection();
    case "activetests":
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

/**
 * Boshqaruvchi amallar (`set-webhook`, `subscribers`) himoyalangan.
 *
 * `set-webhook` ochiq bo'lsa — botni ishonchsiz saytga burib, butun
 * Telegram oqimini olib ketish mumkin. `subscribers` esa odamlarning
 * Telegram chat ID'sini ochiq qiladi.
 *
 * Kalit: `?secret=` (TELEGRAM_BOT_API_SECRET) yoki admin sessiyasi.
 * `TELEGRAM_BOT_API_SECRET` Vercel'de yo'q bo'lsa — 503 qaytaramiz
 * (fail-closed): "yo'q" desak, noto'g'ri xavfsizlik hissi yaratiladi.
 */
async function requireBotAdmin(req: NextRequest, searchParams: URLSearchParams) {
  const expected = process.env.TELEGRAM_BOT_API_SECRET || "";
  if (!expected) {
    return NextResponse.json(
      {
        ok: false,
        error: "TELEGRAM_BOT_API_SECRET sozlanmagan",
        hint: "Vercel -> Settings -> Environment Variables -> TELEGRAM_BOT_API_SECRET qo'shing",
      },
      { status: 503 },
    );
  }
  const given = searchParams.get("secret") || "";
  if (given === expected) return null;
  const session = await getSession().catch(() => null);
  if (session?.isAdmin) return null;
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "set-webhook") {
    const denied = await requireBotAdmin(req, searchParams);
    if (denied) return denied;
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
    const denied = await requireBotAdmin(req, searchParams);
    if (denied) return denied;
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
//
// XAVFSIZLIK: so'rov haqiqatan Telegram'dan kelganini `X-Telegram-Bot-Api-Secret-Token`
// orqali tekshiramiz. Aks holda butun internet `{"callback_query":{"data":"approve:<id>"}}`
// yuborib xodimlarni tasdiqlay/rad eta olardi (ogohlantirishsiz xavfsizlik teshigi).
export async function POST(req: NextRequest) {
  const check = verifyWebhookSecret(req.headers.get("x-telegram-bot-api-secret-token"));
  if (check.strict && !check.ok) {
    console.warn("[telegram] webhook so'rovi sekretsiz keldi — rad etildi");
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!check.strict && !webhookWarned) {
    webhookWarned = true;
    console.warn(
      "[telegram] TELEGRAM_BOT_WEBHOOK_SECRET sozlanmagan — soxta update qabul qilinmoqda. .env ga kalit qo'shib, /api/telegram?action=set-webhook ni bir marta ishga tushiring.",
    );
  }

  try {
    const body = await req.json();

    if (body.callback_query) {
      await handleCallbackQuery(body.callback_query);
      return NextResponse.json({ ok: true });
    }

    if (body.edited_message) {
      return NextResponse.json({ ok: true });
    }

    if (body.message) {
      await handleMessage(body.message);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    // Telegram'ga har doim 200 (qayta urinma) — lekin xato ADMINGA ko'rinadi.
    await notifyAdminError("webhook handler", error);
    return NextResponse.json({ ok: true });
  }
}

let webhookWarned = false;

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
    if (chatId) {
      const { text, buttons } = await menuSection(section);
      const icon = SECTION_ICON[section] || "apps";
      const isPhoto = !!cq.message?.photo;
      const updated: any = await updateSectionMessage(
        chatId,
        messageId,
        isPhoto && text.length <= CAPTION_LIMIT,
        icon,
        text,
        buttons,
      );
      console.log(
        "[telegram] callback->menu",
        JSON.stringify({ data, ok: updated?.ok, desc: updated?.description }),
      );
    }
    return;
  }

  // ====== Test topshirganlar: odam / rasm / PDF ======
  //
  // PDF'lar endi bu yerda xotirada yig'ilib, multipart orqali yuboriladi.
  // Avval `/api/admin/skills/*-report` havolasi ishlatilardi — u admin
  // sessiyasini talab qiladi, Telegram esa havolani cookiesiz yuklab oladi
  // (demak har doim 401) va route deploy qilinmagan bo'lsa 404 beradi.
  if (data.startsWith("tur:")) {
    const userId = data.slice("tur:".length);
    await answerCallbackQuery(cq.id);
    if (!chatId) return;
    try {
      const user: any = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true, surname: true, email: true, department: true, position: true,
          testResults: {
            where: { completedAt: { not: null } },
            orderBy: { startedAt: "desc" },
            take: 100,
            select: {
              score: true, passed: true, answers: true, completedAt: true,
              test: { select: { title: true, questions: { include: { choices: true } } } },
            },
          },
        },
      });
      if (!user) {
        await sendMessage(chatId, "❌ Foydalanuvchi topilmadi.");
        return;
      }
      const attempts = (user.testResults || []).map((r: any) => {
        const stats = computeResultStats(r.test?.questions || [], r.answers);
        return {
          title: r.test?.title || "Test",
          score: typeof r.score === "number" ? r.score : null,
          passed: !!r.passed,
          completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null,
          correct: stats.correct,
          wrong: stats.wrong,
          total: stats.total,
        };
      });
      const pdf = await buildUserReportPdf({ user, attempts }, APP_ORIGIN);
      const sent: any = await sendDocumentBuffer(
        chatId,
        pdf,
        userReportFileName(user),
        "📄 <b>Umumiy PDF hisobot</b> — barcha test natijalari",
      );
      if (!sent?.ok) {
        await sendMessage(
          chatId,
          `📄 PDF yuborilmadi (${escapeHtml(sent?.description || "xato")}). Qayta urinib ko'ring.`,
        );
      }
      console.log("[telegram] tur->pdf", JSON.stringify({ userId, sent: sent?.ok, desc: sent?.description }));
    } catch (e: any) {
      console.error("telegram: user report pdf error", e?.message || e);
      await sendMessage(chatId, "📄 Hisobotni tayyorlashda xato yuz berdi.");
    }
    return;
  }

  if (data.startsWith("ti:")) {
    const resultId = data.slice("ti:".length);
    await answerCallbackQuery(cq.id);
    if (!chatId) return;
    const r: any = await prisma.testResult.findUnique({
      where: { id: resultId },
      include: { user: true, test: { select: { title: true, passScore: true } } },
    });
    if (!r) {
      await sendMessage(chatId, "❌ Natija topilmadi.");
      return;
    }
    const u: any = r.user || {};
    const fullName =
      [u.surname, u.name].filter(Boolean).join(" ").trim() || u.email || "Noma'lum";
    const score: number | null = typeof r.score === "number" ? r.score : null;
    const caption = [
      "🖼 <b>Test natijasi</b>",
      "",
      `👤 <b>F.I.Sh:</b> ${escapeHtml(fullName)}`,
      u.department ? `🏢 <b>Bo'lim:</b> ${escapeHtml(u.department)}` : "",
      `📝 <b>Test:</b> ${escapeHtml(r.test?.title || "Test")}`,
      `📊 <b>Ball:</b> ${score ?? "—"}%${
        r.test?.passScore != null ? ` (o'tish bali: ${r.test.passScore}%)` : ""
      }`,
      `🏅 <b>Daraja:</b> ${levelForScore(score)}`,
      `🏁 <b>Holat:</b> ${r.passed ? "O'tdi ✅" : "Yiqildi ❌"}`,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      const png = await renderResultCardPng(
        {
          fullName,
          department: u.department,
          position: u.position,
          testTitle: r.test?.title || "Test",
          score,
          passScore: r.test?.passScore ?? null,
          passed: !!r.passed,
          level: levelForScore(score),
          completedAt: r.completedAt ? new Date(r.completedAt) : new Date(),
        },
        APP_ORIGIN,
      );
      const photoRes: any = await sendPhoto(chatId, png, caption, { filename: "akela-natija.png" });
      console.log("[telegram] ti->rasm", JSON.stringify({ resultId, sent: photoRes?.ok, desc: photoRes?.description }));
    } catch (e: any) {
      console.error("telegram: result card error", e?.message || e);
      await sendMessage(chatId, caption.replace("🖼 <b>Test natijasi</b>", "🖼 <b>Test natijasi</b> (rasm chizilmadi)"));
    }
    return;
  }

  if (data.startsWith("tp:")) {
    const resultId = data.slice("tp:".length);
    await answerCallbackQuery(cq.id);
    if (!chatId) return;
    try {
      const r: any = await prisma.testResult.findUnique({
        where: { id: resultId },
        include: {
          user: true,
          test: { include: { questions: { include: { choices: true }, orderBy: { order: "asc" } } } },
        },
      });
      if (!r) {
        await sendMessage(chatId, "❌ Natija topilmadi.");
        return;
      }
      const user = r.user || {};
      const pdf = await buildResultReportPdf(
        {
          user,
          testTitle: r.test?.title || "Test",
          passScore: r.test?.passScore ?? null,
          score: typeof r.score === "number" ? r.score : null,
          passed: !!r.passed,
          completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null,
          questions: r.test?.questions || [],
          answersJson: r.answers,
        },
        APP_ORIGIN,
      );
      const sent: any = await sendDocumentBuffer(
        chatId,
        pdf,
        resultReportFileName(user),
        "📄 <b>Yakka test hisoboti</b> — savollar bo'yicha tafsilot",
      );
      if (!sent?.ok) {
        await sendMessage(
          chatId,
          `📄 PDF yuborilmadi (${escapeHtml(sent?.description || "xato")}). Qayta urinib ko'ring.`,
        );
      }
      console.log("[telegram] tp->pdf", JSON.stringify({ resultId, sent: sent?.ok, desc: sent?.description }));
    } catch (e: any) {
      console.error("telegram: result report pdf error", e?.message || e);
      await sendMessage(chatId, "📄 Hisobotni tayyorlashda xato yuz berdi.");
    }
    return;
  }

  if (data.startsWith("tu:")) {
    const userId = data.slice("tu:".length);
    await answerCallbackQuery(cq.id);
    if (!chatId) return;
    const { text, buttons } = await takerSection(userId);
    const edited: any = messageId
      ? await editMessageText(chatId, messageId, text, { parse_mode: "HTML", reply_markup: buttons })
      : { ok: false };
    if (!edited?.ok && !String(edited?.description || "").includes("not modified")) {
      await sendMessage(chatId, text, { reply_markup: buttons });
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

