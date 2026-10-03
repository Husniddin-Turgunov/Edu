import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { edgeActor } from "@/lib/security/edge-authz";
import { decideApi, checkOrigin } from "@/lib/security/api-policy";

/**
 * Server-side auth guard: client useEffect redirectlarga tayanmaymiz.
 *
 * IKKITA QATLAM bor:
 *
 *  1) BU QATLAM (edge, bazaga ulanmaydi) — token yo'q bo'lsa yoki token
 *     ichidagi `status` tasdiqlangan emas bo'lsa, darhol `/login` ga.
 *  2) `getSession()` (Node, Prisma) — har bir API so'rovida bazadagi JORIY
 *     status ni qayta tekshiradi. Bu asosiy qatlam: admin foydalanuvchini
 *     rad etsa yoki bot bloklasa, eski token ham o'tib ketmaydi.
 *
 * API QATLAMI (yangi): `/api/*` so'rovlari `api-policy` orqali o'tadi —
 * privilejli prefikslar (admin/ai/user/...) sessiya talab qiladi, har bir
 * o'zgaruvchi (POST/PUT/PATCH/DELETE) so'rov Origin bilan mos bo'lishi
 * shart (CSRF). Route ichidagi ro'l tekshiruvlari O'ZGARMAYDI.
 */
const GUARDED_PREFIXES = ["/admin", "/dashboard", "/courses", "/tests", "/my"];

// ——— Login brute-force himoyasi (edge, in-memory) ———
// 10 daqiqada 10 ta urinishdan keyin 429. Har bir izolyatsiyada alohida
// hisoblanadi (Next.js edge ishlatishga qarab qayta boshlanadi) — shu bilan
// ham oxirgi IP'larga qarshi sezilarli sekinlashuv beradi.
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map<string, { count: number; first: number }>();

function loginThrottled(ip: string): boolean {
  const now = Date.now();
  const row = loginAttempts.get(ip);
  if (!row || now - row.first > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, first: now });
    // Xotira o'sib ketmasligi uchun eski yozuvlarni tozalash
    if (loginAttempts.size > 10_000) {
      for (const [k, v] of loginAttempts) {
        if (now - v.first > LOGIN_WINDOW_MS) loginAttempts.delete(k);
      }
    }
    return false;
  }
  row.count += 1;
  return row.count > LOGIN_MAX_ATTEMPTS;
}

function clientIpOf(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ——— API so'rovlari ———
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    const method = req.method.toUpperCase();
    const isMutation = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";

    // Brute-force: login callback urinishlari cheklanadi
    if (pathname.startsWith("/api/auth/callback/")) {
      if (loginThrottled(clientIpOf(req))) {
        return NextResponse.json(
          { ok: false, error: "Juda ko'p urinish. 10 daqiqadan keyin qayta urinib ko'ring." },
          { status: 429 },
        );
      }
    }

    // CSRF: faqat o'zgaruvchi so'rovlar uchun Origin mosligi shart
    if (isMutation) {
      const originCheck = checkOrigin(req, req.headers.get("host") || "");
      if (originCheck.action === "deny") {
        return NextResponse.json({ ok: false, error: originCheck.message }, { status: originCheck.status });
      }
    }

    const actor = await edgeActor(req);
    const decision = decideApi(pathname, method, actor);
    if (decision.action === "deny") {
      return NextResponse.json({ ok: false, error: decision.message }, { status: decision.status });
    }
    return NextResponse.next();
  }

  // ——— Sahifalar ———
  const needsAuth = GUARDED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (!needsAuth) return NextResponse.next();

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Eski tokenlarda `status` yo'q bo'lishi mumkin — o'zlari uchun ular
  // tekshiruvsiz o'tmasin, faqat qayta kirishga majbur qilamiz.
  const status = (token as any).status;
  const isActive = (token as any).isActive;
  if (status !== "approved" || isActive === false) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?reason=not-approved";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/courses/:path*",
    "/tests/:path*",
    "/my/:path*",
    "/api/:path*",
  ],
};
