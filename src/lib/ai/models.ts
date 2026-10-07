/**
 * lib/ai/models.ts
 *
 * Model ro'yxati: OpenRouter katalogi (jonli) + zaxira ro'yxat.
 *
 * Foydalanuvchi so'ragan: modellar **bepul va to'lovli alohida**
 * ko'rsatilsin va nomi bo'yicha qidirilsin.
 *
 * Bepul belgisi: OpenRouter'da bepul modellar id oxirida `:free` bilan
 * keladi va `pricing.prompt === "0"` bo'ladi. Ikkalasini ham tekshiramiz —
 * `:free` yo'q, lekin narx 0 bo'lgan model ham bepul hisoblanadi.
 */

export type ModelItem = {
  id: string;
  name: string;
  /** Bepul model (`:free` yoki narx 0). */
  free: boolean;
  /** 1K token narxi, USD. Bepul bo'lsa 0. */
  inPrice: number;
  outPrice: number;
  context: number;
  provider: string;
};

type RawModel = {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
};

/** OpenRouter katalogini oladi. Kalit yo'q yoki xato bo'lsa — `null`. */
export async function fetchOpenRouterModels(apiKey: string): Promise<ModelItem[] | null> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}`, "HTTP-Referer": "https://edu.akelagroup.uz" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const raw: RawModel[] = Array.isArray(data?.data) ? data.data : [];
    if (!raw.length) return null;

    return raw
      .map((m): ModelItem => {
        const inPrice = Number(m.pricing?.prompt || 0);
        const outPrice = Number(m.pricing?.completion || 0);
        const id = String(m.id || "");
        return {
          id,
          name: String(m.name || id),
          free: id.endsWith(":free") || (inPrice === 0 && outPrice === 0),
          inPrice,
          outPrice,
          context: Number(m.context_length || 0),
          provider: id.includes("/") ? id.split("/")[0] : "",
        };
      })
      .filter((m) => m.id)
      .sort((a, b) => {
        // Avval bepul modellar, keyin narx bo'yicha.
        if (a.free !== b.free) return a.free ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  } catch {
    return null;
  }
}

/**
 * Kalit yo'q holat uchun zaxira ro'yxat.
 *
 * Bu FAQAT ko'rsatish uchun — ulanish uchun kalit kerak. Lekin ro'yxat
 * KENG bo'lishi kerak: avval faqat 7 ta edi va "bepul modellar to'liq
 * chiqmayapti" degan xato chiqardi. Endi barcha bepul oilalar kiritilgan.
 */
export const FALLBACK_MODELS: ModelItem[] = [
  // ——— OPENROUTER: NEMOTRON 3 ———
  { id: "nvidia/nemotron-3-super:free", name: "Nemotron 3 Super", free: true, inPrice: 0, outPrice: 0, context: 131072, provider: "nvidia" },
  { id: "nvidia/nemotron-3-ultra:free", name: "Nemotron 3 Ultra", free: true, inPrice: 0, outPrice: 0, context: 131072, provider: "nvidia" },
  { id: "nvidia/nemotron-3.5-lightning:free", name: "Nemotron 3.5 Lightning", free: true, inPrice: 0, outPrice: 0, context: 131072, provider: "nvidia" },
  { id: "nvidia/nemotron-3-nano-omni:free", name: "Nemotron 3 Nano Omni", free: true, inPrice: 0, outPrice: 0, context: 32768, provider: "nvidia" },
  { id: "nvidia/nemotron-3.5-content-safety:free", name: "Nemotron 3.5 Content Safety", free: true, inPrice: 0, outPrice: 0, context: 8192, provider: "nvidia" },
  { id: "nvidia/llama-3.3-nemotron-super-49b-v1.5", name: "Nemotron Super 49B", free: true, inPrice: 0, outPrice: 0, context: 131072, provider: "nvidia" },
  { id: "nvidia/nemotron-ultra-253b-v1", name: "Nemotron Ultra 253B", free: true, inPrice: 0, outPrice: 0, context: 131072, provider: "nvidia" },
  { id: "nvidia/llama-3.1-nemotron-70b-instruct", name: "Nemotron 70B Instruct", free: true, inPrice: 0, outPrice: 0, context: 131072, provider: "nvidia" },
  { id: "nvidia/nemotron-mini-4b-instruct", name: "Nemotron Mini 4B", free: true, inPrice: 0, outPrice: 0, context: 8192, provider: "nvidia" },

  // ——— INKLING (barchasi bepul) ———
  { id: "inkling/inkling:free", name: "Inkling", free: true, inPrice: 0, outPrice: 0, context: 131072, provider: "inkling" },
  { id: "inkling/inkling-small:free", name: "Inkling Small", free: true, inPrice: 0, outPrice: 0, context: 65536, provider: "inkling" },

  // ——— GEMMA 4 ———
  { id: "google/gemma-4-26b-a4b:free", name: "Gemma 4 26B A4B", free: true, inPrice: 0, outPrice: 0, context: 131072, provider: "google" },
  { id: "google/gemma-4-31b:free", name: "Gemma 4 31B", free: true, inPrice: 0, outPrice: 0, context: 131072, provider: "google" },

  // ——— QWEN 3 ———
  { id: "qwen/qwen3.8-27b:free", name: "Qwen 3.8 27B", free: true, inPrice: 0, outPrice: 0, context: 65536, provider: "qwen" },
  { id: "qwen/qwen-2.5-72b-instruct:free", name: "Qwen 2.5 72B Instruct", free: true, inPrice: 0, outPrice: 0, context: 32768, provider: "qwen" },

  // ——— LAGUNA / LING / QOLGANLAR ———
  { id: "laguna/laguna-x5-2.1:free", name: "Laguna X5 2.1", free: true, inPrice: 0, outPrice: 0, context: 131072, provider: "laguna" },
  { id: "laguna/laguna-s-2.1:free", name: "Laguna S 2.1", free: true, inPrice: 0, outPrice: 0, context: 131072, provider: "laguna" },
  { id: "ling/ling-3.0-flash-sante:free", name: "Ling 3.0 Flash Sante", free: true, inPrice: 0, outPrice: 0, context: 131072, provider: "ling" },
  { id: "liquidai/lfm2.5-2.6b:free", name: "LFM2.5 2.6B", free: true, inPrice: 0, outPrice: 0, context: 32768, provider: "liquidai" },
  { id: "north/north-mini-code:free", name: "North Mini Code", free: true, inPrice: 0, outPrice: 0, context: 131072, provider: "north" },
  { id: "apexex/apexex-1.1-mini:free", name: "Apexex 1.1 Mini", free: true, inPrice: 0, outPrice: 0, context: 65536, provider: "apexex" },
  { id: "dot3/dot3-note-preview:free", name: "Dot3-Note Preview", free: true, inPrice: 0, outPrice: 0, context: 65536, provider: "dot3" },

  // ——— GEMINI (Google AI Studio) ———
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", free: true, inPrice: 0, outPrice: 0, context: 1048576, provider: "google" },
  { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", free: true, inPrice: 0, outPrice: 0, context: 1048576, provider: "google" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", free: true, inPrice: 0, outPrice: 0, context: 1048576, provider: "google" },

  // ——— GROQ ———
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Groq)", free: true, inPrice: 0, outPrice: 0, context: 131072, provider: "groq" },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B (Groq)", free: true, inPrice: 0, outPrice: 0, context: 131072, provider: "groq" },

  // ——— OPENROUTER BEPUL ———
  { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash (OR)", free: true, inPrice: 0, outPrice: 0, context: 1000000, provider: "google" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B Instruct", free: true, inPrice: 0, outPrice: 0, context: 131072, provider: "meta-llama" },
  { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek V3 (bepul)", free: true, inPrice: 0, outPrice: 0, context: 163840, provider: "deepseek" },
  { id: "mistralai/mistral-small-3.1-24b-instruct:free", name: "Mistral Small 3.1 24B", free: true, inPrice: 0, outPrice: 0, context: 32768, provider: "mistralai" },

  // ——— TO'LOVLI ———
  { id: "nvidia/nemotron-4-340b-instruct", name: "Nemotron 4 340B", free: false, inPrice: 0.0000002, outPrice: 0.0000006, context: 4096, provider: "nvidia" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o mini (OpenAI)", free: false, inPrice: 0.00000015, outPrice: 0.0000006, context: 128000, provider: "openai" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", free: false, inPrice: 0.000003, outPrice: 0.000015, context: 200000, provider: "anthropic" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek Chat", free: false, inPrice: 0.00000027, outPrice: 0.0000011, context: 64000, provider: "deepseek" },
];

/**
 * RUTER BO'YICHA modellarni oladi.
 *
 * Sabab: avval faqat `openrouter` uchun ishlardi — boshqa ruterda
 * "modellar chiqmayapti" bo'lardi. Endi OpenAI-ga mos ruterlar ham
 * qo'llab-quvvatlanadi; qo'llab-quvvatlanmasa — zaxira ro'yxat.
 */
export async function fetchModelsFrom(provider: string, apiKey: string): Promise<ModelItem[] | null> {
  if (provider === "openrouter") return fetchOpenRouterModels(apiKey);
  if (provider === "openai") {
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) return null;
      const data: any = await res.json();
      const list: any[] = Array.isArray(data?.data) ? data.data : [];
      if (!list.length) return null;
      return list.map((m) => ({
        id: String(m.id || ""),
        name: String(m.id || ""),
        free: false,
        inPrice: 0,
        outPrice: 0,
        context: 0,
        provider: "openai",
      }));
    } catch {
      return null;
    }
  }
  return null;
}

/** Narxni inson o'qiydigan formatda. */
export function priceLabel(m: ModelItem): string {
  if (m.free) return "Bepul";
  const inPer1M = m.inPrice * 1_000_000;
  const outPer1M = m.outPrice * 1_000_000;
  const f = (n: number) => (n >= 1 ? n.toFixed(2) : n.toFixed(4));
  return `$${f(inPer1M)} / $${f(outPer1M)}`;
}

/** Kontekst uzunligini ixchamlashtiradi: 128000 → "128K". */
export function contextLabel(n: number): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}