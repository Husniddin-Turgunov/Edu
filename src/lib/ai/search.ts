/**
 * lib/ai/search.ts
 *
 * Internetdan qidiruv — faqat "web-rejim"da ishlatiladi. Mavzu bo'yicha
 * ochiq manbalarni oladi va test generatsiyasiga matn sifatida beradi.
 *
 * Zanjir: Brave -> Tavily -> Serper -> ochiq qidiruv (DuckDuckGo lite).
 * Hech qanday kalit bo'lmasa ham tizim ishlaydi.
 *
 * Xavfsizlik: barcha so'rovlar SSRF tekshiruvidan o'tadi (faqat ochiq
 * http(s), lokal va ichki manzillar bloklangan, javob hajmi cheklangan).
 */

import dns from "dns/promises";
import net from "net";

export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
};

export type SearchOutcome = {
  engine: string;
  hits: SearchHit[];
  error?: string;
};

const MAX_SNIPPET = 400;
const MAX_PAGE_BYTES = 400_000;
const DEFAULT_TIMEOUT = 12_000;

/** Kalitlardan qaysi biri bor — UI shuni ko'rsatadi. */
export function searchEngineInfo() {
  if (process.env.BRAVE_API_KEY) return "Brave Search";
  if (process.env.TAVILY_API_KEY) return "Tavily";
  if (process.env.SERPER_API_KEY) return "Serper";
  return "DuckDuckGo (ochiq)";
}

// ============================================================================
//  SSRF himoyasi
// ============================================================================

function isPrivateIp(ip: string) {
  const type = net.isIP(ip);
  if (type === 4) {
    const parts = ip.split(".").map(Number);
    if (parts.some((p) => Number.isNaN(p))) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (type === 6) {
    const low = ip.toLowerCase();
    if (low === "::1" || low === "::") return true;
    if (low.startsWith("fc") || low.startsWith("fd")) return true;
    if (low.startsWith("fe80")) return true;
    if (low.startsWith("::ffff:")) return isPrivateIp(low.slice(7));
    return false;
  }
  return true;
}

/** Faqat ochiq internetdagi http(s) manzillarni o'tkazadi. */
export async function assertPublicUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Manzil noto'g'ri");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Faqat http/https qo'llab-quvvatlanadi: ${url.protocol}`);
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "metadata.google.internal") {
    throw new Error("Lokal manzillarga ruxsat berilmaydi");
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Ichki tarmoqqa ruxsat berilmaydi");
    return url;
  }
  let records: { address: string }[];
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw new Error(` Domenni aniqlab bo'lmadi: ${host}`);
  }
  for (const record of records) {
    if (isPrivateIp(record.address)) throw new Error("Ichki tarmoqqa ruxsat berilmaydi");
  }
  return url;
}

async function safeFetch(raw: string, timeoutMs = DEFAULT_TIMEOUT): Promise<string> {
  // 1) Tez tekshiruv (xato xabarlari uchun)
  const url = await assertPublicUrl(raw);
  // 2) Asosiy himoya: redirect har bosqichida qayta tekshiriladi, port
  //    chegarasi, metadata-IP (169.254.169.254), hajm limiti — net.ts orqali
  const { safeFetchBytes } = await import("@/lib/security/net");
  const result = await safeFetchBytes(String(url), {
    timeoutMs,
    maxBytes: MAX_PAGE_BYTES,
    maxRedirects: 3,
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; AkelaAI/1.0; +https://akela.uz)",
      accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "accept-language": "uz,ru,en;q=0.8",
    },
  });
  if (!result.ok) throw new Error(result.error);
  return decodeBody(result.bytes, result.contentType);
}

function decodeBody(buffer: Buffer, contentType: string) {
  const head = buffer.subarray(0, 1024).toString("latin1").toLowerCase();
  if (contentType.includes("charset=windows-1251") || /charset=["']?windows-1251/.test(head)) {
    return decodeCp1251(buffer);
  }
  return buffer.toString("utf8");
}

function decodeCp1251(buffer: Buffer) {
  let out = "";
  for (const byte of buffer) {
    out += byte >= 0xc0 && byte <= 0xff
      ? String.fromCharCode(byte - 0xc0 + 0x0410)
      : String.fromCharCode(byte);
  }
  return out;
}

// ============================================================================
//  Qidiruv
// ============================================================================

export async function webSearch(query: string, limit = 6, lang = "uz"): Promise<SearchOutcome> {
  const q = query.trim();
  if (!q) return { engine: searchEngineInfo(), hits: [], error: "Bo'sh qidiruv so'rovi" };

  if (process.env.BRAVE_API_KEY) {
    try {
      return await searchBrave(q, limit, lang);
    } catch (err: any) {
      const fallback = await searchOpen(q, limit, lang);
      return { ...fallback, error: `Brave: ${err?.message || "xato"}` };
    }
  }
  if (process.env.TAVILY_API_KEY) {
    try {
      return await searchTavily(q, limit, lang);
    } catch (err: any) {
      const fallback = await searchOpen(q, limit, lang);
      return { ...fallback, error: `Tavily: ${err?.message || "xato"}` };
    }
  }
  if (process.env.SERPER_API_KEY) {
    try {
      return await searchSerper(q, limit);
    } catch (err: any) {
      const fallback = await searchOpen(q, limit, lang);
      return { ...fallback, error: `Serper: ${err?.message || "xato"}` };
    }
  }

  return searchOpen(q, limit, lang);
}

async function searchBrave(query: string, limit: number, lang: string): Promise<SearchOutcome> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(Math.min(20, limit)));
  const response = await fetch(url, {
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    headers: {
      "accept": "application/json",
      "x-subscription-token": process.env.BRAVE_API_KEY!,
      "accept-language": lang === "uz" ? "uz,ru,en" : lang,
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data: any = await response.json();
  const hits: SearchHit[] = (data?.web?.results || [])
    .slice(0, limit)
    .map((r: any) => ({
      title: cleanHtml(String(r.title || "")),
      url: String(r.url || ""),
      snippet: cleanHtml(String(r.description || "")).slice(0, MAX_SNIPPET),
    }))
    .filter((h: SearchHit) => h.url.startsWith("http"));
  return { engine: "Brave Search", hits };
}

async function searchTavily(query: string, limit: number, lang: string): Promise<SearchOutcome> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: Math.min(20, limit),
      include_answer: false,
      include_raw_content: false,
      search_depth: "basic",
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data: any = await response.json();
  const hits: SearchHit[] = (data?.results || [])
    .slice(0, limit)
    .map((r: any) => ({
      title: cleanHtml(String(r.title || "")),
      url: String(r.url || ""),
      snippet: cleanHtml(String(r.content || "")).slice(0, MAX_SNIPPET),
    }))
    .filter((h: SearchHit) => h.url.startsWith("http"));
  void lang;
  return { engine: "Tavily", hits };
}

async function searchSerper(query: string, limit: number): Promise<SearchOutcome> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    headers: { "content-type": "application/json", "X-API-KEY": process.env.SERPER_API_KEY! },
    body: JSON.stringify({ q: query, num: Math.min(20, limit) }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data: any = await response.json();
  const hits: SearchHit[] = (data?.organic || [])
    .slice(0, limit)
    .map((r: any) => ({
      title: cleanHtml(String(r.title || "")),
      url: String(r.link || ""),
      snippet: cleanHtml(String(r.snippet || "")).slice(0, MAX_SNIPPET),
    }))
    .filter((h: SearchHit) => h.url.startsWith("http"));
  return { engine: "Serper", hits };
}

/** Kalitsiz ochiq qidiruv: DuckDuckGo lite + sahifa matnini o'qish. */
async function searchOpen(query: string, limit: number, lang: string): Promise<SearchOutcome> {
  const url = new URL("https://html.duckduckgo.com/html/");
  url.searchParams.set("q", query);
  if (lang === "uz") url.searchParams.set("kl", "uz-uz");
  if (lang === "ru") url.searchParams.set("kl", "ru-ru");

  const html = await safeFetch(url.toString(), 15_000);
  const hits = parseDuckResults(html, limit);

  if (hits.length === 0) {
    return { engine: searchEngineInfo(), hits: [], error: "Ochiq qidiruvda natija topilmadi" };
  }

  // Birinchi 2 ta sahifa matnini o'qib, snippetni boyitiamiz
  const enriched = await Promise.all(
    hits.slice(0, Math.min(2, hits.length)).map(async (hit) => {
      if (hit.snippet.length > 120) return hit;
      try {
        const page = await fetchPageText(hit.url);
        if (page.text.length > 200) {
          return { ...hit, snippet: page.text.slice(0, MAX_SNIPPET) };
        }
      } catch {
        /* sahifa o'qilmadi — snippet yetarli */
      }
      return hit;
    }),
  );

  return { engine: searchEngineInfo(), hits: [...enriched, ...hits.slice(2)] };
}

function parseDuckResults(html: string, limit: number): SearchHit[] {
  const hits: SearchHit[] = [];
  const blockRe = /<div class="result[^"]*"[\s\S]*?<\/div>\s*<\/div>/g;
  const blocks = html.match(blockRe) || [];

  const linkRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;
  const snippetRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>|class="result__snippet"[^>]*>([\s\S]*?)<\/a>/;

  for (const block of blocks) {
    if (hits.length >= limit) break;
    const linkMatch = block.match(linkRe);
    if (!linkMatch) continue;
    let href = decodeHtml(linkMatch[1]);
    // DDG redirect: //duckduckgo.com/l/?uddg=<encoded>
    const uddg = href.match(/[?&]uddg=([^&]+)/);
    if (uddg) href = decodeURIComponent(uddg[1]);
    if (!/^https?:\/\//.test(href)) continue;

    const snippetMatch = block.match(snippetRe);
    const snippet = cleanHtml(snippetMatch ? snippetMatch[1] || snippetMatch[2] || "" : "").slice(0, MAX_SNIPPET);

    hits.push({ title: cleanHtml(linkMatch[2]), url: href, snippet });
  }

  if (hits.length === 0) {
    // Zaxira: to'g'ridan-to'g'ri havolalarni yig'ish
    const hrefRe = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = hrefRe.exec(html)) !== null && hits.length < limit) {
      if (/duckduckgo\.com/.test(m[1])) continue;
      const title = cleanHtml(m[2]);
      if (title.length < 8) continue;
      hits.push({ title, url: m[1], snippet: "" });
    }
  }

  return hits;
}

/** Sahifa matnini oladi (faqat ochiq internet). */
export async function fetchPageText(rawUrl: string) {
  const html = await safeFetch(rawUrl);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const text = cleanHtml(withoutScripts).replace(/\n{3,}/g, "\n\n").trim();
  return {
    title: cleanHtml(titleMatch ? titleMatch[1] : rawUrl),
    url: rawUrl,
    text: text.slice(0, 6000),
    charCount: text.length,
  };
}

function cleanHtml(input: string) {
  return String(input || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(input: string) {
  return String(input || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}