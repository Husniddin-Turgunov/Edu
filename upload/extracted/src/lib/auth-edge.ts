/** Edge-safe session parsing for middleware (no Node.js crypto). */

export type UserRole = "admin" | "observer" | "manager" | "participant";

export type SessionUser = {
  userId: number;
  role: UserRole;
  participantKind: "employee" | "intern" | "candidate" | null;
  employeeId: number | null;
  candidateId: number | null;
  name: string;
};

export const SESSION_COOKIE = "akela_session";

function sessionSecret() {
  return (
    process.env.AKELA_SESSION_SECRET ||
    process.env.CANDIDATE_SESSION_SECRET ||
    process.env.CRON_SECRET ||
    "akela-dev-session-secret"
  );
}

function base64UrlDecode(str: string) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  return atob(base64 + pad);
}

async function signPayload(payload: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function parseSessionToken(
  raw: string | undefined,
): Promise<SessionUser | null> {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if ((await signPayload(payload)) !== sig) return null;

  try {
    const data = JSON.parse(base64UrlDecode(payload)) as SessionUser & {
      exp: number;
    };
    if (!data.exp || data.exp < Date.now()) return null;
    if (!data.userId || !data.role || !data.name) return null;
    return {
      userId: data.userId,
      role: data.role,
      participantKind: data.participantKind ?? null,
      employeeId: data.employeeId ?? null,
      candidateId: data.candidateId ?? null,
      name: data.name,
    };
  } catch {
    return null;
  }
}

export function homePathForRole(
  role: UserRole,
  participantKind?: "employee" | "intern" | "candidate" | null,
) {
  if (role === "admin") return "/";
  if (role === "observer" || role === "manager") return "/observer/home";
  if (participantKind === "candidate") return "/my/tests";
  return "/my";
}
