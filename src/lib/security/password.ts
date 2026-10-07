/**
 * lib/security/password.ts
 *
 * PAROLLAR — FAQAT HASH QILINGAN HOLATDA SAQLANADI.
 *
 * Eski holat: `sha256(parol)` — tuzsiz (salt yo'q) va juda tez (brute-force
 * qiyin emas). Yangi holat: **scrypt** (sodda, Node'da o'rnatilgan, GPU bilan
 * emasam sekin) + 16 baytli tasodifiy salt + doimiy parametrlar.
 *
 * MUHIM: eski sha256 hashlari buzilmasligi uchun `verifyPassword()` ikkala
 * formatni ham qabul qiladi. Muvaffaqiyatli kirishda eski hash **avtomatik
 * ravishda** scrypt'ga aylantiriladi (`rehashNeeded` → caller `passwordHash`ni
 * yangilaydi). Shunda foydalanuvchi parolini o'zgartirmasak ham, ma'lumot
 * bazasi bosqichma-bosqich yangi formatga o'tadi.
 */

import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

/** scrypt parametrlari (Node default: N=16384, r=8, p=1). */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

/** Format belgilari: yangilar `scrypt$...`, eskilar `64 ta hex` (sha256). */
const PREFIX = "scrypt";

export type PasswordHashInfo = {
  /** "scrypt" | "sha256" | "unknown" */
  algorithm: string;
  needsRehash: boolean;
};

/** Yangi (scrypt) hash yaratadi: `scrypt$N$r$p$salt$hash`. */
export function hashPassword(password: string): string {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Parol bo'sh bo'lmaydi");
  }
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return [PREFIX, SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64"), hash.toString("base64")].join("$");
}

function parseScrypt(stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) return null;
  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return null;
  if (N < 1024 || N > 1_048_576 || r < 1 || r > 32 || p < 1 || p > 16) return null; // haddan tashqari kattalikni rad etamiz
  try {
    return { N, r, p, salt: Buffer.from(saltB64, "base64"), hash: Buffer.from(hashB64, "base64") };
  } catch {
    return null;
  }
}

/** Parol to'g'rimi (doimiy vaqtli taqqoslash bilan). */
export function verifyPassword(password: string, stored: string): boolean {
  const parsed = parseScrypt(String(stored || ""));
  if (parsed) {
    if (parsed.hash.length === 0) return false;
    const computed = scryptSync(password, parsed.salt, parsed.hash.length, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
    });
    return computed.length === parsed.hash.length && timingSafeEqual(computed, parsed.hash);
  }

  // Eski sha256 (tuzsiz) — faqat o'qish uchun qo'llab-quvvatlanadi
  if (/^[0-9a-f]{64}$/i.test(String(stored || ""))) {
    const legacy = Buffer.from(createHash("sha256").update(password).digest("hex"), "hex");
    const expected = Buffer.from(String(stored).toLowerCase(), "hex");
    return legacy.length === expected.length && timingSafeEqual(legacy, expected);
  }

  return false;
}

/** Hash qaysi algoritmda va yangilash kerakmi. */
export function inspectPasswordHash(stored: string): PasswordHashInfo {
  const parsed = parseScrypt(String(stored || ""));
  if (parsed) {
    const needsRehash = parsed.N < SCRYPT_N || parsed.r < SCRYPT_R || parsed.p < SCRYPT_P;
    return { algorithm: "scrypt", needsRehash };
  }
  if (/^[0-9a-f]{64}$/i.test(String(stored || ""))) return { algorithm: "sha256", needsRehash: true };
  return { algorithm: "unknown", needsRehash: true };
}

/** Kuchli parol talabi (ro'yxatdan o'tish va parol tiklashda). */
export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  const p = String(password || "");
  if (p.length < 8) problems.push("kamida 8 belgi");
  if (!/[a-zA-Z\u0400-\u04FF]/.test(p)) problems.push("kamida bitta harf");
  if (!/\d/.test(p)) problems.push("kamida bitta raqam");
  if (/^(password|12345678|qwerty|admin|iltimos|parol)/i.test(p)) problems.push("juda oddiy parol");
  return problems;
}