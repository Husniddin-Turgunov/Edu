/**
 * lib/ai/key-crypto.ts
 *
 * AI ruter kalitlarini bazada SHIFRLANGAN holda saqlash.
 *
 * Nima uchun: kalit `AiProviderKey.keyCipher` ustida AES-256-GCM bilan
 * yoziladi. Oddiy matnda saqlansa, kimdir DB ga kirsa (SQL injection,
 * backup, `psql` chiqishi) — barcha modellarning kaliti ochiq chiqardi.
 *
 * Kalit o'zi `AKELA_SESSION_SECRET` yoki `NEXTAUTH_SECRET` dan hosil qilinadi
 * (scrypt + 32 bayt). Ikkalasi ham yo'q bo'lsa — modul ishlamaydi: AI
 * kalitlarini saqlash mumkin emas, lekin mavjud `.env` kalitlari ham
 * ishlayveradi (ular runtime'da `process.env` dan olinadi).
 *
 * Format: `v1.<iv-b64>.<tag-b64>.<cipher-b64>`
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const VERSION = "v1";
const ALGO = "aes-256-gcm";

/** Kalitni shifrlash uchun 32 baytli kalit hosil qiladi. */
function masterKey(): Buffer {
  const secret =
    process.env.AKELA_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "";
  if (!secret) throw new Error("Kalitni shifrlash uchun AKELA_SESSION_SECRET yoki NEXTAUTH_SECRET kerak");
  // scrypt — ikkala ikki ikkilik kalitga siqmaydi va teskari yo'nalish qiyin.
  return scryptSync(secret, "akela-ai-key-v1", 32);
}

/** Shifrlash mumkinmi? (kalit mavjudligini tekshirish — xatolarsiz). */
export function cryptoAvailable(): boolean {
  try {
    masterKey();
    return true;
  } catch {
    return false;
  }
}

/** Ochiq kalitni `v1.iv.tag.cipher` ko'rinishiga shifrlaydi. */
export function encryptKey(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, masterKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

/** `v1.iv.tag.cipher` ko'rinishini ochiq kalitga qaytaradi. */
export function decryptKey(payload: string): string {
  const parts = String(payload || "").split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("Kalit formati noto'g'ri");
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(ALGO, masterKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Ko'rsatish uchun: `sk-…a1b2` → `sk-••••••a1b2`. */
export function keyHint(plain: string): string {
  const s = String(plain || "");
  if (!s) return "";
  const tail = s.slice(-4);
  const head = s.slice(0, s.startsWith("sk-") ? 3 : 2);
  return `${head}${"•".repeat(6)}${tail}`;
}