import { requireAiActor, failResponse } from "@/lib/ai/guard";
import { verifyFileUrl } from "@/lib/ai/files";
import { db } from "@/lib/db";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/ai/files/[id]?exp=...&sig=...
 *
 * Imzolangan vaqtinchalik yuklab olish. Ikki yo'l:
 * 1) To'g'ri imzo (24 soatlik) — sessiyasiz ham ishlaydi (Telegram/bot uchun).
 * 2) Admin/grader sessiyasi + o'z fayli (imzo bo'lmasa ham).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const exp = url.searchParams.get("exp") || "";
  const sig = url.searchParams.get("sig") || "";

  // Prisma Client dev-serverda yangilanmagan bo'lishi mumkin (DLL band) — runtime xavfsiz
  const file: any = await db.aiFile.findUnique({ where: { id } });
  if (!file) return failResponse("Fayl topilmadi", 404);

  const signed = exp && sig && verifyFileUrl(id, exp, sig);

  if (!signed) {
    // Imzo yo'q/yaroqsiz — sessiya va egalik tekshiriladi
    const guard = await requireAiActor();
    if (!guard.ok) return guard.response;
    if (file.ownerId !== guard.actor.userId && !guard.actor.isAdmin) {
      return failResponse("Bu faylni yuklab olishga ruxsatingiz yo'q", 403);
    }
  }

  // Muddat tugagan fayl
  if (file.expiresAt && file.expiresAt.getTime() < Date.now()) {
    return failResponse("Fayl muddati tugagan", 410);
  }

  const abs = path.join(process.cwd(), file.storagePath);
  // Yo'l xavfsizligi: faqat upload/ai-files ichidan
  const allowedDir = path.join(process.cwd(), "upload", "ai-files");
  if (!path.resolve(abs).startsWith(path.resolve(allowedDir))) {
    return failResponse("Noto'g'ri fayl yo'li", 400);
  }

  try {
    const info = await stat(abs);
    const buf = await readFile(abs);
    // Yuklab olish hisoblagichi (imzosiz urinishlarda ham emas — faqat muvaffaqiyatli)
    db.aiFile.update({ where: { id }, data: { downloadCount: { increment: 1 } } }).catch(() => {});
    const data = new Uint8Array(buf);
    return new Response(data, {
      headers: {
        "content-type": file.mimeType || "application/octet-stream",
        "content-length": String(info.size),
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        "cache-control": "private, max-age=3600",
      },
    });
  } catch {
    return failResponse("Fayl diskda topilmadi", 404);
  }
}
