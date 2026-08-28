import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const CANDIDATE_SESSION_COOKIE = "akela_candidate_session";

function sessionSecret() {
  return (
    process.env.CANDIDATE_SESSION_SECRET ||
    process.env.CRON_SECRET ||
    "akela-candidate-dev-secret"
  );
}

export function hashPortalPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPortalPassword(password: string, stored: string) {
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

export async function setCandidateSession(candidateId: number) {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = `${candidateId}.${exp}`;
  const token = `${payload}.${signPayload(payload)}`;
  const jar = await cookies();
  jar.set(CANDIDATE_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearCandidateSession() {
  const jar = await cookies();
  jar.delete(CANDIDATE_SESSION_COOKIE);
}

export async function getCandidateSessionId(): Promise<number | null> {
  const jar = await cookies();
  const raw = jar.get(CANDIDATE_SESSION_COOKIE)?.value;
  if (!raw) return null;

  const [candidateIdRaw, expRaw, sig] = raw.split(".");
  if (!candidateIdRaw || !expRaw || !sig) return null;

  const payload = `${candidateIdRaw}.${expRaw}`;
  if (signPayload(payload) !== sig) return null;
  if (Number(expRaw) < Date.now()) return null;

  const candidateId = Number(candidateIdRaw);
  return Number.isFinite(candidateId) ? candidateId : null;
}

export function suggestPortalLogin(name: string, candidateId: number) {
  const slug = name
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-я\s]/gi, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join("_")
    .slice(0, 24);
  return slug ? `${slug}_${candidateId}` : `candidate_${candidateId}`;
}

export function generatePortalPassword(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}
