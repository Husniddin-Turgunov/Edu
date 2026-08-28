/** Edge-safe terminal session cookie (no Node.js crypto). */

export const TERMINAL_COOKIE = "akela_terminal";
export const TERMINAL_DURATION_MS = 25 * 60 * 1000;
export const TERMINAL_WARN_MS = 20 * 60 * 1000;

export type TerminalSession = {
  slotNumber: number;
  queueItemId: number;
  assignmentId: number;
  candidateId: number;
};

function terminalSecret() {
  return (
    process.env.AKELA_TERMINAL_SECRET ||
    process.env.AKELA_SESSION_SECRET ||
    process.env.CRON_SECRET ||
    "akela-dev-terminal-secret"
  );
}

function base64UrlDecode(str: string) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  return atob(base64 + pad);
}

function base64UrlEncode(str: string) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signPayload(payload: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(terminalSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function encodeTerminalToken(session: TerminalSession) {
  const exp = Date.now() + TERMINAL_DURATION_MS + 60_000;
  const payload = base64UrlEncode(
    JSON.stringify({ ...session, exp }),
  );
  return `${payload}.${await signPayload(payload)}`;
}

export async function parseTerminalToken(
  raw: string | undefined,
): Promise<TerminalSession | null> {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if ((await signPayload(payload)) !== sig) return null;

  try {
    const data = JSON.parse(base64UrlDecode(payload)) as TerminalSession & {
      exp: number;
    };
    if (!data.exp || data.exp < Date.now()) return null;
    if (
      !data.slotNumber ||
      !data.queueItemId ||
      !data.assignmentId ||
      !data.candidateId
    ) {
      return null;
    }
    return {
      slotNumber: data.slotNumber,
      queueItemId: data.queueItemId,
      assignmentId: data.assignmentId,
      candidateId: data.candidateId,
    };
  } catch {
    return null;
  }
}

export function terminalWarnAt(startedAtIso: string) {
  return new Date(startedAtIso).getTime() + TERMINAL_WARN_MS;
}

export function terminalExpiresAt(startedAtIso: string) {
  return new Date(startedAtIso).getTime() + TERMINAL_DURATION_MS;
}
