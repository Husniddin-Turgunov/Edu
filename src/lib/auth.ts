import "server-only";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import {
  encodeSessionToken,
  parseSessionToken,
  SESSION_COOKIE,
  type SessionUser,
} from "./auth-core";

export type {
  ParticipantKind,
  SessionUser,
  UserRole,
} from "./auth-core";

export {
  generatePassword,
  hashPassword,
  homePathForRole,
  roleLabel,
  SESSION_COOKIE,
  suggestLogin,
  verifyPassword,
} from "./auth-core";

export async function setSession(user: SessionUser) {
  const days = 7;
  const token = encodeSessionToken(user, days);
  const jar = await cookies();
  const secure =
    process.env.NODE_ENV === "production" &&
    process.env.AKELA_USE_LOCAL_DB !== "1" &&
    process.env.AKELA_COOKIE_INSECURE !== "1";
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: days * 24 * 60 * 60,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

// Universal session resolver: NextAuth + custom akela_session
// Returns object with both userId (string) and original fields
export async function getSession(): Promise<(Omit<SessionUser, "userId"> & { userId: string; isAdmin: boolean }) | null> {
  const jar = await cookies();

  // 1) Avval custom akela_session cookie'ni tekshiramiz
  const custom = parseSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (custom) {
    return {
      ...custom,
      userId: String(custom.userId),
      isAdmin: custom.role === "admin",
    };
  }

  // 2) NextAuth session
  try {
    const { authOptions } = await import("@/app/api/auth/[...nextauth]/route");
    const session: any = await getServerSession(authOptions as any);
    if (session?.user) {
      const u = session.user as any;
      return {
        userId: String(u.id || u.email || "0"),
        role: (u.role === "admin" ? "admin" : u.role) || "participant",
        participantKind: null,
        employeeId: null,
        candidateId: null,
        name: u.name || u.email || "User",
        isAdmin: u.role === "admin",
      };
    }
  } catch (e) {
    // ignore
  }

  // 3) ESLATMA: bu yerga hech qachon imzosiz JWT fallback qo'shmang.
  // Oldin imzosiz cookie payload'ini o'qib isAdmin:true beruvchi kod bor edi —
  // u o'chirilgan, chunki brauzer cookie'ni o'zi yasab admin bo'lishi mumkin edi.
  // Faqat: (1) imzolangan akela_session, (2) NextAuth sessiyasi (authOptions bilan).

  return null;
}
