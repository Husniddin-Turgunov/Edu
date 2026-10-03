import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Server-side auth guard: client useEffect redirectlarga tayanmaymiz.
 *
 * IKKITA QATLAM bor:
 *
 *  1) BU QATLAM (edge, bazaga ulanmaydi) — token yo'q bo'lsa yoki token ichidagi
 *     `status` tasdiqlangan emas bo'lsa, darhol `/login` ga.
 *  2) `getSession()` (Node, Prisma) — har bir API so'rovida bazadagi JORIY
 *     status ni qayta tekshiradi. Bu ashiy qatlam: admin foydalanuvchini
 *     rad etsa yoki bot bloklasa, eski token ham o'tib ketmaydi.
 */
const GUARDED_PREFIXES = ["/admin", "/dashboard", "/courses", "/tests", "/my"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
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
  matcher: ["/admin/:path*", "/dashboard/:path*", "/courses/:path*", "/tests/:path*", "/my/:path*"],
};
