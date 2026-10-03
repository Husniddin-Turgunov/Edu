import { requireAiActor, failResponse } from "@/lib/ai/guard";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/ai/artifacts/[id] — artifactni SKRIPTSIZ iframe'da ko'rsatish.
 *
 * Xavfsizlik (ikki qatlam):
 *  1) `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline';
 *     img-src data:; base-uri 'none'; form-action 'none'` — sahifa ichida
 *     tashqi manba, skript yoki forma yuborish umuman mumkin emas.
 *  2) Panel tomonda `sandbox=""` (bo'sh) — iframe ichida skript, forma,
 *     top-level navigatsiya va clipboard yo'q. `X-Frame-Options: SAMEORIGIN`
 *     esa boshqa saytning bu faylni o'z iframe'iga qo'yishiga to'sqinlik qiladi.
 *
 * Egalik: faqat egasi yoki admin. Sessiyasiz kirmish taqiqlanadi.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireAiActor();
  if (!guard.ok) return guard.response;

  const artifact: any = await db.aiArtifact.findUnique({ where: { id } });
  if (!artifact) return failResponse("Artifact topilmadi", 404);
  if (artifact.ownerId !== guard.actor.userId && !guard.actor.isAdmin) {
    return failResponse("Bu artifactni ko'rishga ruxsatingiz yo'q", 403);
  }
  if (artifact.expiresAt && artifact.expiresAt.getTime() < Date.now()) {
    return failResponse("Artifact muddati tugagan", 410);
  }

  db.aiArtifact.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  return new Response(artifact.html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, max-age=600",
      "x-content-type-options": "nosniff",
      "x-frame-options": "SAMEORIGIN",
      "referrer-policy": "no-referrer",
      "content-security-policy": [
        "default-src 'none'",
        "style-src 'unsafe-inline'",
        "img-src data:",
        "font-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'self'",
      ].join("; "),
    },
  });
}

/** DELETE /api/ai/artifacts/[id] — o'chirish (faqat egasi). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requireAiActor();
  if (!guard.ok) return guard.response;

  const artifact = await db.aiArtifact.findFirst({ where: { id, ownerId: guard.actor.userId } });
  if (!artifact) return failResponse("Artifact topilmadi", 404);
  await db.aiArtifact.delete({ where: { id } });
  return Response.json({ ok: true, id });
}