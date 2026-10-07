/**
 * lib/ai/provider.ts
 *
 * Yagona AI provayder qatlami. Loyihaning o'zida hech qanday LLM SDK yo'q вЂ”
 * shuning uchun bu qatlam barcha provayderlarni bitta "OpenAI-compatible"
 * shaklga keltiradi. Kalit faqat serverda qoladi, mijozga hech qachon
 * yuborilmaydi.
 *
 * Kalit topilmasa `offline` rejimga o'tadi: agent hali ham ishlaydi, savollar
 * manba matnidan deterministik (klose/ta'rif) usulda yig'iladi, vositalar
 * esa haqiqiy bazada bajariladi. Sabab: tizim В«kalit yo'qВ» holatida ham
 * to'liq funksional bo'lishi kerak.
 */

export type AiProviderKind = "openai" | "anthropic" | "gemini" | "offline";

export type AiProvider = {
  kind: AiProviderKind;
  /** UI uchun o'quvchi nom */
  name: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  temperature: number;
  maxOutputTokens: number;
  /** true bo'lsa, kalit bor */
  live: boolean;
};

export const OFFLINE_PROVIDER: AiProvider = {
  kind: "offline",
  name: "O'rnatilgan muallif (offline)",
  model: "deterministic-extractive-v1",
  baseUrl: "",
  apiKey: "",
  temperature: 0,
  maxOutputTokens: 0,
  live: false,
};

type Candidate = {
  kind: AiProviderKind;
  key: string;
  /** .env dagi AI_PROVIDER qiymatiga mos identifikator */
  id: string;
  name: string;
  baseUrl: string;
  envKeys: string[];
  defaultModel: string;
};

const OPENAI_COMPATIBLE: Candidate[] = [
  {
    kind: "openai",
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    envKeys: ["OPENAI_API_KEY"],
    defaultModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
    key: "",
  },
  {
    kind: "openai",
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    envKeys: ["OPENROUTER_API_KEY"],
    defaultModel: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    key: "",
  },
  {
    kind: "openai",
    id: "zai",
    name: "Z.AI (GLM)",
    baseUrl: "https://api.z.ai/api/paas/v4",
    envKeys: ["ZAI_API_KEY", "ZHIPUAI_API_KEY"],
    defaultModel: process.env.ZAI_MODEL || "glm-4-flash",
    key: "",
  },
  {
    kind: "openai",
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    envKeys: ["GROQ_API_KEY"],
    defaultModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    key: "",
  },
  {
    kind: "openai",
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    envKeys: ["DEEPSEEK_API_KEY"],
    defaultModel: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    key: "",
  },
  {
    kind: "openai",
    id: "together",
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    envKeys: ["TOGETHER_API_KEY"],
    defaultModel: process.env.TOGETHER_MODEL || "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    key: "",
  },
];

/**
 * Muhitdan AI provayderni aniqlaydi.
 *
 * MUHIM: `AI_PROVIDER` aniq ko'rsatilgan bo'lsa, u mutlaq ustun turadi.
 * Aks holda mashinada tasodifan o'rnatilgan boshqa kalit (masalan
 * ANTHROPIC_API_KEY) loyihaning o'z kalitini bosib ketishi mumkin.
 */
/**
 * Admin panel orqali saqlangan, BELGILANGAN kalit (serverless'da bitta
 * so'rov ichida bitta marta o'qiydi — global kesh).
 */
let __dbActiveKey: { provider: string; name: string; baseUrl: string; model: string; apiKey: string } | null = null;

/**
 * Kalitni bazadan olib `resolveProvider()` ga ulaydi.
 *
 * Nima uchun async kerak: `resolveProvider()` sinxron (ko'p joyda shunday
 * chaqiriladi), lekin kalit bazada saqlanadi. Shu sabab biz kalitni avval
 * shu funksiya orqali yuklab, keyin `resolveProvider()` ni oddiycha chaqiramiz.
 *
 * `.env` dagi kalit bo'lsa, DB umuman o'qilmaydi.
 */
export async function resolveProviderAsync(): Promise<AiProvider> {
  // 1) AVVAL bazadagi kalit (admin paneldan kiritilgan).
  //
  //    Sabab: avval `AI_API_KEY` mavjud bo'lsa bazadagi kalit BUTUNLAY
  //    e'tiborsiz qoldirilardi — ya'ni paneldan modelni o'zgartirsangiz
  //    u HECH QANDAY ta'sir ko'rsatmasdi va vidget boshqa model nomini
  //    ko'rsatib turardi. Endi admin qarori ustun.
  const fresh = Date.now() - __dbKeyAt < DB_KEY_TTL_MS;
  if (__dbActiveKey && fresh) return resolveProvider();
  try {
    const { getActiveKey } = await import("./key-store");
    __dbActiveKey = await getActiveKey();
    __dbKeyAt = Date.now();
  } catch {
    __dbActiveKey = null;
  }
  if (__dbActiveKey) return resolveProvider();

  // 2) Bazada kalit yo'q — `.env` kalitidan foydalanamiz
  return resolveProvider();
}

/**
 * Bazadagi kalit keshi — qancha vaqt saqlanadi.
 *
 * 8 soniya: paneldan model/kalit o'zgartirilgach darhol kuchga kiradi,
 * lekin har bir so'rovda bazaga urilmaydi.
 */
const DB_KEY_TTL_MS = 8000;
let __dbKeyAt = 0;

/** Serverless so'rov boshida keshni tozalaydi (ixtiyoriy). */
export function resetActiveKeyCache() {
  __dbActiveKey = null;
  __dbKeyAt = 0;
}

export function resolveProvider(): AiProvider {
  const temperature = clampNumber(process.env.AI_TEMPERATURE, 0, 2, 0.2);
  const maxOutputTokens = clampNumber(process.env.AI_MAX_TOKENS, 256, 32000, 4000);
  const forced = (process.env.AI_PROVIDER || "").trim().toLowerCase();

  const build = (
    kind: AiProviderKind,
    name: string,
    model: string,
    baseUrl: string,
    apiKey: string,
  ): AiProvider => ({
    kind,
    name,
    model,
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey,
    temperature,
    maxOutputTokens,
    live: true,
  });

  // 1) To'liq qo'lda berilgan ulanish
  const customKey = process.env.AI_API_KEY;
  if (customKey) {
    const kind = (forced === "anthropic" || forced === "gemini" ? forced : "openai") as AiProviderKind;
    return build(
      kind,
      process.env.AI_PROVIDER_NAME || "Maxsus ulanish",
      process.env.AI_MODEL || "gpt-4o-mini",
      process.env.AI_BASE_URL || defaultBaseFor(kind),
      customKey,
    );
  }

  // 1b) Admin panel orqali kiritilgan KALIT (baza, shifrlangan).
  //
  // Nima uchun shu yerda: foydalanuvchi bir nechta kalit saqlagan bo'lsa,
  // faqat BELGILANGANI (`isActive`) ishlatiladi — "hammasi ketma-ket" emas.
  // `.env` kaliti bo'lsa, u har doim ustun turadi (server sozlamasi kuchliroq).
  const dbKey = __dbActiveKey;
  if (dbKey) {
    const kind: AiProviderKind =
      dbKey.provider === "anthropic" ? "anthropic" : dbKey.provider === "gemini" ? "gemini" : "openai";
    return build(kind, dbKey.name, dbKey.model, dbKey.baseUrl, dbKey.apiKey);
  }

  // 2) Aniq talab qilingan provayder (AI_PROVIDER)
  if (forced) {
    const openaiCandidate = OPENAI_COMPATIBLE.find((c) => c.id === forced);
    if (openaiCandidate) {
      const key = firstEnv(openaiCandidate.envKeys);
      if (key) {
        return build(
          "openai",
          openaiCandidate.name,
          openaiCandidate.defaultModel,
          openaiCandidate.baseUrl,
          key,
        );
      }
    }
    if (forced === "anthropic") {
      const key = process.env.ANTHROPIC_API_KEY;
      if (key) {
        return build(
          "anthropic",
          "Anthropic",
          process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
          "https://api.anthropic.com/v1",
          key,
        );
      }
    }
    if (forced === "gemini") {
      const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (key) {
        return build(
          "gemini",
          "Google Gemini",
          process.env.GEMINI_MODEL || "gemini-2.0-flash",
          "https://generativelanguage.googleapis.com/v1beta",
          key,
        );
      }
    }
  }

  // 3) Avtomatik qidiruv: ochiq kalitlar
  for (const candidate of OPENAI_COMPATIBLE) {
    const key = firstEnv(candidate.envKeys);
    if (key) {
      return build("openai", candidate.name, candidate.defaultModel, candidate.baseUrl, key);
    }
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return build(
      "anthropic",
      "Anthropic",
      process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
      "https://api.anthropic.com/v1",
      anthropicKey,
    );
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    return build(
      "gemini",
      "Google Gemini",
      process.env.GEMINI_MODEL || "gemini-2.0-flash",
      "https://generativelanguage.googleapis.com/v1beta",
      geminiKey,
    );
  }

  return OFFLINE_PROVIDER;
}

function firstEnv(names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function defaultBaseFor(kind: AiProviderKind) {
  if (kind === "anthropic") return "https://api.anthropic.com/v1";
  if (kind === "gemini") return "https://generativelanguage.googleapis.com/v1beta";
  return "https://api.openai.com/v1";
}

function clampNumber(raw: string | undefined, min: number, max: number, fallback: number) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type CompletionResult = {
  text: string;
  promptTokens: number;
  completionTokens: number;
  model: string;
  provider: string;
  latencyMs: number;
  live: boolean;
  /** Provaider hisoblagan haqiqiy narx (USD). OpenRouter beradi. */
  cost: number;
};

/** Besh daqiqa вЂ” bitta modelga beriladigan maksimal kutish vaqti (dj talabi). */
export const MODEL_RESPONSE_LIMIT_MS = 300_000;

/**
 * O'rinbosar modellar: OpenRouter'da ochiq (`:free`) modellar. Kvota tugasa
 * yoki model javob bermasa вЂ” darhol shularga o'tiladi va sessiya uzilmaydi.
 *
 * RO'YXAT 2026-10 da `/api/v1/models` dan olingan haqiqiy katalogdan tuzilgan,
 * va avvalgi qo'lda yozilgan ro'yxat almashtirildi: uning ko'p modellari
 * endi 404 "This model is unavailable for free" beradi (mavjudlik vaqt bilan
 * o'zgaradi). Ro'yxatni yangilash:
 *   node scripts/probe-free-models.mjs
 *
 * `thinkingmachines/*` ataylab KIRITILMAGAN: ular faqat agentic harness'da
 * (kod agenti) ishlaydi va oddiy server so'rovi doim 403 beradi.
 */
const FREE_MODELS = [
  "stealth/space-bunny-alpha",
  "qwen/qwen3.8-27b:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3.5-lightning:free",
  "apodex/apodex-1.1-mini:free",
  "cohere/north-mini-code:free",
  "liquid/lfm-2.5-2.6b:free",
  "poolside/laguna-xs-2.1:free",
  "dots-studio/dots-3-note-preview:free",
  "inclusionai/ling-3.0-flash-sante:free",
  // Inkling — ishlaydi, LEKIN juda sekin (54-163 s). Faqat boshqa hech narsa
  // qolmaganda ishlatiladi, shuning uchun eng oxirida turadi.
  "thinkingmachines/inkling-small",
  "thinkingmachines/inkling",
];

/**
 * Chiqish tokenlarining eng past chegarasi. Bundan kichik so'rov ma'nosiz
 * (model javobni boshlab kesib qo'yadi), shuning uchun qayta urinishda ham
 * pastroqqa tushmaydi.
 */
const MIN_OUTPUT_TOKENS = 512;

/**
 * Prompt va javob o'rtasida qoldiriladigan zaxira. OpenRouter "afford" sonini
 * taxmin qilib beradi; chegarada yerga kelmasligi uchun bir oz bo'sh joy
 * qoldiramiz.
 */
const OUTPUT_SAFETY_MARGIN = 96;

type Health = {
  fails: number;
  blockedUntil: number;
  lastOk: number;
  totalCalls: number;
};

const health = new Map<string, Health>();

/** Xotirada (server jarayoni davomida) model sog'ligi. */
function healthOf(model: string): Health {
  const key = model;
  const row = health.get(key) || { fails: 0, blockedUntil: 0, lastOk: 0, totalCalls: 0 };
  health.set(key, row);
  return row;
}

/** Model joriy vaqtda ishlatilishi mumkinmi (bloklash muddati o'tmagan bo'lsin). */
export function isModelAvailable(model: string) {
  return Date.now() >= healthOf(model).blockedUntil;
}

/**
 * Model sog'ligini yangilaydi. Kvota/timeout xatosida vaqtincha bloklanadi вЂ”
 * keyingi so'rovlarda darhol boshqasiga o'tiladi.
 *
 * `daily` — bepul darajaning KUNLIK limiti tugagan. Bu holatda qayta
 * urinish ma'nosiz (kun oxirigacha), shuning uchun model uzoq bloklanadi:
 * aks holda har bir so'rovda 13 ta :free modelni bir-biriga urinish va
 * kutganimizcha kutish yuzaga keladi.
 */
function noteFailure(model: string, reason: "daily" | "quota" | "network") {
  const row = healthOf(model);
  row.fails++;
  const penaltyMs =
    reason === "daily" ? 6 * 60 * 60_000 : reason === "quota" ? 30 * 60_000 : 2 * 60_000;
  row.blockedUntil = Date.now() + Math.min(penaltyMs, row.fails * penaltyMs);
}

function noteSuccess(model: string) {
  const row = healthOf(model);
  row.fails = 0;
  row.blockedUntil = 0;
  row.lastOk = Date.now();
  row.totalCalls++;
}

/**
 * Ishlagan modelni eslab qolamiz va keyingi so'rovlarda zanjirning boshiga
 * qo'yamiz. Sabab: bir marta ishlagan model keyingi so'rovda ham ishlaydi —
 * aks holda har ketchasida to'lovli (kvotasi tuggan) modellar sinab o'tib,
 * foydalanuvchi har gal kutadi va oxirida xato ko'radi.
 */
let preferredModel = "";

function promoteModel(model: string) {
  if (model) preferredModel = model;
}

/** Hozir birinchi urinishda ishlatiladigan model (bo'lsa). */
export function preferredModelName() {
  return preferredModel;
}

/**
 * Xatoning o'zida nechta token ruxsat berilganini o'qiydi.
 *
 * OpenRouter "but can only afford 4997" deb yozadi — bu son e'lon qilingan
 * `max_tokens` ni qisqartirish uchun aynan kerak. Yo'q bo'lsa `null`:
 * keyinchilik chalkashtirilmasligi uchun o'xshash sonlarni o'ylab topmaymiz.
 */
function affordableLimit(err: any): number | null {
  const msg = String(err?.message || "");
  const m = msg.match(/can only afford\s+(\d+)/i) || msg.match(/afford(?:s)?\s+(\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Chatga ko'rsatiladigan QISQA xato matni. Xom provayder JSON'i chatga tushmaydi. */
export function userFacingProviderError(reason: "daily" | "quota" | "network" | "other") {
  if (reason === "daily") {
    return "OpenRouter bepul modellari kunlik limitda: kuniga 50 ta so'rov beriladi va bugun ular tugagan. Limitni oshirish uchun OpenRouter hisobiga $10 qo'ying (kuniga 1000 ta bo'ladi), yoki balansni to'ldiring — to'lovli modellar shundan keyin to'liq ishlaydi.";
  }
  if (reason === "quota") {
    return "AI modeli uchun balans tugagan — barcha modellar ishlamadi. OpenRouter hisobini to'ldiring yoki .env dagi AI_MODEL ni arzon modelga o'tkazing.";
  }
  if (reason === "network") {
    return "AI modellari vaqtida javob bermadi. Internet yoki provayder aloqasini tekshiring.";
  }
  return "AI modeliga ulanishda xato yuz berdi. Kalit va internetni tekshiring.";
}

/**
 * Barcha modellar ishlamaganda tashlanadigan xato.
 *
 * `.message` — qisqa, foydalanuvchiga ko'rsatishga mo'ljallangan.
 * `.details` — to'liq diagnostika (singan modellar, provayder javobi):
 * faqat server logida va "AI tizimi holati" vositasida ishlatiladi.
 */
export class ProviderUnavailableError extends Error {
  details: {
    reason: "daily" | "quota" | "network" | "other";
    attempted: string[];
    skipped: string[];
    cause?: Error | null;
  };

  constructor(
    message: string,
    details: { reason: "daily" | "quota" | "network" | "other"; attempted: string[]; skipped: string[]; cause?: Error | null },
  ) {
    super(message);
    this.name = "ProviderUnavailableError";
    this.details = details;
  }
}

/** Barcha modellar holati вЂ” UI va "AI tizimi holati" vositasi uchun. */
export function modelHealthReport() {
  return [...health.entries()].map(([model, row]) => ({
    model,
    fails: row.fails,
    calls: row.totalCalls,
    blockedForSec: Math.max(0, Math.round((row.blockedUntil - Date.now()) / 1000)),
    available: isModelAvailable(model),
  }));
}

/** UI uchun: qaysi modellar ketma-ket sinanadi. */
export function providerChainInfo(provider: AiProvider) {
  return modelChain(provider).map((p, i) => ({
    order: i + 1,
    model: p.model,
    free: p.model.endsWith(":free"),
    available: isModelAvailable(p.model),
  }));
}

/**
 * Barcha provayderlar uchun yagona matn kengaytirish nuqtasi.
 *
 * ZAXIRA ZANJIR: asosiy model в†’ to'lovli zaxiralar в†’ ochiq (free) modellar.
 * Model kvotasi tugagan, 5 daqiqa javob bermagan yoki tarmoq xatosi bo'lsa вЂ”
 * darhol keyingisiga o'tiladi. Sessiya hech qachon to'xtamaydi.
 */
export async function complete(
  messages: ChatMessage[],
  opts: {
    provider?: AiProvider;
    timeoutMs?: number;
    maxOutputTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
  } = {},
): Promise<CompletionResult> {
  const provider = opts.provider || resolveProvider();
  const started = Date.now();

  if (!provider.live) {
    return {
      text: "",
      promptTokens: estimateTokens(messages.map((m) => m.content).join("\n")),
      completionTokens: 0,
      model: provider.model,
      provider: provider.name,
      latencyMs: Date.now() - started,
      live: false,
      cost: 0,
    };
  }

  const chain = modelChain(provider);
  const attempted: string[] = [];
  const skipped: string[] = [];
  let lastError: Error | null = null;
  let lastReason: "daily" | "quota" | "network" | "other" = "other";

  /** Bitta modelni aynan shu token budjeti bilan chaqiradi. */
  const attempt = (candidate: AiProvider, budget: number, timeoutMs: number) =>
    callProvider(
      { ...candidate, temperature: opts.temperature ?? provider.temperature },
      messages,
      {
        timeoutMs,
        maxOutputTokens: budget,
        temperature: opts.temperature ?? provider.temperature,
        signal: opts.signal,
      },
    );

  for (let i = 0; i < chain.length; i++) {
    const candidate = chain[i];

    if (i > 0 && !isModelAvailable(candidate.model)) {
      skipped.push(candidate.model);
      continue;
    }

    attempted.push(candidate.model);
    // Birinchi urinish: 5 daqiqa. Keyingi modellar tezroq sinov qilinadi.
    const budget =
      i === 0
        ? (opts.maxOutputTokens ?? provider.maxOutputTokens)
        : Math.min(2500, provider.maxOutputTokens);
    const timeoutMs = opts.timeoutMs ?? (i === 0 ? MODEL_RESPONSE_LIMIT_MS : 90_000);

    try {
      const res = await attempt(candidate, budget, timeoutMs);
      noteSuccess(candidate.model);
      promoteModel(candidate.model);
      return { ...res, latencyMs: Date.now() - started, live: true };
    } catch (err: any) {
      lastError = err;

      // KVOTA: OpenRouter so'rovni oldindan tekshiradi va `max_tokens` ning
      // O'ZI haqiqiy javob uchun kerak bo'lgandan katta ekanini kvotaga
      // solishtiradi ("requested up to 16384, but can only afford 4997").
      // Ya'ni model yetarli bo'lishi mumkin — faqat e'lon qilingan byudjet
      // katta. Shuning uchun provayder aytgan chegara bo'yicha qayta
      // urinish qilinadi: ko'p hollarda to'lovli model shu yerda qutqariladi
      // va zaxiraga umuman o'tib ketmaydi.
      if (isQuotaIssue(err)) {
        lastReason = "quota";
        // Bepul darajaning kunlik limiti — alohida: qayta urinish ma'nosiz,
        // keyingi modelga o'tish ham vaqtinchalik yordam bermaydi.
        if (isFreeTierLimit(err)) lastReason = "daily";

        const affordable = affordableLimit(err);
        // Limit 402 (balans) bo'lsa qisqartirish mumkin; 429 (kunlik limit)
        // esa max_tokens bilan bog'liq emas — shuning uchun faqat 402 da.
        //
        // MUHIM: provayderdagi "can only afford N" — bu butun so'rovga
        // (prompt + javob) ajratilgan token, max_tokens EMAS. Agar uni
        // to'g'ridan-to'g'ri max_tokens ga bersak, promptning o'zidan keyin
        // yana 402 olamiz. Shuning uchun prompt hajmi avval aytiladi.
        const promptTokens = estimateTokens(messages.map((m) => m.content).join("\n"));
        const shrunk =
          affordable
            ? Math.max(0, affordable - promptTokens - OUTPUT_SAFETY_MARGIN)
            : 0;

        if (shrunk >= MIN_OUTPUT_TOKENS && shrunk < budget) {
          try {
            const res = await attempt(candidate, shrunk, timeoutMs);
            noteSuccess(candidate.model);
            promoteModel(candidate.model);
            return { ...res, latencyMs: Date.now() - started, live: true };
          } catch (retryErr: any) {
            lastError = retryErr;
            if (isQuotaIssue(retryErr)) lastReason = isFreeTierLimit(retryErr) ? "daily" : "quota";
            else if (isTimeout(retryErr)) lastReason = "network";
          }
        }
      } else if (isTimeout(err)) {
        lastReason = "network";
      }

      noteFailure(
        candidate.model,
        lastReason === "daily" ? "daily" : isQuotaIssue(err) ? "quota" : "network",
      );
      // Muvaffaqiyatsiz bo'lsa вЂ” keyingi modelga darhol o'tamiz (qayta urinish yo'q)
    }
  }

  // Barchasi tugagan. Sabab serverda qoladi, chatga esa QISQA matn boradi:
  // provayder xatosi 400+ belgilik JSON bo'lib, chatda o'zi to'sib qo'yadi.
  console.error(
    `[ai-provider] barcha modellar ishlamadi. sabab=${lastReason} sinangan=${attempted.join(", ")}${
      skipped.length ? ` bloklangan=${skipped.join(", ")}` : ""
    }\n`,
    lastError?.message,
  );

  throw new ProviderUnavailableError(userFacingProviderError(lastReason), {
    reason: lastReason,
    attempted,
    skipped,
    cause: lastError,
  });
}

/** Asosiy model + to'lovli zaxiralar + ochiq (free) modellar. */
function modelChain(provider: AiProvider): AiProvider[] {
  const base: AiProvider = { ...provider };
  if (provider.kind !== "openai") return [base];

  const configured = (process.env.AI_FALLBACK_MODELS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const extra = process.env.AI_FREE_MODELS_OVERRIDE
    ? process.env.AI_FREE_MODELS_OVERRIDE.split(",").map((s) => s.trim()).filter(Boolean)
    : FREE_MODELS;

  const paid = configured.filter((m) => !m.endsWith(":free"));
  const free = [...configured.filter((m) => m.endsWith(":free")), ...extra];

  const seen = new Set<string>([provider.model]);
  const chain: AiProvider[] = [base];
  for (const model of [...paid, ...free]) {
    if (seen.has(model)) continue;
    seen.add(model);
    chain.push({ ...base, model });
  }

  // Ishlab topgan model birinchi bo'lib turadi (tizim shunga o'tadi).
  if (preferredModel && preferredModel !== provider.model) {
    const at = chain.findIndex((p) => p.model === preferredModel);
    if (at > 0) {
      const [winner] = chain.splice(at, 1);
      chain.unshift(winner);
    }
  }

  return chain;
}

/**
 * Kvota tugagan / model mavjud emas вЂ” keyingi modelga o'tish kerak.
 *
 * 429 alohida ahamiyatga ega: OpenRouter bepul darajada kuniga 50 ta so'rov
 * beradi va tugaganda 429 qaytaradi ("Add 10 credits to unlock 1000 free
 * model requests per day"). Bu "tarmoq uzilishi" EMAS — soatlar bo'yi
 * urinishning foydasi yo'q, shuning uchun u kvota sinfida va uzoq bloklanadi.
 */
function isQuotaIssue(err: any) {
  const status = Number(err?.status || 0);
  if (status === 402) return true;
  const msg = String(err?.message || "");
  if (/free-models-per-day|free-models-per-min|add \d+ credits to unlock|daily limit|rate limit exceeded/i.test(msg)) {
    return true;
  }
  return /insufficient credit|exceed your available credits|never purchased credits|no endpoints|model.*not found|payment required|unavailable for free/i.test(
    msg,
  );
}

/** 429 — bepul darajaning kunlik/da'vatlik limiti. Aniq sababni ajratadi. */
function isFreeTierLimit(err: any) {
  const msg = String(err?.message || "");
  return /free-models-per-day|add \d+ credits to unlock|daily limit/i.test(msg);
}

/** 5 daqiqa oshdi (dj talabi) yoki tarmoq uzildi. */
function isTimeout(err: any) {
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return true;
  const msg = String(err?.message || "");
  return /timeout|timed out|ETIMEDOUT|socket hang up|fetch failed|network/i.test(msg);
}

async function callProvider(
  provider: AiProvider,
  messages: ChatMessage[],
  opts: { timeoutMs: number; maxOutputTokens: number; temperature: number; signal?: AbortSignal },
): Promise<Omit<CompletionResult, "latencyMs" | "live">> {
  const timeout = AbortSignal.timeout(opts.timeoutMs);
  const signal = opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout;

  let response: Response;
  let text: string;

  if (provider.kind === "anthropic") {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const rest = messages.filter((m) => m.role !== "system");
    response = await fetch(`${provider.baseUrl}/messages`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": provider.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: opts.maxOutputTokens,
        temperature: opts.temperature,
        system: system || undefined,
        messages: rest.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    const data = await readJson(response);
    text = Array.isArray(data?.content)
      ? data.content.map((c: any) => (typeof c?.text === "string" ? c.text : "")).join("")
      : "";
    return {
      text: text || "",
      promptTokens: Number(data?.usage?.input_tokens || 0),
      completionTokens: Number(data?.usage?.output_tokens || 0),
      model: provider.model,
      provider: provider.name,
      cost: estimateCost(
        Number(data?.usage?.input_tokens || 0),
        Number(data?.usage?.output_tokens || 0),
        provider,
      ),
    };
  }

  if (provider.kind === "gemini") {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const rest = messages.filter((m) => m.role !== "system");
    response = await fetch(
      `${provider.baseUrl}/models/${provider.model}:generateContent`,
      {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          // Kalit header'da — URL query'da log/keshga tushib qolmasligi uchun
          "x-goog-api-key": provider.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents: rest.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          generationConfig: {
            temperature: opts.temperature,
            maxOutputTokens: opts.maxOutputTokens,
            responseMimeType: "application/json",
          },
        }),
      },
    );
    const data = await readJson(response);
    const parts = data?.candidates?.[0]?.content?.parts;
    text = Array.isArray(parts) ? parts.map((p: any) => p?.text || "").join("") : "";
    return {
      text,
      promptTokens: Number(data?.usageMetadata?.promptTokenCount || 0),
      completionTokens: Number(data?.usageMetadata?.candidatesTokenCount || 0),
      model: provider.model,
      provider: provider.name,
      cost: estimateCost(
        Number(data?.usageMetadata?.promptTokenCount || 0),
        Number(data?.usageMetadata?.candidatesTokenCount || 0),
        provider,
      ),
    };
  }

  response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.apiKey}`,
      ...(provider.name === "OpenRouter"
        ? { "HTTP-Referer": "https://akela.uz", "X-Title": "Akela AI" }
        : {}),
    },
    body: JSON.stringify({
      model: provider.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: opts.temperature,
      max_output_tokens: opts.maxOutputTokens,
      response_format: { type: "json_object" },
    }),
  });

  const data = await readJson(response);
  text = data?.choices?.[0]?.message?.content ?? "";
  const promptTokens = Number(data?.usage?.prompt_tokens || 0);
  const completionTokens = Number(data?.usage?.completion_tokens || 0);
  // OpenRouter haqiqiy narxni qaytaradi вЂ” taxmindan afzal.
  const reportedCost = Number(data?.usage?.cost);
  return {
    text: typeof text === "string" ? text : JSON.stringify(text),
    promptTokens,
    completionTokens,
    model: provider.model,
    provider: provider.name,
    cost: Number.isFinite(reportedCost) && reportedCost > 0
      ? reportedCost
      : estimateCost(promptTokens, completionTokens, provider),
  };
}

async function readJson(response: Response) {
  const raw = await response.text();
  if (!response.ok) {
    const snippet = raw.slice(0, 400);
    const err = new Error(`${response.status} ${response.statusText}: ${snippet}`) as Error & {
      status?: number;
    };
    err.status = response.status;
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error("Provaider javobi JSON emas") as Error & { status?: number };
    err.status = 502;
    throw err;
  }
}

export function estimateTokens(text: string) {
  // O'zbek/Rus matnlari uchun taxminiy 3.2 belgi = 1 token.
  return Math.ceil((text || "").length / 3.2);
}

/**
 * Narxni taxminlash (1K token). Narxlar 2026-yilgi o'rtacha ochiq narxlar;
 * aniq narx provayder billing hisobotidan olinadi.
 */
export function estimateCost(promptTokens: number, completionTokens: number, provider: AiProvider) {
  const per1k = providerRate(provider);
  return (promptTokens / 1000) * per1k.in + (completionTokens / 1000) * per1k.out;
}

function providerRate(provider: AiProvider) {
  switch (provider.name) {
    case "OpenAI":
      return { in: 0.00015, out: 0.0006 };
    case "Anthropic":
      return { in: 0.003, out: 0.015 };
    case "Google Gemini":
      return { in: 0.0001, out: 0.0004 };
    case "OpenRouter":
      return { in: 0.0005, out: 0.0015 };
    default:
      return { in: 0.0002, out: 0.0008 };
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * SSE stream'dan `data:` qatorlarini o'qib, har bir JSON payload'ni
 * callback'ga beradi. `[DONE]` yoki oqim tugashi bilan yakunlanadi.
 */
async function readSseStream(
  response: Response,
  onPayload: (data: any) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!response.ok || !response.body) {
    await readJson(response); // xato bo'lsa shu yerda tashlaydi
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    if (signal?.aborted) {
      try { await reader.cancel(); } catch { /* e'tibor bermaymiz */ }
      throw new DOMException("So'rov bekor qilindi", "AbortError");
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        onPayload(JSON.parse(payload));
      } catch {
        /* yarim JSON — keyingi chunk'da to'ladi */
      }
    }
  }
}

/** Bitta modelga stream so'rov: to'liq matn + usage qaytaradi, delta'lar jonli. */
async function callProviderStream(
  provider: AiProvider,
  messages: ChatMessage[],
  opts: { timeoutMs: number; maxOutputTokens: number; temperature: number; signal?: AbortSignal; onDelta: (text: string) => void },
): Promise<Omit<CompletionResult, "latencyMs" | "live">> {
  const timeout = AbortSignal.timeout(opts.timeoutMs);
  const signal = opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout;

  let fullText = "";
  let promptTokens = 0;
  let completionTokens = 0;

  if (provider.kind === "anthropic") {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const rest = messages.filter((m) => m.role !== "system");
    const response = await fetch(`${provider.baseUrl}/messages`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": provider.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: opts.maxOutputTokens,
        temperature: opts.temperature,
        stream: true,
        system: system || undefined,
        messages: rest.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    await readSseStream(response, (data) => {
      if (data?.type === "message_start" && data?.message?.usage) {
        promptTokens = Number(data.message.usage.input_tokens || 0);
      } else if (data?.type === "content_block_delta" && typeof data?.delta?.text === "string") {
        fullText += data.delta.text;
        opts.onDelta(data.delta.text);
      } else if (data?.type === "message_delta" && data?.usage) {
        completionTokens = Number(data.usage.output_tokens || 0);
      }
    }, signal);
  } else if (provider.kind === "gemini") {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const rest = messages.filter((m) => m.role !== "system");
    const response = await fetch(
      `${provider.baseUrl}/models/${provider.model}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": provider.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents: rest.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          generationConfig: {
            temperature: opts.temperature,
            maxOutputTokens: opts.maxOutputTokens,
            responseMimeType: "application/json",
          },
        }),
      },
    );
    await readSseStream(response, (data) => {
      const parts = data?.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        for (const p of parts) {
          if (typeof p?.text === "string" && p.text) {
            fullText += p.text;
            opts.onDelta(p.text);
          }
        }
      }
      const usage = data?.usageMetadata;
      if (usage) {
        promptTokens = Number(usage.promptTokenCount || promptTokens);
        completionTokens = Number(usage.candidatesTokenCount || completionTokens);
      }
    }, signal);
  } else {
    // OpenAI-compatible (OpenAI, OpenRouter, Groq, DeepSeek, Together, Z.AI)
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${provider.apiKey}`,
        ...(provider.name === "OpenRouter"
          ? { "HTTP-Referer": "https://akela.uz", "X-Title": "Akela AI" }
          : {}),
      },
      body: JSON.stringify({
        model: provider.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: opts.temperature,
        max_output_tokens: opts.maxOutputTokens,
        response_format: { type: "json_object" },
        stream: true,
        stream_options: { include_usage: true },
      }),
    });
    await readSseStream(response, (data) => {
      const delta = data?.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) {
        fullText += delta;
        opts.onDelta(delta);
      }
      const usage = data?.usage;
      if (usage) {
        promptTokens = Number(usage.prompt_tokens || promptTokens);
        completionTokens = Number(usage.completion_tokens || completionTokens);
      }
    }, signal);
  }

  if (!fullText) {
    throw new Error("Stream bo'sh keldi — model javob bermadi");
  }
  if (!promptTokens) promptTokens = estimateTokens(messages.map((m) => m.content).join("\n"));
  if (!completionTokens) completionTokens = estimateTokens(fullText);
  return {
    text: fullText,
    promptTokens,
    completionTokens,
    model: provider.model,
    provider: provider.name,
    cost: estimateCost(promptTokens, completionTokens, provider),
  };
}

/**
 * Streaming completion: zanjir bo'ylab birinchi ishlagan modeldan
 * token-level delta'lar jonli keladi. Stream o'rtada uzilsa yoki
 * barcha modellar ishlamasa — xato tashlaydi (chaqiruvchi non-stream
 * `complete()` ga qaytishi mumkin).
 */
export async function completeStream(
  messages: ChatMessage[],
  opts: {
    provider?: AiProvider;
    timeoutMs?: number;
    maxOutputTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
    onDelta: (text: string) => void;
  },
): Promise<CompletionResult> {
  const provider = opts.provider || resolveProvider();
  const started = Date.now();

  if (!provider.live) {
    return {
      text: "",
      promptTokens: estimateTokens(messages.map((m) => m.content).join("\n")),
      completionTokens: 0,
      model: provider.model,
      provider: provider.name,
      latencyMs: Date.now() - started,
      live: false,
      cost: 0,
    };
  }

  const chain = modelChain(provider);
  let lastError: Error | null = null;
  let lastReason: "daily" | "quota" | "network" | "other" = "other";
  const attempted: string[] = [];

  for (let i = 0; i < chain.length; i++) {
    const candidate = chain[i];
    if (i > 0 && !isModelAvailable(candidate.model)) continue;
    attempted.push(candidate.model);
    const budget = i === 0
      ? (opts.maxOutputTokens ?? provider.maxOutputTokens)
      : Math.min(2500, provider.maxOutputTokens);
    const timeoutMs = opts.timeoutMs ?? (i === 0 ? MODEL_RESPONSE_LIMIT_MS : 90_000);
    try {
      const res = await callProviderStream(
        { ...candidate, temperature: opts.temperature ?? provider.temperature },
        messages,
        {
          timeoutMs,
          maxOutputTokens: budget,
          temperature: opts.temperature ?? provider.temperature,
          signal: opts.signal,
          onDelta: opts.onDelta,
        },
      );
      noteSuccess(candidate.model);
      promoteModel(candidate.model);
      return { ...res, latencyMs: Date.now() - started, live: true };
    } catch (err: any) {
      lastError = err;
      if (isQuotaIssue(err)) lastReason = isFreeTierLimit(err) ? "daily" : "quota";
      else if (isTimeout(err)) lastReason = "network";
      else lastReason = "other";
      noteFailure(
        candidate.model,
        lastReason === "daily" ? "daily" : isQuotaIssue(err) ? "quota" : "network",
      );
    }
  }

  throw new ProviderUnavailableError(userFacingProviderError(lastReason), {
    reason: lastReason,
    attempted,
    skipped: [],
    cause: lastError,
  });
}