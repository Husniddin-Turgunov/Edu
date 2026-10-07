/**
 * lib/security/edge-authz.ts — EDGE-MUTTAXOS sessiya tekshiruvi.
 *
 * Middleware (edge runtime) Prisma ishlata olmaydi, shuning uchun bu modul
 * FAQAT imzo tekshiradi (bazasiz):
 *   1) `akela_session` — HMAC-SHA256 imzolangan custom cookie (WebCrypto).
 *   2) NextAuth JWT — `next-auth/jwt` (edge-qo'llab-quvvatlanadi).
 *
 * Imzo to'g'ri bo'lsa `EdgeActor` qaytadi; aks holda null.
 * Ruxsat DARAJASI shu yerda emas, har bir route ichidagi `getSession()` /
 * `requireAdmin()` da yakuniy tekshiriladi — bu modul faqat "kimligini"
 * va "kirishi mumkinmi" deganni chegaralaydi.
 */

import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export type EdgeActor = {
  userId: string;
  role: string;
  isAdmin: boolean;
  exp?: number;
};

function sessionSecret(): string {
  return (
    process.env.AKELA_SESSION_SECRET ||
    process.env.CANDIDATE_SESSION_SECRET ||
    process.env.CRON_SECRET ||
    "akela-dev-session-secret"
  );
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Doimiy vaqtli solishtirish (timing attack qarshi). */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** `akela_session` cookie'ni imzo bilan tekshiradi (edge'da WebCrypto). */
export async function parseSessionCookieEdge(raw: string | undefined): Promise<EdgeActor | null> {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(sessionSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    if (!safeEqualHex(hex(mac), sig.toLowerCase())) return null;
  } catch {
    return null;
  }

  try {
    const data = JSON.parse(b64urlDecode(payload)) as {
      userId?: number | string;
      role?: string;
      exp?: number;
      name?: string;
    };
    if (!data.exp || data.exp < Date.now()) return null;
    if (!data.userId || !data.role) return null;
    const role = String(data.role);
    return {
      userId: String(data.userId),
      role,
      isAdmin: role === "admin",
      exp: data.exp,
    };
  } catch {
    return null;
  }
}

/** So'rovdan joriy aktorni aniqlaydi (ikkala cookie ham tekshiriladi). */
export async function edgeActor(req: NextRequest): Promise<EdgeActor | null> {
  // 1) Custom akela_session
  const custom = await parseSessionCookieEdge(req.cookies.get("akela_session")?.value);
  if (custom) return custom;

  // 2) NextAuth JWT
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (token) {
      const role = String((token as any).role || "");
      const id = String((token as any).id || token.sub || "");
      const status = (token as any).status;
      const isActive = (token as any).isActive;
      // Status faqat JWT ichida — bazasiz tekshiruv shu yerda cheklov.
      // Haqiqiy tekshiruv route ichidagi getSession() da qoladi.
      if (id && status === "approved" && isActive !== false) {
        return {
          userId: id,
          role: role || "participant",
          isAdmin: role === "admin",
        };
      }
      // Eski token (status'siz) — autentifikatsiya bor, lekin holat noma'lum.
      // Edge bazaga ulana olmaydi, shuning uchun qarorni Node qatlamiga
      // qoldiramiz: `getSession()` bazadagi joriy `status` va `role` ni
      // qayta tekshiradi. Shu yerda `isAdmin: false` qilib yopish — admin
      // panelining API'sini (masalan `/api/admin/*`) o'z-o'zidan yopib
      // qo'yardi, chunki ro'l token ichida `admin` bo'lsa ham rad etilardi.
      if (id) {
        return {
          userId: id,
          role: role || "participant",
          isAdmin: role === "admin",
        };
      }
    }
  } catch {
    /* edge'da o'qib bo'lmadi — null */
  }

  return null;
}
