/**
 * lib/ai/image.ts
 *
 * Faza 5 — RASM GENERATSIYASI (adapter + zaxira + chegara).
 *
 * Nima uchun shu shaklda:
 *  - OpenRouter'da rasm chiqaradigan modellar `modalities: ["image","text"]`
 *    bilan chaqiriladi va javobda `message.images[].image_url.url` qaytadi —
 *    ya'ni OpenAI `images/generations` emas. Shu sabab adapter qo'lda yozildi.
 *  - Model zanjiri (chain): birinchi xato kelsa keyingisiga o'tiladi. Sabab
 *    oddiy: bitta model mavjud emas, limitda yoki 402 (balans) bo'lishi mumkin.
 *  - 402 bo'lsa xabar o'zbekcha va aniq: "OpenRouter balansida rasm uchun mablag'
 *    yo'q" — foydalanuvchi nima qilishini biladi (nima qilish emasligini ham).
 *  - `AI_IMAGE_BASE_URL` orqali boshqa mos API (OpenAI-compatible) ulanadi —
 *    testda ham shu yerdan lokal stubga ulanadi.
 *
 * Xavfsizlik: rasm fayli faqat `upload/ai-files/` ichiga yoziladi (yuklab
 * olish route'i aynan shu papkani tekshiradi) va `AiFile` orqali imzolangan
 * URL beriladi.
 */

import { createHmac } from "node:crypto";
import { db } from "@/lib/db";

/** Rasm modellari zanjiri — birinchisi asosiy, qolganlari zaxira. */
export const IMAGE_MODEL_CHAIN: string[] = (
  process.env.AI_IMAGE_MODELS ||
  "google/gemini-2.5-flash-image,google/gemini-3.1-flash-lite-image,google/gemini-3.1-flash-image-preview,openai/gpt-5-image-mini"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function apiKey(): string {
  return process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY || "";
}

function baseUrl(): string {
  return (process.env.AI_IMAGE_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
}

/** Kunlik rasm limiti (AI_IMAGE_DAILY_LIMIT, standart 20). */
export function imageDailyLimit(): number {
  const n = Number(process.env.AI_IMAGE_DAILY_LIMIT || 20);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 20;
}

/** Bugungi rasm soni (audit jadvali orqali — alohida jadval kerak emas). */
export async function imagesUsedToday(userId?: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  return db.aiAuditLog.count({
    where: {
      action: "image.generate",
      outcome: "ok",
      createdAt: { gte: new Date(`${today}T00:00:00.000Z`) },
      ...(userId ? { actorId: userId } : {}),
    },
  });
}

/** O'lcham → aspect ratio (OpenRouter `image_config.aspect_ratio`). */
const SIZE_TO_ASPECT: Record<string, string> = {
  "1:1": "1:1",
  square: "1:1",
  "4:3": "4:3",
  landscape: "4:3",
  "16:9": "16:9",
  wide: "16:9",
  "3:4": "3:4",
  portrait: "3:4",
  "9:16": "9:16",
  story: "9:16",
};

export type ImageSize = keyof typeof SIZE_TO_ASPECT;

export const IMAGE_SIZES = Object.keys(SIZE_TO_ASPECT);

/**
 * Promptni to'liq shaklga keltiradi.
 *
 * Nega alohida: modelga sof foydalanuvchi matni yetarli emas — o'zbek tilidagi
 * so'rovni aniq vizual tashkilotga aylantirish kerak ( sifat, yorug'lik,
 * kompozitsiya, matn yo'q ).
 */
export function buildImagePrompt(input: { prompt: string; size?: string; style?: string }): string {
  const prompt = String(input.prompt || "").trim();
  const style = String(input.style || "").trim();
  const aspect = SIZE_TO_ASPECT[String(input.size || "1:1").toLowerCase()] || "1:1";
  const parts = [
    prompt,
    style ? `Uslub: ${style}.` : "",
    "Tezilgan surat, tabiiy yorug'lik, aniq detallar, professional foto-realizm.",
    "Rasm ichida matn, yozuv, logotip va watermark BO'LMASIN.",
    `Kadrlash: ${aspect} nisbat.`,
  ].filter(Boolean);
  return parts.join(" ");
}

export type GeneratedImage = {
  bytes: Buffer;
  mime: string;
  ext: "png" | "jpg" | "webp";
  model: string;
  revisedPrompt: string | null;
};

/** Fayzodiy belgilar bo'yicha rasm turini aniqlaydi (b64 ni ishonmaslik uchun). */
export function detectImageType(buf: Buffer): { mime: string; ext: "png" | "jpg" | "webp" } | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { mime: "image/png", ext: "png" };
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

/** `data:image/png;base64,...` yoki `https://...` → Buffer. */
async function toBytes(url: string, fetchImpl: typeof fetch): Promise<Buffer> {
  if (url.startsWith("data:")) {
    const comma = url.indexOf(",");
    const b64 = url.slice(comma + 1);
    return Buffer.from(b64, "base64");
  }
  // Model qaytaradigan URL foydalanuvchi nazoratida → SSRF tekshiruvi shart.
  // Test stub (`fetchImpl` almashtirilgan) xavfsizlik cheklovidan chetlab
  // o'tmaydi — lokal serverga ulanish sinovlar uchun kerak.
  if (fetchImpl === fetch) {
    const { safeFetchBytes } = await import("@/lib/security/net");
    const result = await safeFetchBytes(url, { timeoutMs: 20_000, maxBytes: 25 * 1024 * 1024 });
    if (!result.ok) throw new Error(`Rasmni yuklab olib bo'lmadi: ${result.error}`);
    return result.bytes;
  }
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Rasmni yuklab olib bo'lmadi: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export class ImageGenerationError extends Error {
  /** 402 — balans; 404 — model yo'q; 429 — limit; 400 — noto'g'ri so'rov */
  readonly providerStatus: number;
  readonly attempts: { model: string; error: string }[];

  constructor(message: string, providerStatus: number, attempts: { model: string; error: string }[]) {
    super(message);
    this.name = "ImageGenerationError";
    this.providerStatus = providerStatus;
    this.attempts = attempts;
  }
}

/** Provayder xatosini o'zbekcha, harakat ko'rsatadigan qilib tarjima qiladi. */
export function explainImageError(status: number, raw?: string): string {
  const detail = String(raw || "").slice(0, 220);
  if (status === 402) {
    return `OpenRouter balansida rasm generatsiyasi uchun mablag' yo'q (402). Matnli model ishlaydi, lekin rasm modeli narxi to'lanmaydi — hisobni to'ldiring yoki boshqa rasm API kaliti qo'shing (AI_IMAGE_BASE_URL).${detail ? ` [${
      /insufficient|no credits|balance/i.test(detail) ? "balans yetarli emas" : detail
    }]` : ""}`;
  }
  if (status === 404) return `Rasm modeli topilmadi (404). AI_IMAGE_MODELS ni tekshiring. ${detail}`;
  if (status === 429) return `Rasm modeli limitda (429). Biroz kutib, keyin qayta urinib ko'ring. ${detail}`;
  if (status === 400) return `Rasm so'rovi rad etildi (400): prompt yoki o'lchamni tekshiring. ${detail}`;
  if (status === 401 || status === 403) return `Provayder kaliti rad etildi (${status}). OPENROUTER_API_KEY ni tekshiring.`;
  return `Rasm yaratilmadi (${status}). ${detail}`;
}

export type GenerateOptions = {
  prompt: string;
  size?: string;
  style?: string;
  /** Test uchun: boshqa fetch (lokal stub) */
  fetchImpl?: typeof fetch;
  /** Test uchun: boshqa API bazasi */
  baseUrl?: string;
  /** Test uchun: boshqa kalit */
  apiKey?: string;
};

/**
 * Bitta rasm yaratadi: zanjir bo'ylab urinib, birinchisining natijasini qaytaradi.
 *
 * Xato bo'lsa `ImageGenerationError` — ichida barcha urinishlar ro'yxati
 * (shunda "qanday model urildi va nima bo'ldi" aniq ko'rinadi).
 */
export async function generateImage(options: GenerateOptions): Promise<GeneratedImage> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const key = options.apiKey ?? apiKey();
  const base = (options.baseUrl ?? baseUrl()).replace(/\/$/, "");
  const fullPrompt = buildImagePrompt(options);

  if (!key) {
    throw new ImageGenerationError(
      "Rasm uchun API kaliti yo'q: .env ga OPENROUTER_API_KEY (yoki AI_IMAGE_BASE_URL + AI_API_KEY) qo'shing.",
      401,
      [],
    );
  }

  const attempts: { model: string; error: string }[] = [];
  let lastStatus = 500;

  for (const model of IMAGE_MODEL_CHAIN) {
    const aspect = SIZE_TO_ASPECT[String(options.size || "1:1").toLowerCase()] || "1:1";
    try {
      const res = await fetchImpl(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://akela.uz",
          "X-Title": "Akela AI",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: fullPrompt }],
          modalities: ["image", "text"],
          image_config: { aspect_ratio: aspect },
          temperature: 0.7,
        }),
      });

      const raw = await res.text();
      if (!res.ok) {
        lastStatus = res.status;
        attempts.push({ model, error: `HTTP ${res.status}: ${raw.slice(0, 160)}` });
        continue;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        attempts.push({ model, error: "javob JSON emas" });
        continue;
      }

      const message = parsed?.choices?.[0]?.message ?? {};
      const images: any[] = Array.isArray(message.images) ? message.images : [];
      const url: string | undefined =
        images[0]?.image_url?.url ||
        images[0]?.url ||
        (typeof message.content === "string" && message.content.match(/https?:\/\/\S+\.(png|jpe?g|webp)/i)?.[0]);

      if (!url) {
        attempts.push({ model, error: "javobda rasm yo'q (images bo'sh)" });
        continue;
      }

      const bytes = await toBytes(url, fetchImpl);
      const type = detectImageType(bytes);
      if (!type) {
        attempts.push({ model, error: "qaytgan fayl rasm emas (belgilar mos kelmadi)" });
        continue;
      }

      return {
        bytes,
        mime: type.mime,
        ext: type.ext,
        model,
        revisedPrompt: typeof message.content === "string" && message.content.trim() ? message.content.trim() : null,
      };
    } catch (err: any) {
      lastStatus = lastStatus === 500 ? 502 : lastStatus;
      attempts.push({ model, error: err?.message || String(err) });
    }
  }

  const tried = attempts.map((a) => `${a.model}: ${a.error}`).join(" | ");
  throw new ImageGenerationError(
    `${explainImageError(lastStatus)}${tried ? ` — urinishlar: ${tried}` : ""}`,
    lastStatus,
    attempts,
  );
}

/** Rasmi saqlaydi va `AiFile` yozuvini yaratadi (imzolangan URL bilan). */
export async function storeGeneratedImage(input: {
  ownerId: string;
  conversationId?: string | null;
  image: GeneratedImage;
  prompt: string;
  title?: string;
}): Promise<{ id: string; fileName: string; url: string; size: number; storagePath: string }> {
  const { ensureFilesDir } = await import("./docgen");
  const { signFileUrl, FILE_URL_TTL_MS } = await import("./files");
  const { mkdir, writeFile } = await import("node:fs/promises");
  const nodePath = await import("node:path");

  await ensureFilesDir();
  const fileId = `f${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const storagePath = `upload/ai-files/${fileId}.${input.image.ext}`;
  const abs = nodePath.join(process.cwd(), storagePath);
  await mkdir(nodePath.dirname(abs), { recursive: true });
  await writeFile(abs, input.image.bytes);

  const base = String(input.title || input.prompt || "rasm")
    .replace(/[^\p{L}\p{N}\s._-]/gu, "")
    .trim()
    .slice(0, 60) || "rasm";

  const record = await db.aiFile.create({
    data: {
      ownerId: input.ownerId,
      kind: "image",
      fileName: `${base}.${input.image.ext}`,
      mimeType: input.image.mime,
      size: input.image.bytes.length,
      storagePath,
      title: base,
      specSummary: `prompt: ${input.prompt.slice(0, 200)}`,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    select: { id: true, fileName: true, storagePath: true },
  });

  return {
    id: record.id,
    fileName: record.fileName,
    storagePath: record.storagePath,
    size: input.image.bytes.length,
    url: signFileUrl(record.id, Date.now() + FILE_URL_TTL_MS),
  };
}

void createHmac;