import "server-only";
import { cookies } from "next/headers";
import {
  TERMINAL_COOKIE,
  encodeTerminalToken,
  parseTerminalToken,
  type TerminalSession,
} from "./terminal-auth";

export {
  TERMINAL_COOKIE,
  TERMINAL_DURATION_MS,
  TERMINAL_WARN_MS,
  terminalExpiresAt,
  terminalWarnAt,
} from "./terminal-auth";
export type { TerminalSession } from "./terminal-auth";

export async function setTerminalSession(session: TerminalSession) {
  const token = await encodeTerminalToken(session);
  const jar = await cookies();
  jar.set(TERMINAL_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 31 * 60,
  });
}

export async function clearTerminalSession() {
  const jar = await cookies();
  jar.delete(TERMINAL_COOKIE);
}

export async function getTerminalSession(): Promise<TerminalSession | null> {
  const jar = await cookies();
  return parseTerminalToken(jar.get(TERMINAL_COOKIE)?.value);
}
