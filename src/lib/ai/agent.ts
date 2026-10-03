/**
 * lib/ai/agent.ts
 *
 * Chat agentining yagona tsikli: xabar -> reja (vositalar) -> bajarish ->
 * yakuniy javob. Model JSON protokol bilan ishlaydi, shuning uchun barcha
 * provayderlar (OpenAI, Anthropic, Gemini) bir xil ishlaydi.
 *
 * Model yo'q bo'lsa deterministik intent-router ishga tushadi РІР‚вЂќ chat o'chmaydi.
 */

import { db } from "@/lib/db";
import { complete, completeStream, resolveProvider, estimateCost, estimateTokens, ProviderUnavailableError, userFacingProviderError, type ChatMessage } from "./provider";
import { ReplyDeltaExtractor } from "./stream-json";
import { injectionGuardBlock, scanUserMessage, wrapUntrustedSource } from "./sanitize";
import { parseJsonLoose, clip } from "./json";
import { runTool, toolPrompt, visibleTools, type ToolActor, type ToolContext, type ToolResult } from "./tools";
import { searchEngineInfo } from "./search";
import { resolveProvider as provider } from "./provider";
import { skillsPrompt } from "./skills";
import { openDailySession, sessionMemory, sessionDayKey, rolloverInfo } from "./session";

const MAX_ACTIONS_PER_TURN = 4;
const MAX_HISTORY_MESSAGES = 12;

/**
 * Bitta so'rovda model вЂ” vosita вЂ” model вЂ” vosita qancha marta ketma-ket
 * ishlayishi mumkin.
 *
 * Nima uchun bir necha: ko'p qadamli vazifalar bor (internetdan olish в†’
 * test yaratish в†’ ko'rinishni o'zgartirish). Bitta qadamda hammasi
 * bajarilmaydi, lekin cheksiz tsikl ham xato вЂ” model bir xil vositani
 * takrorlashda "aylanib" qolishi mumkin. 4 qadam real vazifalarning
 * ko'pchiligi uchun yetarli, model o'zi `actions: []` bilan to'xtaydi.
 */
const MAX_TOOL_ROUNDS = 4;

/**
 * Tekshiruvdan o'tmagan natija qancha marta qayta urinishga qaytariladi.
 * 2 ta yetarli: birinchi urinish ko'pincha "ID topilmadi" kabi xatoda bo'ladi,
 * ikkinchisi esa boshqa argumentlar bilan qayta ko'radi. Uchinchi urinish
 * foydalanuvchining vaqti va kvotasi uchun behuda.
 */
const MAX_VERIFY_RETRIES = 2;

/**
 * Model fayl so'rasa ham, hech narsa qilmagan bo'lsa — unga beriladigan
 * ANIQ ko'rsatma. Bu matn keyingi raund modelga "bajarilgan harakatlar" orqali
 * boradi, ya'ni model o'zi xatosini ko'rib, darhol doc.* ga o'tadi.
 */
const FILE_MISSING_NOTE = `### TEKSHIRUV: fayl YARATILMAGAN
Foydalanuvchi fayl so'ragan (yoki qayta yaratishni so'ragan), lekin bu qadamda
hech qanday doc.* vositasi chaqirilmadi va hech qanday "downloadUrl" kelmadi.
Natija YOLG'ON — fayl yo'q. Endi:
- Excel -> doc.excel, Word -> doc.word, PDF -> doc.pdf ni DARHOL chaqir
  (filename, title va sheets/blocks argumentlarini to'liq ber).
- Eski faylni qayta yasash kerak bo'lsa: avval file.list, keyin doc.recreate
  ("file": aniq nom, "as": kerakli format).
- Ma'lumot yetarli bo'lmasa — bitta aniq savol so'ra, fayl QURMA va
  "yaratdim" DEYMA.`;

/**
 * Modelga yuboriladigan natija ixchamlash chegaralari.
 *
 * Natija TUZILMASI saqlanadi, faqat ichidagi ro'yxatlar va uzun matnlar
 * qisqartiriladi. Sabab: ilgari butun JSON matni kesilib, parse xatosi
 * berar va natija `null` bo'lib ketar edi — dashboard yo'qolardi.
 */
const MAX_ROWS_PER_ARRAY = 60;
const MAX_STRING_CHARS = 2_000;

/** Bir xil savolga qayta-qayta javob berish uchun svarlangan qisqa kesh. */
const RESPONSE_CACHE_TTL_MS = 30 * 60 * 1000;
const RESPONSE_CACHE_MAX = 200;
const responseCache = new Map<string, { at: number; response: AgentResponse }>();

/** Savol matnini standartlashtirib taqqoslash uchun kalit qiladi. */
function normalizeQuestion(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\p{L}\p{N} ]/gu, "")
    .trim();
}

function cacheSet(key: string, response: AgentResponse) {
  if (responseCache.size >= RESPONSE_CACHE_MAX) {
    // eng eskisini chiqarib tashla
    const oldest = responseCache.keys().next().value;
    if (oldest) responseCache.delete(oldest);
  }
  responseCache.set(key, { at: Date.now(), response });
}

export type AgentStep = {
  type: "thinking" | "action" | "result" | "warning";
  tool?: string;
  title?: string;
  args?: unknown;
  summary?: string;
  ok?: boolean;
  data?: unknown;
  link?: { label: string; href: string } | null;
  latencyMs?: number;
  /** Tekshiruv tizimi: natija bazadan/diskdan qayta o'qildi va tasdiqlandi */
  verified?: boolean;
  /** Tekshiruv izohi */
  verifyNote?: string;
};

/**
 * Jonli bosqich eventlari вЂ” NDJSON stream orqali mijozga HAR BIR qadam
 * bo'lib yuboriladi (bitta yig'indi emas). Shuning uchun foydalanuvchi
 * "rejalashtirish в†’ vosita в†’ dashboard в†’ javob" oqimini real vaqtda ko'radi.
 */
export type AgentEvent =
  | { type: "phase"; phase: "plan" | "tools" | "dashboard" | "answer"; label?: string }
  | { type: "step"; step: AgentStep }
  | { type: "confirm"; confirm: ConfirmPrompt }
  | { type: "pick"; pick: PickPrompt }
  | { type: "reply_delta"; round: number; delta: string };

/** Chatga chiqadigan variantli tasdiqlash tugmalari. */
export type ConfirmPrompt = {
  question: string;
  tool: string;
  options: { label: string; send: string; variant?: "primary" | "danger" | "ghost" }[];
};

/** Chatga chiqadigan tanlov tugmalari (bir nechta moslik topilganda). */
export type PickPrompt = {
  question: string;
  options: { label: string; detail?: string; send: string }[];
};

/** Analytics vositalari вЂ” natijasi dashboardga aylantiriladi. */
const DASHBOARD_TOOL_RE = /^analytics\./;

function isDashboardStep(tool: string, data: unknown): boolean {
  return DASHBOARD_TOOL_RE.test(tool || "") && !!data && typeof data === "object";
}

export type AgentResponse = {
  reply: string;
  steps: AgentStep[];
  conversationId: string;
  usage: { promptTokens: number; completionTokens: number; cost: number; model: string; provider: string; latencyMs: number };
  providerLive: boolean;
  error?: string;
};

export type AgentInput = {
  actor: ToolActor;
  conversationId?: string | null;
  message: string;
  attachmentIds?: string[];
  signal?: AbortSignal;
  /** Jonli event: har bir bosqich darhol yuboriladi (streaming uchun) */
  onEvent?: (event: AgentEvent) => void;
};

// ============================================================================
//  Kvota
// ============================================================================

export function dailyRequestLimit() {
  const n = Number(process.env.AI_DAILY_REQUEST_LIMIT || 120);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 120;
}

export async function checkRateLimit(userId: string) {
  const day = new Date().toISOString().slice(0, 10);
  const row = await db.aiUsage.findUnique({ where: { userId_day: { userId, day } } });
  const used = row?.requests ?? 0;
  const limit = dailyRequestLimit();
  return { allowed: used < limit, used, limit, remaining: Math.max(0, limit - used) };
}

export async function recordUsage(
  userId: string,
  delta: { requests?: number; promptTokens?: number; completionTokens?: number; cost?: number },
) {
  const day = new Date().toISOString().slice(0, 10);
  await db.aiUsage.upsert({
    where: { userId_day: { userId, day } },
    create: {
      userId,
      day,
      requests: delta.requests ?? 0,
      promptTokens: delta.promptTokens ?? 0,
      completionTokens: delta.completionTokens ?? 0,
      estimatedCost: delta.cost ?? 0,
    },
    update: {
      requests: { increment: delta.requests ?? 0 },
      promptTokens: { increment: delta.promptTokens ?? 0 },
      completionTokens: { increment: delta.completionTokens ?? 0 },
      estimatedCost: { increment: delta.cost ?? 0 },
    },
  });
}

// ============================================================================
//  Platforma holati (modelga beriladi)
// ============================================================================

let snapshotCache: { at: number; data: Awaited<ReturnType<typeof buildSnapshot>> } | null = null;

async function buildSnapshot() {
  const [users, tests, questions, results, pending, rules] = await Promise.all([
    db.user.count(),
    db.test.count(),
    db.question.count(),
    db.testResult.count(),
    db.testResult.count({ where: { gradingStatus: "pending" } }),
    db.accessRule.count(),
  ]);
  const [recentTests, recentUsers] = await Promise.all([
    db.test.findMany({
      select: { id: true, title: true, status: true, visibility: true, _count: { select: { questions: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.user.findMany({
      select: { id: true, email: true, name: true, surname: true, department: true, position: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);
  return { users, tests, questions, results, pending, rules, recentTests, recentUsers };
}

/** Holat 20 soniya keshlangan вЂ” har xabarda 8 ta agregat so'rov ketma-ket yuborilmasin. */
async function platformSnapshot() {
  if (snapshotCache && Date.now() - snapshotCache.at < 20_000) return snapshotCache.data;
  const data = await buildSnapshot();
  snapshotCache = { at: Date.now(), data };
  return data;
}

function shortUser(u: { name?: string | null; surname?: string | null; email: string; department?: string | null }) {
  return `${[u.surname, u.name].filter(Boolean).join(" ").trim() || u.email} <${u.email}>${u.department ? ` [${u.department}]` : ""}`;
}

// ============================================================================
//  Prompt
// ============================================================================

function buildSystemPrompt(
  actor: ToolActor,
  snapshot: Awaited<ReturnType<typeof platformSnapshot>>,
  memory = "",
) {
  const now = new Date();
  const roll = rolloverInfo(now);
  return `Sen "Akela AI" вЂ” AKELA ta'lim platformasining admin assistentsan. Til: O'ZBEK.

SANA: ${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)}
SESSIYA KUNI: ${roll.dayKey} вЂ” kunlik sessiya har kuni ${roll.at} da yangilanadi (${roll.inHuman} dan keyin yangi sessiya ochiladi).

SENING IMKONIYATLARING (faqat shu vositalarni chaqira olasan):
${toolPrompt(actor)}

SKILLAR (saytning qoidalari va ish oqimlari вЂ” kerak bo'lganda "skill.read" bilan o'qi):
${skillsPrompt()}

${injectionGuardBlock()}

QAT'IY QOIDALAR:
0. ENG ASOSIY: foydalanuvchi BITTA savol beradi — sen BITTAJOB to'liq,
   mustaqil ravishda topishing kerak. Avval qidir, ko'rish, qoidani o'qi,
   hisobla va natijani ber. Natija bo'lmasa — qidiruvni KENGAYTIR (boshqa
   so'z bilan, boshqa bo'limda), cheklovni oshir (limit katta), so'ng ham
   topilmasa shunda aniq nima qidirilganini ayt.
   ANIQLASHTIRISH SHART BO'LGAN 2 HOL (boshqa payt savol so'rama):
   a) O'CHIRISH/BLOKLASH kabi qaytarib bo'lmaydigan amal va nishon noaniq
      bo'lsa (bir nechta xodim/test topilsa) — TAXMIN QILMA, qaysi birini
      so'ra. "pick" tugmalari avtomatik chiqadi — ularni ishlat.
   b) So'rovda nishon umuman yo'q bo'lsa ("o'shani o'chir", "hammasini yubor"
      kabi) — nima nazarda tutilganini qisqa so'ra, taxmin bilan o'chirma.
1. Javobing FAQAT JSON bo'lsin. Boshqa hech narsa yozma.
   {"reply":"foydalanuvchiga ko'rsatiladigan qisqa javob","actions":[{"tool":"vosita_nomi","args":{...}}]}
1a. "actions" ICHIDA ham javob bo'lsin mumkin: agar foydalanuvchiga
   ko'rsatish uchun TAYYOR ma'lumot kerak bo'lsa, uni shu yerda to'ldir.
   Masalan rasm yoki fayl havolasi kerak bo'lsa — shu yerda joylashtir.
2. Faqat "actions" ichidagi vositalarni ishlat. Noma'lum vosita yozma.
3. ID ni o'ylab topma. Xodim/test/dars nomi yoki pochta bilan murojaat qil вЂ” vosita o'zi bazadan topadi.
3a. Agar xodim ismi yoki pochtasi aniq bo'lmasa, bir nechta moslik chiqsa yoki topilmasa вЂ” avval "user.search" vositasini chaqir, qaytgan id yoki pochtani keyingi xaborda ishlat. Aks holda ruxsat berish yoki o'chirish amalini bajarMA.
3b. Agar test yoki dars nomi topilmasa yoki nomi noaniq bo'lsa - avval "test.search" (test) yoki "files.search" (dars) vositasini chaqir va qaytgan ID ni ishlat.
3c. Xodim qidiruvi SUBSTRING bo'yicha ishlaydi: "akbar" вЂ” Saidakbar, Akbar,
   Akbaraliyev hammasiga mos keladi. Bu NORMAL. Sen buni "xato" deb
   tushuntirma вЂ” shunchaki topilgan N ta odamni TO'LIQ ko'rsat.
4. Agar foydalanuvchi xavfli amal so'rasa (o'chirish, bloklash, hamma yodlash), avval "reply" da aniq tasdiq so'ng va actions bo'sh qoldir.
5. Bir javobda ko'pi bilan ${MAX_ACTIONS_PER_TURN} ta vosita. Kerak bo'lsa keyingi xaborda davom et.
6. Manzillar, savollar va matnlarni o'ylab topma вЂ” bazadagi haqiqiy ma'lumotlarni faqat vositalar orqali ol.
7. Agar savolga javob vosita orqali olinadigan bo'lsa вЂ” vositani chaqir va qisqa bayonot ber.
8. Savolga javob berolmaydigan savol bo'lsa вЂ” qisqa va aniq ayt.
9. Agar vosita "xato" qaytarsa вЂ” sababni foydalanuvchiga tushuntir va TO'G'RI argumentlar bilan qayta urinishga tayyor bo'l (keyingi xaborda).
10. VAZIFANI BAJAR, TAVSIFLAMA. Foydalanuvchi "yarat", "tuz", "yoz", "qo'sh",
    "o'zgartir", "ochir", "yoq", "ber", "yubor" deb so'raganda вЂ” bu amalda
    bajarishni talab qiladi. Qidiruv qilib yoki "yaratishim mumkin" deb
    to'xtama: kerakli vosita bilan AMALNI bajar va natijani tasdiqla.
    Masalan "internetdan ma'lumot olib test yarat" = web.search в†’ test.generate.
    "Darsni yashir" = avdal topish, keyin lesson.setVisibility.
11. Agar bir-biriga bog'liq bir nechta amal kerak bo'lsa, ularni ketma-ket
    bajar: biri natijasi ikkinchisining argumenti bo'ladi. Bir qadamda
    to'xtab, keyingi qadamda davom ettir.

TEST YARATISH вЂ” IKKALA QADAM HAM BAJARILISHI SHART:
  1) test.generate  в†’ savollar qoralamaga yig'iladi, natijada "draftId" qaytadi.
  2) test.applyDraft в†’ shu draftId ni {"confirm": true} bilan ber. FAQAT SHUNDAY
     test HAQIQATAN bazada yaratiladi va savollar yoziladi.
Faqat 1-qadam bajarilsa, test YARATILMAGAN bo'ladi вЂ” foydalanuvchi so'ragani
 bajarilmagan bo'lib chiqadi. Ikkalasini ham bajar.

TEST QO'SHISH QOIDALARI (saytning o'z qoidasi вЂ” avval shuni o'qi):
- "tests.lifecycle" skill'i test yaratish, ko'rsatish, tahrirlash va
  YO'Q QILISH tartibini beradi. Test bilan ishlash BOSHLANGANDA avval shu
  skill'ni skill.read bilan o'qi, keyin harakat qil.
- INTERNET faqat foydalanuvchi o'zi so'raganda: "internetdan", "qidirib",
  "internet orqali" so'zlari bo'lsa mode:"web". Boshqa holatda mode:"source"
  (o'sha mavzu bo'yicha o'zingning bilimingizdan) вЂ” bu TEZROQ va ishonchliroq,
  chunki internet qidiruvi qo'shimcha 20-60 soniya oladi.

Xodim uchun test: avval user.search bilan xodimni top в†’ test.generate в†’
test.applyDraft.

FAYL (hujjat/tabel) YARATISH: FAQAT doc.* VOSITASI HAQIQATY
- Excel (.xlsx) uchun doc.excel, Word (.docx) uchun doc.word, PDF uchun doc.pdf.
- "yarat", "qayta yas", "chiqar", "Excelga", "Word'ga", "PDF'ga", "jadvalson",
  "ro'yxatni faylga" degan so'rovlarda DARHAL shu vositani chaqir.
- "qayta yasab", "yana bir marta yasab", "yana bir fayl ber" desang:
  1) avval file.list bilan eski faylni top (nom aniq bo'lsa to'g'ridan-to'g'ri),
  2) keyin doc.recreate bilan YANGI fayl qur. Eski fayl o'chmaydi.
- doc.recreate ga "as" bilan boshqa format aytsang konvertatsiya qilinadi:
  {"file":"hodimlar.xlsx","as":"word"} yoki {"as":"pdf"}.
- "YANGI FAYL BER" oddiy javob emas: fayl haqiqatan diskka yozilishi va
  chatda "Yuklab olish" kartasi chiqishi SHART.
- doc.* natijasi "downloadUrl" maydonini qaytarmasa "tayyor", "yaratdim", "qildim" DEYMA.
  Fayl yo'q bo'lsa, o'zong ayt va nima yetishini aniq yoz.
- Ma'lumot yetarli bo'lmasa (qaysi qatorlar, qanday sarlavhalar, qaysi format)
  bitta aniq savol so'ra va fayl QURMA — bo'sh fayl yaratib yuborma.

VIZUAL ARTIFACT (Faza 4): artifact.dashboard / artifact.code
- "dashboard", "diagramma", "choy", "grafig", "vizual ko'rinish", "infografika",
  "hisobotni chiz" desang — avval analytics.* dan haqiqiy raqamlarni ol, keyin
  artifact.dashboard ni chaqir. Panel chat ichida skriptsiz iframe'da ochiladi.
- artifact.dashboard bloklari: kpis (label+value), charts (bar|column, items),
  donut (ring), tables (headers+rows). Bo'sh qoldirilgan blok chiqarilmaydi.
- "kodni ko'rsat", "SQL so'roqini yozib ko'rsat" desang — artifact.code.
- Artifact kod BAJARMAYDI: ko'rsatish uchun. Bajarish: code.exec.
- Artifact natijasi "artifactUrl" bilan qaytadi; foydalanuvchi uni chatda ochadi.

RASM YARATISH (Faza 5): image.generate
- "chiz", "rasm yasab", "ilustrasiya", "poster", "banner", "avatar", "rasm chiz"
  degan so'rovlarda shu vositani chaqir. Rasm haqiqiy fayl bo'lib saqlanadi va
  chatda ko'rinadi (yuklab olish mumkin).
- Argumentlar: prompt (nima chizilishi — aniq va vizual), size (1:1, 16:9,
  4:3, 3:4, 9:16), style (uslub).
- Promptda yozilmaydigan narsani yozma: "matn yo'q", "logotip yo'q" —
  model rasm ichida xato yozuvlar chiqaradi.
- "qayta chiz", "o'zgartir" desang: shu promptni yana image.generate ga ber.
- Kunlik limit bor; limit tugasa foydalanuvchiga aniq ayt.
- Provayder 402 (balans) qaytarsa — bu tuzatiladigan holat: foydalanuvchiga
  "rasm modeli balansi yo'q" deb ayt, "chizdim" DEYMA.

JAVOB SIFATI (BU ENG MUHIM QO'IDA):
A. Agar natija RO'YXAT bo'lsa вЂ” TO'LIQ ro'yxatni chiqar, har bir uchun bir qator:
   "Ism вЂ” bo'lim, lavozim вЂ” pochta (holat)". Topilgan N ta bo'lsa, N tasini ham.
B. "Qaysi birini tanlaysiz?", "ehtimol", "siz noto'g'ri ko'rgansiz",
   "so'rovingiz tushunarsiz" kabi aynalma va o'zini oqlash MATNINI ISHLATMA.
   Vazifa bajarilgan bo'lsa, uni bajarilganini ayt. bajarilmagan bo'lsa,
   qisqa sababni ayt va nima qilishing kerakligini aniq yoz.
C. Savolga TO'G'RI javobni birinchi jumlada ber. Keyin qisqa izoh (ixtiyoriy).
D. Ro'yxat topilganini aytgan bo'lsang, o'sha faktni qayta inkor qilma.
E. Agar xotirada oldingi javob bo'lsa вЂ” takror so'rama, bog'la ("Siz avval ...").
F. Yotgan amalni bajarilgan kabi yozma. "Test yaratdim" deyish uchun avval
   test.generate chaqirilishi va muvaffaqiyatli bo'lishi SHART.
G. TAYYOR SHABLON BO'Yicha JAVOB BERMA. Savolga tayyor matn qo'yib,
   haqiqiy ma'lumotni olmasdan aytib bo'lmaydi. Xotirada, shablon yoki
   taxmingan raqamlarda javob berMA — faqat shu yerda olgan haqiqiy
   natijaga tayan. Topa olmagan bo'lsang, "topolmadi" de (bu ham
   foydalanuvchi uchun foydali javob) — lekin o'ylab topilgan ro'yxatni
   ro'yxat deb KO'RSATMA.

${memory ? `SESSIYA XOTIRASI (bugungi suhbatda so'ralgan hamma narsa вЂ” ${roll.dayKey}):\n${memory}\n` : ""}
PLATFORMA HOLATI:
- Xodimlar: ${snapshot.users}, testlar: ${snapshot.tests}, savollar: ${snapshot.questions}, topshirishlar: ${snapshot.results}
- Baholanish kutilmoqda: ${snapshot.pending}, maxsus ko'rinish/ruxsat qoidalari: ${snapshot.rules}
- Internet qidiruv: ${searchEngineInfo()}

OXIRGI TESTLAR:
${snapshot.recentTests.map((t) => `- "${t.title}" | ${t.status} | ${t.visibility} | ${t._count.questions} savol | id=${t.id}`).join("\n") || "(yo'q)"}

OXIRGI XODIMLAR:
${snapshot.recentUsers.map((u) => `- ${shortUser(u)} | ${u.status} | id=${u.id}`).join("\n") || "(yo'q)"}
`;
}

// ============================================================================
//  Asosiy tsikl
// ============================================================================

export async function runAgent(input: AgentInput): Promise<AgentResponse> {
  const started = Date.now();
  const steps: AgentStep[] = [];

  // Jonli event yuboruvchi: qadam bosilishi bilan mijozga darhol chiqadi.
  const emit = input.onEvent ?? (() => {});
  const emitPhase = (phase: "plan" | "tools" | "dashboard" | "answer", label?: string) =>
    emit({ type: "phase", phase, label });
  const pushStep = (step: AgentStep) => {
    steps.push(step);
    emit({ type: "step", step });
  };
  // Tasdiqlash tugmalarini mijozga yuboruvchi (chatga TUGMA chiqadi).
  const confirmEmit = (confirm: ConfirmPrompt) => emit({ type: "confirm", confirm });
  // Tanlov tugmalarini mijozga yuboruvchi (bir nechta moslik topilganda).
  const pickEmit = (pick: PickPrompt) => emit({ type: "pick", pick });

  // Prompt-injection skaner: foydalanuvchi xabaridagi ko'rsatma-naqshlar
  // logga yoziladi (audit izi), lekin xabar BLOKLANMAYDI — model
  // tizim promptidagi XAVFSIZLIK qoidasi bilan uni ma'lumot deb o'qiydi.
  const msgScan = scanUserMessage(input.message);
  if (msgScan.flagged > 0) {
    console.warn(
      `[ai-guard] injection-naqsh aniqlandi user=${input.actor.userId} flags=${msgScan.flags.join(",")}`,
    );
  }

  const quota = await checkRateLimit(input.actor.userId);
  if (!quota.allowed) {
    pushStep({ type: "warning", summary: "Kvota tugagan" });
    return {
      reply: `Kunlik AI so'rov limiti tugagan (${quota.limit} ta). Ertaga yoki limitni oshirish uchun admin bilan bog'laning.`,
      steps,
      conversationId: input.conversationId || "",
      usage: emptyUsage(),
      providerLive: resolveProvider().live,
    };
  }

    const conversation = await ensureConversation(input);
  await persistMessage(conversation.id, "user", input.message);

  // CASHE: xuddi shu sessiyada bir xil savol qayta kelsa вЂ” avvalgi javob
  // REFUsed qilinadi; model/vosita qayta chaqirilmaydi, natija bir xil
  // ko'rinadi va kvota/narx tejalyi (same question = same answer).
  const cacheKey = `${conversation.id}::${normalizeQuestion(input.message)}`;
  const hit = responseCache.get(cacheKey);
  if (hit && Date.now() - hit.at < RESPONSE_CACHE_TTL_MS) {
    // Keshdan javob вЂ” bosqichlar ham jonli ko'rinadi (tez, lekin bir xil oqim)
    emitPhase("plan", "Keshdan javob topildi");
    for (const step of hit.response.steps) emit({ type: "step", step });
    await finishTurn(conversation.id, hit.response.reply, hit.response.steps);
    return hit.response;
  }

  // Doimiy formasi kerak bo'lganda: bu natijani keshga yoz (kelajakda birxil qaytariladi)
  const done = (r: AgentResponse): AgentResponse => {
    cacheSet(cacheKey, r);
    return r;
  };

  // Kunlik xotira: sessiya tugamaguncha o'sha kunning hamma muhokamasi eslab qolinadi
  const memory = await sessionMemory(conversation.id, input.message);
  const history = await loadHistory(conversation.id, input.message);
  const snapshot = await platformSnapshot();
  const model = resolveProvider();

  const systemPrompt = buildSystemPrompt(input.actor, snapshot, memory);
  const ctx: ToolContext = { actor: input.actor, conversationId: conversation.id, source: "chat", userMessage: input.message };

  emitPhase("plan", "So'rov tahlil qilyapti");

  let promptTokens = 0;
  let completionTokens = 0;
  let cost = 0;

  if (!model.live) {
    const planned = deterministicPlan(input, ctx);
    pushStep({ type: "thinking", summary: "AI kaliti yo'q вЂ” o'rnatilgan reja ishlatildi" });
    emitPhase("tools", "Vositalarni bajarish");
    const executed = await executeActions(planned.actions, ctx, pushStep, emitPhase, confirmEmit, pickEmit, input.message);
    emitPhase("answer", "Javob yozilmoqda");
    await finishTurn(conversation.id, executed.reply, steps);
    return done({
      reply: executed.reply,
      steps,
      conversationId: conversation.id,
      usage: { ...emptyUsage(), model: model.model, provider: model.name, latencyMs: Date.now() - started },
      providerLive: false,
    });
  }

  // ======================================================================
  //  ASOSIY TSIKL вЂ” model va vositalar birgalikda ishlaydi
  //
  //  Nima uchun tsikl kerak: oldingi tuzilma "bir marta reja в†’ bajarish в†’
  //  faqat javob" edi, ya'ni model ikkinchi qadamda actions qaytara OLMAYDIGAN.
  //  Shu sabab "internetdan ma'lumot olib test yarat" kabi vazifalar bajarilmas
  //  edi: model faqat web.search ni chaqirib, test yaratishni TAVSIFLAB
  //  qoldirdi. Endi har bir qadamdan keyin model natijani ko'radi va keyingi
  //  vosita bilan davom etadi (web.search в†’ test.generate), faqat `actions`
  //  bo'sh qolganda tugaydi.
  // ======================================================================
  const firstUserMessage =
    input.attachmentIds && input.attachmentIds.length
      ? `${input.message}\n\n(Yuklangan fayllar: ${input.attachmentIds.join(", ")})`
      : input.message;

  let reply = "";
  const reports: string[] = [];
  let executedAny = false;
  let askFailed = false;
  /** Balans kam bo'lsa faqat BIR marta ixcham prompt bilan qayta uriniladi. */
  let retriedCompact = false;
  /** Qisqa rejimga o'tganimizni keyingi qadamlar uchun eslatib turamiz. */
  let compactMode = false;
  /** Bitta so'rovda qoralama faqat BIR marta tasdiqlanadi. */
  let appliedDraft = false;
  /** Tanlov taklif qilinganmi — takrorlanmasligi uchun. */
  let pickOffered = false;
  /**
   * FAYL NATIJASI NAZORATI (Faza 4).
   *
   * Muammo: model "fayl tayyor" deb yozib, hech qanday doc.* vositasini
   * chaqirmasdi — foydalanuvchi hech narsa olmagan holda "bajarildi" deb qoldi.
   * Yechim: fayl niyati aniqlangan bo'lsa, haqiqiy `downloadUrl` bo'lmagan
   * holda "yaratdim" degan javobga UMUMAN ruxsat bermaymiz — modelga bir marta
   * aniq ko'rsatma berib, qayta urinishga majbur qilamiz.
   */
  const fileIntent = wantsFileOutput(input.message);
  let fileArtifact: { fileName: string; kind?: string; size?: number } | null = null;
  let fileRetryInjected = false;
  /**
   * TEKSHIRUV: natija realmi? Har bir bajarilgan vosita bazadan/diskdan
   * qayta o'qiladi (verify.ts). O'tmagan natija foydalanuvchiga BERILMAYDI —
   * agent shu vositani qayta chaqirishga qaytadi (maksimal 2 marta), va
   * oxirida ham hali o'tmagan bo'lsa, "qildim" deb YOZMAYDI.
   */
  let verifyRetries = 0;
  let unverified: { tool: string; note: string }[] = [];

  for (let round = 1; round <= MAX_TOOL_ROUNDS; round++) {
    // Xabarni shakllantirish: 1-raqam oddiy savol, keyingilari oldingi
    // natijalar bilan davom etish so'rovi.
    const userContent =
      round === 1
        ? firstUserMessage
        : followUpPrompt(input.message, reports, round === MAX_TOOL_ROUNDS);

    const messages: ChatMessage[] = [
      // Balans kam bo'lgani aniqlansa, keyingi qadamlar ham IXCHAM prompt bilan
      // ketadi вЂ” aks holda 2-qadam yana to'liq prompt bilan 402 berib, ikki
      // marta ish yo'qotamiz.
      { role: "system", content: compactMode ? buildCompactPrompt(input.actor) : systemPrompt },
      ...(round === 1 ? history : []),
      { role: "user", content: userContent },
    ];

    let parsed: { reply?: string; actions?: { tool: string; args?: Record<string, unknown> }[] } | null = null;
    try {
      emitPhase(round === 1 ? "plan" : "tools", round === 1 ? "So'rov tahlil qilyapti" : "Natija bo'yicha davom etilmoqda");
      // Token-level streaming: reply matni to'liq kelishini kutmasdan,
      // bo'laklab mijozga yuboriladi (reply_delta eventlari).
      const extractor = new ReplyDeltaExtractor();
      try {
        const res = await completeStream(messages, {
          temperature: round === 1 ? 0.1 : 0.2,
          signal: input.signal,
          onDelta: (raw) => {
            const delta = extractor.push(raw);
            if (delta) emit({ type: "reply_delta", round, delta });
          },
        });
        promptTokens += res.promptTokens;
        completionTokens += res.completionTokens;
        cost += res.cost;
        parsed = parseJsonLoose<any>(res.text, "object") || {};
      } catch (streamErr: any) {
        // Stream ishlamasa (provayder qo'llamasa yoki o'rtada uzilsa) —
        // non-stream fallback: javob kech keladi, lekin keladi.
        console.warn(`[ai-agent] stream ishlamadi (raund ${round}), fallback:`, streamErr?.message || streamErr);
        const res = await complete(messages, { temperature: round === 1 ? 0.1 : 0.2, signal: input.signal });
        promptTokens += res.promptTokens;
        completionTokens += res.completionTokens;
        cost += res.cost;
        parsed = parseJsonLoose<any>(res.text, "object") || {};
      }
    } catch (err: any) {
      // Balans kam bo'lsa (402) вЂ” bir marta IXCHAM prompt bilan qayta urinish.
      // To'liq prompt kvotaga sig'maydi, lekin ixcham sig'adi: shunday qilib
      // AI o'chmaydi, faqat vosita tavsiflari kamayadi.
      const quotaHit =
        err instanceof ProviderUnavailableError &&
        (err.details.reason === "quota" || err.details.reason === "daily");

      if (round === 1 && quotaHit && !retriedCompact) {
        retriedCompact = true;
        compactMode = true;
        pushStep({
          type: "thinking",
          summary: "Balans kam вЂ” qisqa rejimga o'tildi (AI ishlashda davom etadi)",
        });
        try {
          const res = await complete(
            [
              { role: "system", content: buildCompactPrompt(input.actor) },
              { role: "user", content: firstUserMessage },
            ],
            { temperature: 0.1, signal: input.signal, maxOutputTokens: 900 },
          );
          promptTokens += res.promptTokens;
          completionTokens += res.completionTokens;
          cost += res.cost;
          parsed = parseJsonLoose<any>(res.text, "object") || {};
        } catch (err2: any) {
          err = err2;
          // quyidagi qatorlar shortProviderMessage ni ishlatadi
        }
      }

      if (parsed == null) {
        const short = shortProviderMessage(err);
        console.error(`[ai-agent] model chaqiruvi muvaffaqiyatsiz (raqam ${round}):`, err?.message || err);

        if (round === 1) {
          // Bitta xabar вЂ” BITTA marta ko'rsatiladi. Oldin u warning kartasi,
          // reply matni va qizil "error" qatorida takrorlanardi (3 marta).
          await finishTurn(conversation.id, short, steps);
          return {
            reply: short,
            steps,
            conversationId: conversation.id,
            usage: { ...emptyUsage(), latencyMs: Date.now() - started },
            providerLive: true,
          };
        }

        askFailed = true;
        break;
      }
    }

    // Bu nuqtaga kelib `parsed` null bo'lishi mumkin emas: muvaffaqiyatsiz
    // bo'lsa yuqorida `break` yoki `return` bajariladi.
    const step = parsed ?? {};
    const actions = Array.isArray(step.actions) ? step.actions.slice(0, MAX_ACTIONS_PER_TURN) : [];
    const said = String(step.reply || "").trim();
    if (said) reply = said;

    // Model ishlashni tugatdi вЂ” javob tayyor.
    if (actions.length === 0) {
      // LEKIN: fayl so'ralgan va hech qanday fayl yaratilmagan bo'lsa —
      // bir marta aniq ko'rsatma berib, modelni QAYTA urinishga majbur qilamiz.
      // Aks holda foydalanuvchi "bajarildi" deb o'ylab, hech narsa olmaydi.
      if (fileIntent && !fileArtifact && !fileRetryInjected && round < MAX_TOOL_ROUNDS) {
        fileRetryInjected = true;
        pushStep({ type: "thinking", summary: "Fayl hali yaratilmadi — yaratishga qayta o'tilmoqda" });
        reports.push(FILE_MISSING_NOTE);
        continue;
      }
      break;
    }

    // 2+ xodimni ketma-ket tahlil qilib, hammasini birdan ko'rsatmaslik uchun:
    // foydalanuvchi tanlashimiz kerak.
    if (round === 1 && !pickOffered) {
      const pick = multiTargetPick(actions, reports, input.message);
      if (pick) {
        pickOffered = true;
        pickEmit(pick);
        break;
      }
    }

    const executed = await executeActions(actions, ctx, pushStep, emitPhase, confirmEmit, pickEmit, input.message);
    executedAny = true;
    if (!reply && executed.reply) reply = executed.reply;
    const producedFile = takeFileArtifact(executed.toolReports);
    if (producedFile) fileArtifact = producedFile;
    unverified = executed.unverified;
    if (unverified.length && verifyRetries < MAX_VERIFY_RETRIES && round < MAX_TOOL_ROUNDS) {
      verifyRetries++;
      pushStep({
        type: "warning",
        summary: `Tekshiruv o'tmadi (${unverified.map((u) => u.tool).join(", ")}) — qayta bajarilmoqda`,
      });
      reports.push(formatUnverified(unverified));
      continue;
    }
    reports.push(formatToolReports(executed.toolReports));

    // Qoralama tayyor bo'lsa — TASDIQ KARTASI chiqarish.
    //
    // Faza 2 qoidasi: write-amal foydalanuvchi tugmani BOSMASDAN
    // bajarilmaydi. `confirm:true` ni o'zimiz qo'ymaymiz — `test.applyDraft`
    // `confirm`siz chaqiriladi, `runTool` needsConfirm qaytaradi va
    // `executeActions` ichida tabiiy confirm oqimi (tugmalar) ishlaydi.
    // Foydalanuvchi "Ha, yarat"ni bossa — keyingi xabarda model
    // tarixdagi draftId bilan `confirm:true` bilan chaqiradi.
    const draftId = findDraftId(actions, reports);
    if (draftId && wantsCreation(input.message) && !appliedDraft) {
      appliedDraft = true;
      pushStep({
        type: "thinking",
        summary: "Qoralama tayyor — tasdiqlashingiz kutilmoqda",
      });
      const applied = await executeActions(
        [{ tool: "test.applyDraft", args: { draftId } }],
        ctx,
        pushStep,
        emitPhase,
        confirmEmit,
        pickEmit,
        input.message,
      );
if (applied.reply) reply = applied.reply;
      const appliedFile = takeFileArtifact(applied.toolReports);
      if (appliedFile) fileArtifact = appliedFile;
      if (applied.unverified.length) unverified = applied.unverified;
      reports.push(formatToolReports(applied.toolReports));
    }
  }

  // YAKUNIY NAZORAT: natija FAQAT tekshiruv o'tgandan keyin beriladi.
  // 1) Fayl so'ralgan, lekin haqiqiy fayl yo'q bo'lsa — "bajarildi" deyishga
  //    ruxsat yo'q: bitta aniq savol bilan to'xtaymiz.
  // 2) Biror vosita natijasi tekshiruvdan o'tmagan bo'lsa — "qildim" deb
  //    yozmaymiz, sababini va keyingi qadamni aniq aytib beramiz.
  if (unverified.length) {
    reply = unverifiedReply(unverified, verifyRetries);
  } else if (fileIntent && !fileArtifact && !isClarifyingReply(reply)) {
    reply = missingFileReply(input.message, steps);
  } else if (fileArtifact && reply && !reply.includes(fileArtifact.fileName)) {
    reply = `${fileArtifact.fileName} tayyor va tekshirildi — "Yuklab olish" kartasidan oling (yoki boshqa formatga o'tkazing).\n${reply}`;
  }

  if (!reply) {
    reply = executedAny
      ? steps
          .filter((s) => s.type === "result")
          .map((s) => s.summary)
          .filter(Boolean)
          .join("\n")
      : "Buyruqni tushunmadim. Nima qilishimni aniqroq yozing yoki В«imkoniyatlarВ» ro'yxatidan tanlang.";
  }

  if (askFailed && executedAny) {
    reply += "\n\n(Yakuniy javobni qisqartirishda model uzildi, lekin bajarilgan harakatlar natijasi yuqorida.)";
  }

  await finishTurn(conversation.id, reply, steps);

  return done({
    reply,
    steps,
    conversationId: conversation.id,
    usage: { promptTokens, completionTokens, cost, model: model.model, provider: model.name, latencyMs: Date.now() - started },
    providerLive: true,
  });
}

// ============================================================================
//  Vositalarni bajarish
// ============================================================================

/**
 * Har bir vositani ketma-ket bajaradi. `push` вЂ” qadamni pushing SAQLAYDI va
 * mijozga DARHOL yuboradi (streaming), `phase` вЂ” bosqich almashinishini
 * e'lon qiladi (analytics natijasi в†’ "dashboard yaratilmoqda").
 * `confirm` вЂ” vosita tasdiqlash so'raganda variantli tugmalarni yuboradi.
 */
async function executeActions(
  actions: { tool: string; args?: Record<string, unknown> }[],
  ctx: ToolContext,
  push: (step: AgentStep) => void,
  phase: (p: "plan" | "tools" | "dashboard" | "answer", label?: string) => void,
  confirm: (p: ConfirmPrompt) => void = () => {},
  pick: (p: PickPrompt) => void = () => {},
  goal: string = "",
) {
  const toolReports: { tool: string; ok: boolean; summary: string; data?: unknown }[] = [];
  const notes: string[] = [];
  /**
   * Tekshiruvdan o'tmagan natijalar. Ularni foydalanuvchiga BERMAYDI —
   * ular `runAgent` tomonda qayta urinishga qaytariladi.
   */
  const unverified: { tool: string; note: string }[] = [];

  for (const action of actions) {
    const def = visibleTools(ctx.actor).find((t) => t.name === action.tool);
    push({
      type: "action",
      tool: action.tool,
      title: def?.title || action.tool,
      args: action.args,
      summary: def ? def.description : "Noma'lum vosita",
    });

    const result: ToolResult = await runTool(action.tool, action.args ?? {}, ctx);

    // Vosita tasdiqlashni talab qildi (xavfli amal yoki qoralama).
    // Foydalanuvchiga YOZIB "tasdiqlang" deb aytmaymiz вЂ” chatga VARIANTLI
    // TUGMALAR chiqadi (Claude/Gemini/ChatGPT usuli). Bir bosish bilan javob.
    const pending = (result.data as { needsConfirm?: boolean; tool?: string } | null)?.needsConfirm;
    if (pending) {
      const prompt = buildConfirmPrompt(action.tool, action.args ?? {});
      push({
        type: "warning",
        summary: prompt.question,
      });
      confirm(prompt);
      break;
    }

    // Bir nechta moslik topilgan — foydalanuvchiga TUGMALAR ko'rsatamiz,
    // "qaysi biri?" deb yozib to'xtamaydi. Tanlanganda ish o'sha zahoti
    // davom etadi (foydalanuvchi qo'lda hech narsa yozmaydi).
    const exact = (result.data as { exact?: boolean } | null)?.exact;
    if (exact === false) {
      const prompt = buildPickPrompt(action.tool, result.data, goal);
      if (prompt) {
        pick(prompt);
        break;
      }
    }

    // Analytics natijasi keldi в†’ dashboard qurilishi e'lon qilinadi.
    // Mijoz shu bosqichda skelet-kartani animatsiya bilan ko'rsatadi.
    if (isDashboardStep(action.tool, result.data)) {
      phase("dashboard", "Dashboard yaratilmoqda");
    }

    push({
      type: "result",
      tool: action.tool,
      title: def?.title || action.tool,
      ok: result.ok,
      summary: result.summary,
      data: result.data,
      link: result.link ?? null,
      verified: result.verified,
      verifyNote: result.verifyNote,
    });

    // Tekshiruv natijasi: o'tmagan bo'lsa — foydalanuvchiga bermaymiz.
    if (result.verified === false) {
      unverified.push({ tool: action.tool, note: result.verifyNote || result.summary });
      push({
        type: "warning",
        summary: `Tekshiruv: ${action.tool} natijasi tasdiqlanmadi — ${result.verifyNote || result.summary}`,
      });
    }

    toolReports.push({
      tool: action.tool,
      ok: result.ok,
      summary: result.summary,
      // Vosita natijasi model uchun to'liq beriladi: u endi keyingi qadamda
      // aniq id/pochta bilan ishlay oladi (masalan user.search dan keyin).
      data: clipResult(result.data),
    });
    if (result.summary) notes.push(`${result.ok ? "вњ“" : "вњ—"} ${result.summary}`);

    // Xavfli amal tasdiqlanishni talab qilgan bo'lsa вЂ” shu yerda to'xtaymiz
    if (result.ok === false && /tasdiqlash/i.test(result.summary)) break;
  }

  return { reply: notes.join("\n"), toolReports, unverified };
}

/**
 * Modelga yuboriladigan natijani ixchamlashtiradi.
 *
 * ESKI (buzilgan) usul: matnni 20 000 belgidan kesib, qayta JSON.parse qilish.
 * Bu KATTA analitika natijalarida JSON tuzilmasini yarim qoldirib,
 * parse xatosi beradi va `catch` orqali `null` qaytaradi. Natija: model
 * bo'sh ma'lumot oladi va dashboard umuman CHIQMAYDI (foydalanuvchi
 * "ma'lumotlar yo'oldi" deb o'ylaydi). Bu aynan shu bug edi.
 *
 * YANGI usul: tuzilma SAQLANADI, faqat ichidagi ro'yxatlar qisqartiriladi
 * (masalan 500 qatorli `rows` -> 60 qator + "jami" sanagi). Natija har doim
 * yaroqli JSON bo'lib qoladi va dashboard chiziladi.
 */
function clipResult(data: unknown) {
  if (data == null) return null;

  const shrink = (value: unknown, depth = 0): unknown => {
    if (depth > 6) return null;
    if (Array.isArray(value)) {
      const head = value.slice(0, MAX_ROWS_PER_ARRAY).map((v) => shrink(v, depth + 1));
      return value.length > MAX_ROWS_PER_ARRAY
        ? [...head, { _truncated: true, _total: value.length, _shown: MAX_ROWS_PER_ARRAY }]
        : head;
    }
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = shrink(v, depth + 1);
      }
      return out;
    }
    // Uzun matnni kesamiz.
    if (typeof value === "string" && value.length > MAX_STRING_CHARS) {
      return value.slice(0, MAX_STRING_CHARS) + `… (+${value.length - MAX_STRING_CHARS} belgi)`;
    }
    return value;
  };

  try {
    return shrink(data);
  } catch {
    // Juda g'alati tuzilma bo'lsa — bo'sh obyekt. `null` emas: dashboard
    // yoki bo'sh bo'lib chiqmasligi uchun obyekt saqlaymiz.
    return {};
  }
}

/**
 * Vosita natijalarini odamga o'qiladigan qilib yig'adi.
 * Maqsad: model ro'yxatni to'liq ko'rsin вЂ” "3 ta topildi" facti va har bir
 * elementning tafsiloti (ism, bo'lim, lavozim, pochta) oldida tursin.
 */
function formatToolReports(reports: { tool: string; ok: boolean; summary: string; data?: unknown }[]) {
  return reports
    .map((r) => {
      const head = `### ${r.tool} в†’ ${r.ok ? "muvaffaqiyatli" : "xato"}: ${r.summary}`;
      const data: any = r.data;
      const rows: any[] | null =
        Array.isArray(data?.rows) ? data.rows
        : Array.isArray(data?.items) ? data.items
        : Array.isArray(data?.list) ? data.list
        : Array.isArray(data) ? data
        : null;

      if (!rows || rows.length === 0) {
        return `${head}\n${JSON.stringify(clipResult(data) ?? {}).slice(0, 4000)}`;
      }

      const lines = rows.slice(0, 30).map((row, i) => `${i + 1}. ${formatRow(row)}`);
      const tail = rows.length > 30 ? `\n... yana ${rows.length - 30} ta bor` : "";
      return `${head}\n${lines.join("\n")}${tail}`;
    })
    .join("\n\n");
}

/** Bitta elementni "Ism вЂ” bo'lim, lavozim вЂ” pochta (holat)" ko'rinishiga keltiradi. */
function formatRow(row: any): string {
  if (row == null || typeof row !== "object") return String(row);

  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = row[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return String(v);
    }
    return "";
  };

  const name = pick("fullName", "label", "name", "title", "fileName", "text") || "(nomsiz)";
  const dept = pick("department", "module", "course", "category", "group");
  const pos = pick("position", "role", "type", "parser");
  const mail = pick("email", "phone");
  const state = pick("status", "visibility", "result", "kind");
  const extra: string[] = [];
  if (dept) extra.push(dept);
  if (pos && pos !== dept) extra.push(pos);
  if (mail) extra.push(mail);
  if (state) extra.push(state);

  return extra.length ? `${name} вЂ” ${extra.join(", ")}` : String(name);
}

// ============================================================================
//  Suhbat saqlash
// ============================================================================

async function ensureConversation(input: AgentInput) {
  // Kunlik sessiya: 07:00 da yangi sessiya ochiladi, eskisi yopiladi.
  // Shu kunning ichida esa birinchi xabar sessiyani oladi va qaytadi.
  const daily = await openDailySession(input.actor.userId, input.conversationId || null);
  const conversation = await db.aiConversation.findUnique({ where: { id: daily.id } });
  if (conversation) return conversation;
  return daily;
}

async function persistMessage(conversationId: string, role: string, content: string, extra?: { actions?: unknown; error?: string }) {
  try {
    // Saqlash paytida `data` olib tashlanadi: 1) joyni tejalyi, 2)
    // eski xabarlarni qayta ochganda dashboard "har joyda" chiqib ketmaydi.
    // LEKIN: doc.* (fayl) natijalari uchun minimal karta ma'lumoti SAQLANADI —
    // aks holda sahifa yangilanganda "Yuklab olish" kartasi yo'qoladi.
    const lightActions = Array.isArray(extra?.actions)
      ? (extra.actions as any[]).map((s) => {
          if (s && typeof s === "object" && "data" in s) {
            try {
              const clone = { ...s };
              const d = (clone as any).data as Record<string, unknown> | null | undefined;
              if (
                typeof (clone as any).tool === "string" &&
                ((clone as any).tool as string).startsWith("doc.") &&
                d &&
                typeof d.downloadUrl === "string"
              ) {
                (clone as any).data = {
                  downloadUrl: d.downloadUrl,
                  fileName: d.fileName,
                  kind: d.kind,
                  size: d.size,
                  pages: d.pages,
                  fileId: d.fileId,
                };
              } else if (
                typeof (clone as any).tool === "string" &&
                ((clone as any).tool as string).startsWith("artifact.") &&
                d &&
                (typeof d.artifactUrl === "string" || typeof d.artifactId === "string")
              ) {
                // Artifact HTML'i bazada saqlangan — xabarda faqat ID/URL qoladi,
                // shuning uchun sahifa yangilanganda ham panel ishlaydi.
                (clone as any).data = {
                  artifactId: d.artifactId,
                  artifactUrl: d.artifactUrl,
                  title: d.title,
                  kind: d.kind,
                  bytes: d.bytes,
                };
} else if (
                typeof (clone as any).tool === "string" &&
                ((clone as any).tool as string) === "image.generate" &&
                d &&
                typeof d.imageUrl === "string"
              ) {
                // Rasm kartasi ham sahifa yangilanganda saqlanishi kerak.
                (clone as any).data = {
                  fileId: d.fileId,
                  fileName: d.fileName,
                  imageUrl: d.imageUrl,
                  mimeType: d.mimeType,
                  size: d.size,
                  prompt: d.prompt,
                  model: d.model,
                  kind: "image",
                };
              } else {
                delete (clone as any).data;
              }
              return clone;
            } catch {
              return s;
            }
          }
          return s;
        })
      : undefined;

    await db.aiMessage.create({
      data: {
        conversationId,
        role,
        content: clip(content, 30_000),
        actions: lightActions ? clip(JSON.stringify(lightActions), 60_000) : null,
        error: extra?.error || null,
      },
    });
    await db.aiConversation.update({
      where: { id: conversationId },
      data: { messageCount: { increment: 1 }, updatedAt: new Date() },
    });
  } catch (err) {
    console.error("[ai-agent] xabar saqlanmadi:", err);
  }
}

async function finishTurn(conversationId: string, reply: string, steps: AgentStep[]) {
  await persistMessage(conversationId, "assistant", reply, { actions: steps });
}

async function loadHistory(conversationId: string, currentMessage: string) {
  const rows = await db.aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: MAX_HISTORY_MESSAGES,
    select: { role: true, content: true },
  });
  return rows
    .reverse()
    .filter((m) => m.role !== "tool" && m.content !== currentMessage)
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: clip(m.content, 4000),
    }));
}

function emptyUsage() {
  return { promptTokens: 0, completionTokens: 0, cost: 0, model: "", provider: "", latencyMs: 0 };
}

// ============================================================================
//  O'chirilgan model uchun rejalashtiruvchi (zaxira)
// ============================================================================

/**
 * Kalit yo'q holat: so'z asosidagi niyatni aniqlab, tegishli vositani chaqiradi.
 * Bu to'liq o'rn bosmaydi РІР‚вЂќ lekin chat ishlashda davom etadi.
 */
function deterministicPlan(input: AgentInput, ctx: ToolContext) {
  const text = input.message.toLowerCase();
  const actions: { tool: string; args?: Record<string, unknown> }[] = [];

  const has = (...words: string[]) => words.some((w) => text.includes(w));

  if (has("statistik", "analitik", "umumiy", "qancha topshir")) {
    actions.push({ tool: "analytics.overview", args: {} });
  } else if (has("qaysi savol", "noto'g'ri", "zaif", "o'zlashtir")) {
    actions.push({ tool: "analytics.weakQuestions", args: {} });
  } else if (has("bo'lim")) {
    actions.push({ tool: "analytics.departments", args: {} });
  } else if (has("ruxsat", "qoidalar")) {
    actions.push({ tool: "access.rules.list", args: {} });
  } else if (has("holati", "qanday ishlayapti", "model")) {
    actions.push({ tool: "system.aiStatus", args: {} });
  } else if (has("qoralam")) {
    actions.push({ tool: "draft.list", args: {} });
  } else if (has("internet", "qidir")) {
    actions.push({ tool: "web.search", args: { query: input.message } });
  } else {
    actions.push({ tool: "analytics.overview", args: {} });
  }

  void ctx;
  return { actions };
}

/**
 * IXCHAM system prompt вЂ” balans kam bo'lganda.
 *
 * Nima uchun kerak: OpenRouter balans $0 bo'lganda butun so'rovga taxminan
 * 1200 token beradi. To'liq prompt (barcha vosita tavsiflari + skills +
 * holat + tarix) ~450 token, demak javobga ~600 token qoladi вЂ” juda tor.
 * Ixcham prompt vosita TAVSIFLARINI tushirib, faqat nomlarini saqlaydi va
 * model ishlayveradi. Sifat biroz pasayadi, lekin AI o'chmaydi.
 */
function buildCompactPrompt(actor: ToolActor) {
  const names = visibleTools(actor)
    .map((t) => t.name)
    .join(", ");
  return `Sen "Akela AI" вЂ” AKELA ta'lim platformasining admin assistentsan. Til: O'ZBEK.

FAQAT JSON qaytar: {"reply":"qisqa javob","actions":[{"tool":"nom","args":{...}}]}
Faqat quyidagi vositalarni chaqira olasan: ${names}

QOIDALAR:
- Amalda BAJAR, tavsiflama. "test yarat" desang вЂ” test.generate ni chaqirib,
  qaytgan draftId bilan test.applyDraft ni {"confirm":true} bilan chaqir.
  Ikkalasi ham kerak, aks holda test yaratilmagan.
- Test ishlashni boshlaganda avval skill.read bilan "tests.lifecycle" ni o'qi.
- Internet faqat so'ralganda: "internetdan", "qidirib" so'zlari bo'lsa
  mode:"web"; aks holda mode:"source" вЂ” tezroq.
- ID ni o'ylab topma: nom yoki pochta ber, vosita o'zi bazadan topsin.
- Fayl so'ralsa (Excel/Word/PDF yaratish, qayta yasash, formatni o'zgartirish):
  doc.excel / doc.word / doc.pdf bilan YARAT, qayta yaratish uchun file.list
  dan keyin doc.recreate. "downloadUrl" kelmasdan "yaratdim" DEYMA.
- Natija ro'yxat bo'lsa вЂ” TO'LIQ chiqar. Aynalma ("ehtimol", "tanlang") ishlatma.
- Xavfli amal (o'chirish, bloklash) вЂ” foydalanuvchi aniq tasdiqlamagan bo'lsa
  amalni bajarMA.`;
}

/**
 * Bir nechta moslik topilganda — TUGMA ro'yxati.
 *
 * Nima uchun: AI "qaysi biri?" deb yozib to'xtasa, foydalanuvchi qo'lda
 * javob yozishi kerak bo'lardi va ko'p qadam kerak edi. Endi topilganlar
 * tugma bo'lib chiqadi: bitta bosish — tanlov — ish davom etadi.
 *
 * `data` — vosita natijasi. Biz uning ichidagi `rows` ni o'qib, har biri
 * uchun tugma quramiz. Chiqarishni o'zimiz qilamiz (modelga bog'liq emas),
 * shuning uchun ro'yxat har doim to'g'ri chiqadi.
 */
function buildPickPrompt(
  tool: string,
  data: unknown,
  goal: string,
): PickPrompt | null {
  const rows = (data as { rows?: unknown[] } | null)?.rows;
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > 8) return null;

  const options: PickPrompt["options"] = [];
  for (const raw of rows) {
    const r = raw as Record<string, unknown>;
    const label =
      str(r.fullName) || str(r.user) || str(r.title) || str(r.name) || "";
    if (!label) continue;
    const detail =
      [str(r.department), str(r.position), str(r.email)]
        .filter(Boolean)
        .slice(0, 2)
        .join(" · ") || str(r.role);
    options.push({
      label,
      detail,
      // Tanlanganda modelga aniq identifikator borib ketadi — u qayta
      // qidirishga tushmaydi, to'g'ridan-to'g'ri ishni davom ettiradi.
      send: `${label}${r.email ? ` (${r.email})` : ""} ${goal}`.trim(),
    });
  }
  if (options.length < 2) return null;

  return { question: `Quyidagilardan qaysi biri?`, options };
}

function str(v: unknown, max = 120) {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/**
 * Bitta so'rovda BIR NECHTA xodimni tahlil qilishni tekshiradi.
 *
 * Nima uchun: foydalanuvchi "Sitorani test natijalari" deda — bitta
 * Sitora kerak. AI esa 3 ta topilib, hammasini ketma-ket tahlil qilib,
 * uchala dashboardni birdan ko'rsatdi. Bu noto'g'ri: foydalanuvchi bittasini
 * tanlamoqchi edi.
 *
 * Yechim: agar bitta qadamda 2+ xil xodim tahlil qilingan va foydalanuvchi
 * "hammasi/uchala/barcha" demagan bo'lsa — TUGMA ro'yxati chiqadi va turn
 * to'xtaydi. Tanlanganda faqat shu bir xodim tahlil qilinadi.
 */
function multiTargetPick(
  actions: { tool: string; args?: Record<string, unknown> }[],
  reports: string[],
  question: string,
): PickPrompt | null {
  // "hammasi" so'ralgan bo'lsa — tanlov kerak emas.
  if (/hammasi|barcha|uchala|uchalas|all\b|everyone|to'liq hamm/i.test(question)) return null;

  const targets = new Set<string>();
  for (const a of actions) {
    if (!/^analytics\.user$|^results\.list$/.test(a.tool)) continue;
    const u = str(a.args?.user) || str(a.args?.email);
    if (u) targets.add(u);
  }
  if (targets.size < 2) return null;

  // Topilgan xodimlar ro'yxatini qayta o'qiymiz (nom + pochta uchun).
  const options: PickPrompt["options"] = [];
  for (const rep of reports) {
    const id = rep.match(/"user"\s*:\s*"([^"]+)"/) || rep.match(/"email"\s*:\s*"([^"]+)"/);
    const name = rep.match(/"fullName"\s*:\s*"([^"]+)"/);
    if (!id && !name) continue;
    const label = name ? name[1] : id![1];
    if (options.some((o) => o.label === label)) continue;
    options.push({ label, detail: id ? id[1] : undefined, send: `${label} (${id ? id[1] : ""})` });
  }
  if (options.length < 2) return null;

  return { question: "Qaysi xodimni ko'rsatamiz?", options };
}

/**
 * Tasdiqlash uchun variantli tugmalar.
 *
 * Har bir holat uchun TURLI variantlar: foydalanuvchiga faqat "ha/yo'q"
 * emas, qaroriga yordam beradigan imkoniyatlar beriladi. Masalan test
 * qoralamasi uchun: tasdiqlash / qayta yaratish / ko'rib chiqish.
 */
function buildConfirmPrompt(
  tool: string,
  args: Record<string, unknown>,
): ConfirmPrompt {
  const name = String(args.title || args.name || args.email || "").trim();

  if (tool === "test.applyDraft") {
    return {
      question: name ? `"${name}" testini yaratish tayyor. Testni bazaga yozamizmi?` : "Testni bazaga yozamizmi?",
      tool,
      options: [
        { label: "Ha, yarat", send: "ha, testni yarat", variant: "primary" },
        { label: "Qayta yarat", send: "qayta yarat, savollarni boshqacha tuz", variant: "ghost" },
        { label: "Ko'rib chiqish", send: "qoralamani ko'rsat", variant: "ghost" },
        { label: "Bekor qilish", send: "bekor qil", variant: "ghost" },
      ],
    };
  }

  if (tool === "test.delete") {
    return {
      question: name ? `"${name}" testi butunlay o'chiriladi (qaytarib bo'lmaydi). Davom etamizmi?` : "Test butunlay o'chiriladi. Davom etamizmi?",
      tool,
      options: [
        { label: "Ha, o'chir", send: "ha, butunlay o'chir", variant: "danger" },
        { label: "Yo'q, bekor qil", send: "yo'q, bekor qil", variant: "ghost" },
      ],
    };
  }

  // Umumiy xavfli amal.
  return {
    question: name ? `"${name}" uchun amalni bajarishni tasdiqlaysizmi?` : "Bu amalni bajarishni tasdiqlaysizmi?",
    tool,
    options: [
      { label: "Ha, bajar", send: "ha, tasdiqlayman, bajar", variant: "primary" },
      { label: "Yo'q, bekor qil", send: "yo'q, bekor qil", variant: "ghost" },
    ],
  };
}

/**
 * Bajarilgan harakatlardan qaytgan `draftId` ni topadi.
 *
 * `test.generate` natijada `draftId` beradi; shu qiymat `test.applyDraft`
 * uchun kerak. Topish o'rniga modelga ishonish o'rniga вЂ” natijani to'g'ridan-
 * to'g'ri o'zimiz o'qiymiz, shunda zanjir model xatosiga bog'liq bo'lmaydi.
 */
function findDraftId(
  actions: { tool: string; args?: Record<string, unknown> }[],
  reports: string[],
): string | null {
  // 1) So'nggi hisobotda aniq `draftId` bormi (eng ishonchli).
  for (let i = reports.length - 1; i >= 0; i--) {
    const m = reports[i].match(/"draftId"\s*:\s*"([^"]+)"/);
    if (m) return m[1];
  }
  // 2) Zaxira: model args ichida draftId yuborgan bo'lsa.
  for (const a of actions) {
    const v = a.args?.draftId;
    if (typeof v === "string" && v.length >= 4) return v;
  }
  return null;
}

/**
 * Foydalanuvchi so'rovi aniq yaratish/yoqish niyatini bildiradimi.
 *
 * "Yarat" so'zini aytganda test haqiqatan kerak вЂ” demak rozilik bor va
 * `confirm:true` avtomatik qo'yish to'g'ri. Faqat "test yaratish mumkinmi"
 * kabi SAVOL bo'lsa, avtomatik tasdiqlash noto'g'ri bo'lardi вЂ” shuning uchun
 * savol belgisi bor savollarda tasdiqlanmaydi.
 */
function wantsCreation(text: string) {
  const t = (text || "").toLowerCase();
  if (/mumkinmi|qanday|bo'ladimi|kerakmi/.test(t)) return false;
  return /yarat|tuz|qo'sh|qoshib|joylashtir|ochir|yubor|o'zgartir/.test(t);
}

// ============================================================================
//  FAYL NAZORATI (Faza 4)
// ============================================================================

/**
 * Foydalanuvchi fayl YARATISH/QAYTA YARATISH so'rayaptimi?
 *
 * Nima uchun kerak: model "qildim" deb yozib to'xtab qo'yishi mumkin — bu
 * holatda hech qanday vosita chaqirilmaydi va foydalanuvchi hech narsa
 * olmaydi. Shu so'zlarni aniqlab, biz natijani tekshiramiz va fayl bo'lmasa
 * javobni TOXTAMAYMIZ.
 */
export function wantsFileOutput(text: string) {
  const t = (text || "").toLowerCase();
  const verb = /(yarat|yas|yoz|qayta|chiqar|eksport|export|tayyor|shakllan|qilib|qilish|qildi|o'?tkaz|faylga|download|yuklab)/.test(t);
  const noun = /(fayl|excel|xlsx|word|docx|pdf|hujjat|jadval|tabel|shartnoma|raport|hisobot.*(fayl|excel|pdf))/i.test(t);
  const recreate = /(qayta yas|boshqa nusxa|yana bir marta|yana bir fayl|yangilang|yangilab|obnovi)/.test(t);
  // Faqat ma'lumot so'rasak (masalan "statistikani ko'rsat") — fayl emas.
  if (/ko'rsat|qanday|qancha|qaysi|top|qidir/.test(t) && !recreate && !/(fayl|excel|word|pdf|hujjat)/i.test(t)) return false;
  return (verb && noun) || recreate;
}

/**
 * Vosita hisobotlaridan haqiqiy fayl natijasini oladi.
 *
 * FAQAT tekshiruvdan o'tgan (`verified !== false`) va `downloadUrl` bor natija
 * qabul qilinadi — shu bilan "fayl tayyor" degan yolg'on chiqmaydi.
 */
function takeFileArtifact(
  reports: { tool: string; ok: boolean; summary: string; data?: unknown }[],
): { fileName: string; kind?: string; size?: number } | null {
  for (const r of reports) {
    if (!/^(doc\.|report\.)/.test(r.tool) || !r.ok) continue;
    const d = (r.data || {}) as Record<string, unknown>;
    if (typeof d.downloadUrl !== "string" || !d.downloadUrl) continue;
    const fileName = String(d.fileName || "").trim() || "fayl";
    return { fileName, kind: typeof d.kind === "string" ? d.kind : undefined, size: Number(d.size) || undefined };
  }
  return null;
}

/** Tekshiruv xatolarini modelga qayta urinish uchun beriladigan matn. */
function formatUnverified(unverified: { tool: string; note: string }[]) {
  const lines = unverified.map((u) => `- ${u.tool}: ${u.note}`);
  return `### TEKSHIRUV O'TMADI (amal bajarildi deb hisoblanmadi)
${lines.join("\n")}

Bu natijalar bazadan/diskdan qayta o'qilganda tasdiqlanmadi. Sababni tuzat va
vositani TO'G'RI argumentlar bilan QAYTA chaqir. Muvaffaqiyatli natija kelmaguncha
ishni tugallangan deb hisoblaMA.`;
}

/** Tekshiruvdan o'tmagan natija uchun foydalanuvchiga beriladigan javob. */
function unverifiedReply(unverified: { tool: string; note: string }[], retries: number) {
  const lines = unverified.map((u) => `• ${u.tool}: ${u.note}`);
  return `Natija tekshiruvdan o'tmadi, shuning uchun uni bajarilgan deb hisoblamayman${
    retries > 0 ? ` (${retries} marta qayta urindim)` : ""
  }:\n${lines.join("\n")}\n\nNima bo'lgani: vosita chaqirildi, lekin natija bazada yoki diskda topilmadi. To'g'ri nishon yoki argumentni aniqlashtirib, "yana urinib ko'r" desangiz — darhol qayta qilaman.`;
}

/**
 * Model faylni yaratmaydi va ANIQ savol bilan to'xtadimi?
 *
 * Bu yomon holat emas — aksincha, to'g'ri holat: ma'lumot yetarli emas va
 * foydalanuvchidan bir narsa so'raladi. Bunday javobni bizning o'z
 * "hali yaratilmagan" matnimiz bilan almashtirmaymiz (modelning savoli ko'proq
 * aniq bo'ladi), lekin "qildim/yaratdim" DEGAN YOLG'ON bo'lsa — darhol
 * tuzatiladi.
 */
function isClarifyingReply(reply: string) {
  const t = (reply || "").trim();
  if (!t) return false;
  if (/(qildim|yaratdim|tayyor qildim|yaratildi|bo'ldi\b|tayyor bo'ldi)/i.test(t)) return false;
  return /\?/.test(t) || /(aytib bering|yozing|aniqlashtir|tushuntir|kerak edi|qanday|nechta|qaysi)/i.test(t);
}

/**
 * Fayl so'rangan, lekin fayl YARATILMAGAN holat.
 *
 * Bu yerda "yaratdim" DEYILMAYDI — bu aynan shu savdo shart edi: natija
 * tekshirilmaguncha foydalanuvchiga yolg'on aytilmaydi. Bitta aniq savol
 * beriladi (format/qatorlar), keyin darhol fayl quriladi.
 */
function missingFileReply(question: string, steps: AgentStep[]) {
  const wanted = detectWantedFormat(question);
  const asked =
    wanted === "excel"
      ? "Excel (.xlsx) faylini yasay. Qanday jadval kerak: ustunlar va qatorlar ro'yxatini yozing (yoki baza ma'lumotini aytib bering)."
      : wanted === "word"
        ? "Word (.docx) faylini yasay. Hujjat qanday tuzilishi kerak: sarlavhalar, bo'limlar va jadval ma'lumotini yozing."
        : "PDF faylini yasay. Hujjatda nima bo'lishi kerak: sarlavhalar, matn va jadval ma'lumotini yozing.";
  void steps;
  return `${asked}\n\n(Hali fayl yaratilmagan — matn yetarli bo'lmagani uchun bo'sh fayl yaratib yubormadim.)`;
}

/** Xabardan kerakli formatni topadi (doc.* tanlash uchun). */
function detectWantedFormat(text: string): "excel" | "word" | "pdf" {
  const t = (text || "").toLowerCase();
  if (/(excel|xlsx|jadval|tabel|ro'yxat|qator|ustun)/.test(t)) return "excel";
  if (/(word|docx|hujjat|shartnoma|ma'ruza|raport|reja)/.test(t)) return "word";
  if (/(pdf|chop et|bosib)/.test(t)) return "pdf";
  return "word";
}

/**
 * Chatga ko'rsatiladigan QISQA xato matni.
 *
 * `ProviderUnavailableError` o'zida allaqachon qisqa matn olib keladi
 * (`complete()` uni shunday yasaydi). Boshqa xatolarda esa xom matn
 * ishlatilmaydi: provayder javobi yuzlab belgili JSON bo'lishi mumkin
 * ("402 Payment Required: {json}") va u chatni to'sib qo'yadi hamda
 * foydalanuvchiga nima bo'ganini tushuntirmaydi.
 */
function shortProviderMessage(err: unknown) {
  if (err instanceof ProviderUnavailableError) return err.message;
  return userFacingProviderError("other");
}

/**
 * Birinchi qadam natijalaridan keyingi so'rov.
 *
 * Eng muhimi: bu yerda ham `actions` qaytishiga RUXSAT beriladi. Aks holda
 * model faqat gapirib qo'yadi va "test yaratdim" degan yolg'oni aytadi,
 * lekin hech narsa yaratmaydi вЂ” bu aynan shu muammoning tubi.
 *
 * `last` вЂ” so'rovlar tugagan bo'lsa, model endi faqat natijani qisqa
 * bayon qilishi kerakligi aytiladi (yana harakat qilmasin).
 */
function followUpPrompt(question: string, reports: string[], last: boolean) {
  return `SAVOL: ${question}

SHOQINGCHA BAJARILGAN HARAKATLAR VA ULARNING NATIJALARI:
${reports.join("\n\n")}

${
  last
    ? `Bu oxirgi imkoniyat. Endi FAQAT natijani qisqa (2-6 jumla) va ANIQ yoz. Yangi vosita CHAQIRMA вЂ” natijani bayon qil.`
    : `Vazifa BAJARILGANMI? Ayniqsa:
- "test yarat", "yarat", "tuz", "qo'sh" degan so'rov bo'lsa вЂ” test.generate dan keyin
  ALMASHINMASLIGING KERAK: uning natijasidagi draftId ni olib, test.applyDraft ni
  {"draftId":"...","confirm":true} bilan chaqir. Faqat test.generate yetarli EMAS вЂ”
  u faqat qoralama saqlaydi, test hali bazada YO'Q.
- "internetdan olib" degan so'rov bo'lsa вЂ” avval internetdan ma'lumot ol, SO'NG o'sha
  ma'lumotdan test yarat.
- Agar kerakli id/poc hali yo'q bo'lsa вЂ” tegishli qidiruv vositasini chaqir va QAYTARILGAN
  qiymatni (masalan draftId, xodim id) keyingi qadamda ishlat.
- Agar fayl so'ralgan bo'lsa (Excel/Word/PDF, "qayta yas", "yana bir fayl ber") va
  HALI hech qanday doc.* fayli yaratilmagan bo'lsa — bu HALI bajarilmagan:
  shu qadamda doc.excel / doc.word / doc.pdf ni darhol chaqir. Mavjud faylni
  qayta yaratish kerak bo'lsa: avval file.list, keyin doc.recreate.
  "downloadUrl" kelmagan holda "tayyor/yaratdim" deb YOZMA.

Vazifa bajarilgach "actions" ni BO'SH qoldir va natijani qisqa yoz. Qisqa javob berib,
ishni yarim qoldirma.`
}

FAQAT JSON: {"reply":"qisqa javob","actions":[{"tool":"vosita_nomi","args":{...}}]}`;
}

export { estimateCost, estimateTokens, provider };
