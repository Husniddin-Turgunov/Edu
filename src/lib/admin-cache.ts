// Admin bo'limlari orasidagi ma'lumot keshi.
//
// MUAMMO: har bir admin sahifasi mount bo'lganda `fetch(url, { cache: "no-store" })`
// qilardi. Shuning uchun bo'limdan bo'limga o'tganda har safar serverga so'rov
// ketar va ekranda alohida "yuklanmoqda" holati ko'rinardi.
//
// YECHIM: modul darajasidagi Map kesh. SPA sessiyasi davomida (bo'limlar orasida
// o'tganda) saqlanadi — qayta o'tganda ma'lumot darhol beriladi, serverga so'rov
// ketmaydi. O'zgartirish qilinganda (POST/PATCH/PUT/DELETE) kesh avtomatik
// tozalanadi, shuning uchun eskirgan ma'lumot ko'rsatilmaydi.

type Entry = { at: number; data: unknown };

const CACHE = new Map<string, Entry>();
const DEFAULT_TTL = 20_000;

export function invalidateAdminCache(): void {
  CACHE.clear();
}

/** Modul darajasida keshni o'chirish/patch qilish — faqat bir marta o'rnatiladi. */
export function installAdminCacheInvalidation(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __akelaAdminCachePatched?: boolean };
  if (w.__akelaAdminCachePatched) return;
  w.__akelaAdminCachePatched = true;

  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (
      init?.method ||
      (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      // har qanday o'zgartirish boshqa bo'limdagi keshni ham xarob qiladi
      invalidateAdminCache();
    }
    return original(input as RequestInfo, init);
  };
}

/**
 * `fetch` o'rnini bosadi, lekin shakli o'zgarmaydi: `{ ok, status, json() }`
 * shuning uchun mavjud `if (!res.ok) ...` / `await res.json()` kodlari
 * o'zgartirilmasdan ishlaydi.
 */
export async function cachedFetch(
  url: string,
  init: RequestInit = {},
  ttl: number = DEFAULT_TTL
): Promise<Response> {
  const method = (init.method || "GET").toUpperCase();
  // HIMOYA: faqat GET keshlanadi. Mutation so'rovlari (body farq qilishi mumkin)
  // hech qachon keshlanmasligi kerak — aks holda "barchasi muvaffaqiyatli"
  // ko'rinib, ammo ma'lumot saqlanmay qoladi.
  if (method !== "GET" && method !== "HEAD") {
    return fetch(url, init);
  }
  const key = `GET ${url}`;
  const now = Date.now();
  const hit = CACHE.get(key);
  if (hit && now - hit.at < ttl) {
    return makeResponse(hit.data);
  }
  const res = await fetch(url, init);
  if (!res.ok) return res;

  // MUHIM: faqat JSON javoblar keshlanadi. PDF/CSV/binary javoblarda
  // `res.json()` chaqirilsa, joriy tanani buziladi (body "used already") va
  // keyingi `res.blob()` BO'SH fayl qaytaradi — ya'ni yuklab olingan PDF 0
  // bayt bo'lardi. Shuning uchun content-type tekshiriladi va JSON `clone()`
  // orqali o'qiladi (asl Response butunlay qoladi).
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("json")) return res;

  try {
    const data = await res.clone().json();
    CACHE.set(key, { at: now, data });
    return makeResponse(data);
  } catch {
    return res;
  }
}

function makeResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  } as unknown as Response;
}
