import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export type UserRole = "admin" | "observer" | "manager" | "participant";
export type ParticipantKind = "employee" | "intern" | "candidate";

export type SessionUser = {
  userId: number;
  role: UserRole;
  participantKind: ParticipantKind | null;
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

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const hash = scryptSync(password, salt, 64);
  const expected = Buffer.from(hashHex, "hex");
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}

function signPayload(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

export function parseSessionToken(raw: string | undefined): SessionUser | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (signPayload(payload) !== sig) return null;

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as SessionUser & { exp: number };
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

export function encodeSessionToken(user: SessionUser, sessionDays = 7) {
  const days = Math.max(1, Math.min(90, sessionDays || 7));
  const exp = Date.now() + days * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(
    JSON.stringify({ ...user, exp }),
    "utf8",
  ).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

export function homePathForRole(
  role: UserRole,
  participantKind?: ParticipantKind | null,
) {
  if (role === "admin") return "/";
  if (role === "observer" || role === "manager") return "/observer/home";
  if (participantKind === "candidate") return "/my/tests";
  return "/my";
}

export function suggestLogin(name: string, id: number) {
  const slug = name
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-я\s]/gi, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join("_")
    .slice(0, 24);
  return slug ? `${slug}_${id}` : `user_${id}`;
}

export function generatePassword(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function roleLabel(role: UserRole, kind: ParticipantKind | null) {
  if (role === "admin") return "admin";
  if (role === "observer") return "observer";
  if (role === "manager") return "manager";
  if (kind === "employee") return "employee";
  if (kind === "intern") return "intern";
  if (kind === "candidate") return "candidate";
  return "participant";
}

export function participantKindForRoleTitle(roleTitle: string): ParticipantKind {
  return /стаж|intern|стажер|стажёр/i.test(roleTitle) ? "intern" : "employee";
}

export type EmployeeAccountType = "intern" | "employee" | "manager";

export function employeeAccountTypeForRoleTitle(
  roleTitle: string,
): EmployeeAccountType {
  if (participantKindForRoleTitle(roleTitle) === "intern") return "intern";
  const title = roleTitle.toLowerCase().replace(/ё/g, "е");

  // Assistants / secretaries report to directors — they are not managers.
  if (/(помощник|ассистент|секретар)/.test(title)) {
    return "employee";
  }

  if (
    /(руководител|начальник|управляющ|заведующ)/.test(title) ||
    /(^|[^а-яa-z])(ceo|cfo|coo|chro|cmo|cmso)([^а-яa-z]|$)/i.test(title) ||
    /(коммерческий|финансовый|операционный|исполнительный|технический|управляющий|генеральный)\s+директор/.test(
      title,
    ) ||
    /^директор(\s|\(|$)/.test(title) ||
    /директор\s*\(/.test(title)
  ) {
    return "manager";
  }
  return "employee";
}
