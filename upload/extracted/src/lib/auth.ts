import "server-only";
import { cookies } from "next/headers";
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
  let days = 7;
  try {
    const { getSettingsSection } = await import("@/db/system-settings");
    days = (await getSettingsSection("security")).sessionDays || 7;
  } catch {
    days = 7;
  }
  const token = encodeSessionToken(user, days);
  const jar = await cookies();
  // `next start` sets NODE_ENV=production even on localhost — don't mark
  // cookies Secure while developing against local SQLite / http://
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

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  return parseSessionToken(jar.get(SESSION_COOKIE)?.value);
}
