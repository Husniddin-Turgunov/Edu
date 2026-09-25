import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Server-side auth guard: client useEffect redirectlarga tayanmaymiz.
// Sessiya cookie'siz /admin, /dashboard, /courses ga kirish mumkin emas.
const GUARDED_PREFIXES = ["/admin", "/dashboard", "/courses"];

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
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/courses/:path*"],
};
