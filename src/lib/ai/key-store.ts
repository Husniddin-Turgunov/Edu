/**
 * lib/ai/key-store.ts
 *
 * AI ruter kalitlarini boshqarish (baza → shifrlangan).
 *
 * Qoida: kalitlar bir nechta bo'lsa, **faqat belgilangan** (`isActive`)
 * ishlatiladi. Foydalanuvchi so'ragan: bir nechta kalit saqlansa,
 * qaysi biri ishlashi aniq bo'lishi kerak — "hammasi ketma-ket"
 * emas, bitta tanlangan.
 */

import { db } from "@/lib/db";
import { decryptKey, encryptKey, keyHint } from "./key-crypto";

export type KeyRow = {
  id: string;
  provider: string;
  label: string;
  baseUrl: string;
  model: string;
  keyHint: string;
  isActive: boolean;
  lastStatus: string;
  lastTestedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Ruterlar ro'yxati — nomi, standart modeli va bazasi. */
export const ROUTERS = [
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
    envKeys: ["OPENROUTER_API_KEY"],
    catalog: true,
    /** BEPUL modellar. Kunlik limit (50) tugaganda shu ro'yxat ishlaydi. */
    freeModels: [
      "nvidia/nemotron-3-super:free",
      "nvidia/nemotron-3-ultra:free",
      "nvidia/nemotron-3.5-lightning:free",
      "nvidia/nemotron-3-nano-omni:free",
      "nvidia/nemotron-3.5-content-safety:free",
      "google/gemma-4-26b-a4b:free",
      "google/gemma-4-31b:free",
      "qwen/qwen3.8-27b:free",
      "qwen/qwen-2.5-72b-instruct:free",
      "deepseek/deepseek-chat-v3-0324:free",
      "mistralai/mistral-small-3.1-24b-instruct:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemini-2.0-flash-exp:free",
    ],
    hint: "Bitta kalit bilan 300+ model. Bepul modellar `:free`. Bepul limit: kuniga 50 ta so'rov.",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.0-flash",
    envKeys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    catalog: false,
    /**
     * ENG KATTА bepul kvota. Google AI Studio: daqiqada 15, kunda 1500 ta
     * so'rov — OpenRouter bepul limitidan (kuniga 50) 30 BAROBAR ko'p.
     * Shu sabab OpenRouter tugasa shu kalitga o'tish kerak.
     */
    freeModels: ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash"],
    hint: "ENG KO'P bepul kvota: kuniga 1500 ta so'rov. OpenRouter limiti tugasa shu kalitni qo'ying.",
  },
  {
    id: "nemotron",
    name: "NVIDIA Nemotron",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    model: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    envKeys: ["NVIDIA_API_KEY", "NGC_API_KEY"],
    catalog: true,
    /**
     * NVIDIA NIM — bepul qatlam. Kalit build.nvidia.com dan olinadi.
     * Nemotron modellari o'zbek/rus matnida kuchli va arzon.
     */
    freeModels: [
      "nvidia/llama-3.3-nemotron-super-49b-v1.5",
      "nvidia/llama-3.1-nemotron-70b-instruct",
      "nvidia/nemotron-4-340b-instruct",
      "nvidia/nemotron-mini-4b-instruct",
      "meta/llama-3.3-70b-instruct",
    ],
    hint: "NVIDIA NIM bepul qatlami. Nemotron modellari — kuchli va arzon. build.nvidia.com dan kalit olinadi.",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-3-5-sonnet-latest",
    envKeys: ["ANTHROPIC_API_KEY"],
    catalog: false,
    hint: "Claude kaliti. Uzun hujjatlar va aniq tahlil uchun.",
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    envKeys: ["GROQ_API_KEY"],
    catalog: false,
    freeModels: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "qwen/qwen-2.5-32b"],
    hint: "Juda tez. Bepul kvota katta — so'rov/soniya juda yuqori.",
  },
  {
    id: "zai",
    name: "Z.AI (Zhipu)",
    baseUrl: "https://api.z.ai/api/paas/v4",
    model: "glm-4-flash",
    envKeys: ["ZAI_API_KEY", "ZHIPUAI_API_KEY"],
    catalog: false,
    hint: "GLM modellari, o'zbek/rus matni uchun yaxshi.",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    envKeys: ["DEEPSEEK_API_KEY"],
    catalog: false,
    hint: "Arzon, kod va mantiqiy vazifalar uchun.",
  },
  {
    id: "together",
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    model: "meta-llama/Llama-3-8b-chat-hf",
    envKeys: ["TOGETHER_API_KEY"],
    catalog: false,
    hint: "Ochiq modellarning yig'indisi.",
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    envKeys: ["OPENAI_API_KEY"],
    catalog: false,
    hint: "To'g'ridan-to'g'ri OpenAI kaliti.",
  },
] as const;

export type RouterId = (typeof ROUTERS)[number]["id"];

export function routerById(id: string) {
  return ROUTERS.find((r) => r.id === id) || null;
}

/** Barcha kalitlar — kalit OCHILMASDAN, faqat `keyHint`. */
export async function listKeys(): Promise<KeyRow[]> {
  const rows = await db.aiProviderKey.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] });
  return rows as unknown as KeyRow[];
}

/** Ochiq kalitni faqat `keyCipher` orqali qaytaradi (UI uchun emas!). */
export async function revealKey(id: string): Promise<string> {
  const row = await db.aiProviderKey.findUnique({ where: { id }, select: { keyCipher: true } });
  if (!row) throw new Error("Kalit topilmadi");
  return decryptKey(row.keyCipher);
}

/**
 * Yangi kalit qo'shadi yoki mavjudini yangilaydi.
 *
 * `isActive: true` bo'lsa — boshqa barcha kalitlar `isActive = false` ga
 * tushiriladi. Shu bilan "qaysi kalit ishlatiladi" aniq bo'ladi.
 */
export async function upsertKey(input: {
  id?: string | null;
  provider: string;
  label?: string;
  baseUrl?: string;
  model?: string;
  key?: string;
  isActive?: boolean;
}) {
  const router = routerById(input.provider);
  if (!router) throw new Error("Noma'lub ruter: " + input.provider);

  const plain = String(input.key || "").trim();
  const cipher = plain ? encryptKey(plain) : null;

  const saved = input.id
    ? await db.aiProviderKey.update({
        where: { id: input.id },
        data: {
          provider: router.id,
          label: String(input.label || "").slice(0, 120),
          baseUrl: String(input.baseUrl || router.baseUrl).slice(0, 255),
          model: String(input.model || router.model).slice(0, 160),
          ...(cipher ? { keyCipher: cipher, keyHint: keyHint(plain) } : {}),
        },
      })
    : await db.aiProviderKey.create({
        data: {
          provider: router.id,
          label: String(input.label || "").slice(0, 120),
          baseUrl: String(input.baseUrl || router.baseUrl).slice(0, 255),
          model: String(input.model || router.model).slice(0, 160),
          keyCipher: cipher || encryptKey("placeholder"),
          keyHint: cipher ? keyHint(plain) : "",
          isActive: false,
        },
      });

  // `isActive: true` bo'lsa — boshqa barcha kalitlar o'chiriladi va shu
  // kalit faol qilinadi. MUHIM: `setActive()` dan keyin qayta o'qiymiz —
  // aks holda javobda eski `isActive: false` qaytardi va UI "belgilanmagan"
  // ko'rsatardi, holbuki DB da haqiqatan faol bo'lgan.
  if (input.isActive) {
    await setActive(saved.id);
    return db.aiProviderKey.findUnique({ where: { id: saved.id } });
  }
  return saved;
}

/** Faqat shu kalit ishlatiladigan qiladi (boshqalari o'chiriladi). */
export async function setActive(id: string) {
  await db.aiProviderKey.updateMany({ data: { isActive: false } });
  const row = await db.aiProviderKey.update({ where: { id }, data: { isActive: true } });
  return row;
}

export async function deleteKey(id: string) {
  return db.aiProviderKey.delete({ where: { id } });
}

/** Tanlangan kalitni OCHIQ holda qaytaradi — runtime uchun. */
export async function getActiveKey() {
  const row = await db.aiProviderKey.findFirst({ where: { isActive: true } });
  if (!row) return null;
  const router = routerById(row.provider);
  let plain = "";
  try {
    plain = decryptKey(row.keyCipher);
  } catch {
    return null; // noto'g'ri/buzilgan shifr — uni ishlatmaymiz
  }
  if (!plain || plain === "placeholder") return null;
  return {
    id: row.id,
    provider: row.provider,
    name: row.label || router?.name || row.provider,
    baseUrl: row.baseUrl || router?.baseUrl || "",
    model: row.model || router?.model || "",
    apiKey: plain,
  };
}

export async function markTested(id: string, ok: boolean, note = "") {
  return db.aiProviderKey.update({
    where: { id },
    data: { lastStatus: (ok ? "OK: " : "XATO: ") + String(note).slice(0, 300), lastTestedAt: new Date() },
  });
}