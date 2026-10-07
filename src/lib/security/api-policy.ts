/**
 * lib/security/api-policy.ts — API RUXSAT SIYOSATI (edge-safe).
 *
 * QOIDA: foydalanuvchidan kelgan har bir so'rov avval shu siyosatdan
 * o'tadi:
 *   1) OMMAYXIN (public) yo'llar — autentifikatsiyasiz (login, webhook...).
 *   2) PRIVILEJLI prefikslar (admin, ai, user, progress...) — sessiya
 *      SHART; admin/ai prefikslari qo'shimcha ro'l talab qiladi.
 *   3) O'ZGARUVCHI (mutation: POST/PUT/PATCH/DELETE) — sessiya SHART,
 *      shu jumladan yuqorida kelmagan barcha yo'llar.
 *   4) CSRF — mutation so'rovda Origin/Host mos kelishi shart.
 *   5) QOLGAN GET (o'qish) — route ichidagi getSession() tekshiruvi
 *      (bu siyosat ularni o'chirmaydi, faqat qatlam qo'shadi).
 *
 * SINOV — test-start ruxsat tizimi buzilmasligi uchun: `/api/tests/*`,
 * `/api/lesson-access/*`, `/api/job-tests/*` yo'llari PRIVILEJLI ro'yxatiga
 * kirmaydi; ular route ichidagi o'z ruxsat mantiqini (TestAccessGate)
 * saqlaydi. Faqat MUTATIONlari sessiya talab qiladi (kirgan foydalanuvchi
 * allaqachon sessiyali bo'ladi).
 */

export type ApiDecision =
  | { action: "allow" }
  | { action: "deny"; status: 401 | 403; message: string };

/** Autentifikatsiyasiz ochiq yo'llar (prefix bo'yicha). */
const PUBLIC_PREFIXES = [
  "/api/auth/", // nextauth + forgot/reset-password (token bilan himoyalangan)
  "/api/auth",
  "/api/register",
  "/api/telegram", // webhook: ichida X-Telegram-Bot-Api-Secret-Token tekshiruvi
  "/api/telegram-bot", // polling: ichida maxsus token tekshiruvi
  "/api/mcp", // ichida MCP API kaliti tekshiruvi
  "/api/health",
  "/api/public",
  "/api/liquid-glass", // dizayn parametrlari (faqat o'qish)
  "/api/portal-settings", // login sahifasi sozlamalari (registrationOpen)
  "/api/security/report", // xavfsizlik xabar berish — ommaviy, ichida rate-limit
  "/api/courses", // ochiq katalog (sahifa darajasida ro'l tekshiruvi bor)
  "/api/jobs", // ochiq ish o'rinlari katalogi
  "/api/departments", // ochiq tuzilma
];

/** Faqat autentifikatsiya emas, admin/grader ro'li ham shart. */
const MANAGER_PREFIXES = ["/api/admin", "/api/ai"];

/** Sessiya shart (ro'l route ichida aniqlanadi). */
const AUTH_PREFIXES = [
  "/api/user",
  "/api/my-courses",
  "/api/my-stats",
  "/api/progress",
  "/api/course/lesson",
  "/api/akela-onboarding",
  "/api/onboarding",
  "/api/normatives",
  "/api/lesson-access",
  "/api/lesson-tests",
];

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function startsWithAny(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : p + "/") || (p.endsWith("/") && path.startsWith(p)));
}

export function isPublicApi(pathname: string): boolean {
  return startsWithAny(pathname, PUBLIC_PREFIXES);
}

/**
 * So'rov qarorini qaytaradi. `actor` null bo'lsa sessiya yo'q degani.
 */
export function decideApi(
  pathname: string,
  method: string,
  actor: { role: string; isAdmin: boolean } | null,
): ApiDecision {
  const upper = method.toUpperCase();
  const isMutation = MUTATING.has(upper);

  // 1) Ommaviy yo'llar
  if (isPublicApi(pathname)) {
    // Ommaviy yo'l, lekin mutation — Origin tekshiruvi middleware'da
    return { action: "allow" };
  }

  // 2) Privilejli prefikslar — sessiya shart
  const managerFirst = startsWithAny(pathname, MANAGER_PREFIXES);
  const authNeeded = managerFirst || startsWithAny(pathname, AUTH_PREFIXES) || isMutation;

  if (authNeeded && !actor) {
    return {
      action: "deny",
      status: 401,
      message: "Avtorizatsiya kerak",
    };
  }

  // 3) Admin/AI — qo'shimcha ro'l (defense-in-depth; route ichida yana tekshiriladi)
  if (managerFirst && actor && !(actor.role === "admin" || actor.role === "grader")) {
    return {
      action: "deny",
      status: 403,
      message: "Bu bo'lim faqat admin/grader uchun",
    };
  }

  return { action: "allow" };
}

/**
 * CSRF: mutation so'rovdagi Origin Host bilan mos bo'lishi shart.
 * Origin yuborilmagan (eski klientlar, curl) — ruxsat; `Sec-Fetch-Site:
 * cross-site` bo'lsa — rad (brauzer doim yuboradi).
 */
export function checkOrigin(req: { headers: { get(name: string): string | null } }, host: string): ApiDecision {
  const origin = req.headers.get("origin");
  const secSite = (req.headers.get("sec-fetch-site") || "").toLowerCase();

  if (secSite === "cross-site") {
    return { action: "deny", status: 403, message: "Cross-site so'rov rad etildi" };
  }
  if (origin) {
    try {
      const o = new URL(origin);
      const h = host.split(",")[0].trim();
      if (o.host !== h) {
        return { action: "deny", status: 403, message: "Origin Host bilan mos emas" };
      }
    } catch {
      return { action: "deny", status: 403, message: "Noto'g'ri Origin" };
    }
  }
  return { action: "allow" };
}
