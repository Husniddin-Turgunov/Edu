import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  homePathForRole,
  parseSessionToken,
  SESSION_COOKIE,
} from "@/lib/auth-edge";

function isParticipantPath(path: string) {
  return path.startsWith("/my");
}

function isObserverPath(path: string) {
  return path.startsWith("/observer");
}

function isAdminPath(path: string) {
  if (path === "/login" || path.startsWith("/login/")) return false;
  if (isParticipantPath(path) || isObserverPath(path)) return false;
  if (path.startsWith("/portal")) return false;
  if (path.startsWith("/api")) return false;
  return true;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (path.startsWith("/portal")) {
    const url = req.nextUrl.clone();
    if (path.startsWith("/portal/login")) {
      url.pathname = "/login";
    } else if (path.startsWith("/portal/take/")) {
      url.pathname = path.replace("/portal/take/", "/my/take/");
    } else {
      url.pathname = "/my";
    }
    return NextResponse.redirect(url);
  }

  if (
    path.startsWith("/api") ||
    path.startsWith("/_next") ||
    path.startsWith("/terminal") ||
    path.includes(".")
  ) {
    return NextResponse.next();
  }

  const session = await parseSessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (path === "/login" || path.startsWith("/login/")) {
    if (session && path === "/login") {
      return NextResponse.redirect(
        new URL(
          homePathForRole(session.role, session.participantKind),
          req.url,
        ),
      );
    }
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (session.role === "participant") {
    if (isAdminPath(path) || isObserverPath(path)) {
      return NextResponse.redirect(new URL("/my", req.url));
    }
  }

  if (session.role === "observer" || session.role === "manager") {
    const allowedParticipantPath = path === "/my/onboarding";
    if (
      isAdminPath(path) ||
      (isParticipantPath(path) && !allowedParticipantPath)
    ) {
      return NextResponse.redirect(
        new URL(
          homePathForRole(session.role, session.participantKind),
          req.url,
        ),
      );
    }
  }

  if (session.role === "admin") {
    const allowedParticipantPath = path === "/my/onboarding";
    if (
      (!allowedParticipantPath && path === "/my") ||
      (!allowedParticipantPath && path.startsWith("/my/")) ||
      path.startsWith("/observer")
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
