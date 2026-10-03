import { requireAiActor, failResponse } from "@/lib/ai/guard";
import { db } from "@/lib/db";
import {
  generateImage,
  storeGeneratedImage,
  imageDailyLimit,
  imagesUsedToday,
  ImageGenerationError,
  IMAGE_MODEL_CHAIN,
  IMAGE_SIZES,
} from "@/lib/ai/image";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/ai/images — rasm yaratish (guard bilan).
 *
 * GET  — bugungi limit holati va oxirgi rasmlar.
 *
 * Xavfsizlik: faqat admin/grader; rasm `upload/ai-files/` ichiga yoziladi va
 * imzolangan URL orqali beriladi; kunlik limit `AI_IMAGE_DAILY_LIMIT`.
 */
export async function POST(req: Request) {
  const guard = await requireAiActor();
  if (!guard.ok) return guard.response;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* bo'sh tanasi — pastda prompt tekshiriladi */
  }

  const prompt = String(body?.prompt || "").trim();
  if (prompt.length < 3) return failResponse("Rasm tavsifi kamida 3 belgi bo'lishi kerak");

  const limit = imageDailyLimit();
  const used = await imagesUsedToday(guard.actor.userId);
  if (used >= limit) {
    return failResponse(`Bugungi rasm limiti tugagan (${limit} ta)`, 429, { used, limit });
  }

  try {
    const image = await generateImage({
      prompt,
      size: body?.size,
      style: body?.style,
    });
    const stored = await storeGeneratedImage({
      ownerId: guard.actor.userId,
      conversationId: body?.conversationId || null,
      image,
      prompt,
      title: prompt.slice(0, 60),
    });
    return Response.json({
      ok: true,
      image: {
        fileId: stored.id,
        fileName: stored.fileName,
        imageUrl: stored.url,
        mimeType: image.mime,
        size: stored.size,
        model: image.model,
        prompt,
      },
      usage: { used: used + 1, limit },
    });
  } catch (err: any) {
    const status = err instanceof ImageGenerationError ? err.providerStatus : 502;
    const mapped = status === 402 ? 402 : status === 429 ? 429 : 502;
    return failResponse(err?.message || "Rasm yaratilmadi", mapped, {
      providerStatus: status,
      attempts: err instanceof ImageGenerationError ? err.attempts : [],
      models: IMAGE_MODEL_CHAIN,
    });
  }
}

export async function GET() {
  const guard = await requireAiActor();
  if (!guard.ok) return guard.response;

  const limit = imageDailyLimit();
  const used = await imagesUsedToday(guard.actor.userId);
  const rows = await db.aiFile.findMany({
    where: { ownerId: guard.actor.userId, kind: "image" },
    select: { id: true, fileName: true, mimeType: true, size: true, specSummary: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  return Response.json({
    ok: true,
    usage: { used, limit, remaining: Math.max(0, limit - used) },
    models: IMAGE_MODEL_CHAIN,
    sizes: IMAGE_SIZES,
    images: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      url: `/api/ai/files/${r.id}`,
    })),
  });
}