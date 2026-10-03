/**
 * lib/ai/files.ts
 *
 * AI yaratgan fayllar uchun imzolangan vaqtinchalik yuklab olish URL'lari.
 *
 * Nima uchun imzo: `/upload/...` to'g'ridan-to'g'ri public bo'lsa, kimdir
 * fayl ID'ni topib boshqa odamning hisobotini yuklab oladi (IDOR).
 * HMAC imzo + muddat (`exp`) bilan faqat egasi (yoki imzo bergan admin)
 * yuklab oladi.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

function fileSecret(): string {
  return (
    process.env.AKELA_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "akela-dev-file-secret"
  );
}

/** Fayl saqlanadigan papka (loyiha ildizidan). */
export const AI_FILES_DIR = "upload/ai-files";

/** Imzolangan URL muddati — 24 soat. */
export const FILE_URL_TTL_MS = 24 * 60 * 60 * 1000;

/** Fayl o'lchami chegarasi — 25 MB. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

const SAFE_NAME_RE = /^[a-zA-Z0-9._\- ]+$/;

export type FileKind = "excel" | "word" | "pdf";

export const KIND_MIME: Record<FileKind, string> = {
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  word: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

export const KIND_EXT: Record<FileKind, string> = {
  excel: "xlsx",
  word: "docx",
  pdf: "pdf",
};

/**
 * Fayl nomini xavfsiz qilish: yo'l ajratgichlar va maxsus belgilar olib
 * tashlanadi, o'zbekcha harflar saqlanadi.
 */
export function safeFileName(raw: string, kind: FileKind): string {
  const base = String(raw || "hujjat")
    .replace(/[\\/]/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/["*:;<>?|]/g, "")
    .trim()
    .slice(0, 80) || "hujjat";
  const ext = KIND_EXT[kind];
  const withoutExt = base.replace(/\.(xlsx|docx|pdf)$/i, "");
  void SAFE_NAME_RE;
  return `${withoutExt}.${ext}`;
}

/** Yuklab olish uchun imzo yaratish: `fileId.exp.signature`. */
export function signFileUrl(fileId: string, expiresAt: number): string {
  const payload = `${fileId}.${expiresAt}`;
  const sig = createHmac("sha256", fileSecret()).update(payload).digest("hex");
  return `/api/ai/files/${encodeURIComponent(fileId)}?exp=${expiresAt}&sig=${sig}`;
}

/** Imzoni tekshirish. Noto'g'ri yoki muddati o'tgan bo'lsa `null`. */
export function verifyFileUrl(fileId: string, exp: string, sig: string): boolean {
  const expiresAt = Number(exp);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  if (!sig || !/^[0-9a-f]{64}$/.test(sig)) return false;
  const expected = createHmac("sha256", fileSecret()).update(`${fileId}.${expiresAt}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/** Fayl hajmini odam o'qiydigan formatda. */
export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}
