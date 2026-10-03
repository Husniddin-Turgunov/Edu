import { requireAiActor, failResponse } from "@/lib/ai/guard";
import { db } from "@/lib/db";
import { buildArtifact, type ArtifactKind } from "@/lib/ai/artifacts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/ai/artifacts — artifact yaratish.
 *
 * Guard + ikki qatlamli himoya: foydalanuvchi matni `escapeHtml` dan o'tadi,
 * tayyor HTML esa `sanitizeHtml` dan. `<script>` va `on*` atributlari
 * qat'iy olib tashlanadi.
 */
export async function POST(req: Request) {
  const guard = await requireAiActor();
  if (!guard.ok) return guard.response;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return failResponse("So'rov tanasi JSON emas");
  }

  const kind = (["dashboard", "code", "html"] as ArtifactKind[]).includes(body?.kind) ? body.kind : "dashboard";
  const title = String(body?.title || "Artifact").slice(0, 160);
  if (!title.trim()) return failResponse("Sarlavha kerak");

  let html = "";
  try {
    html = buildArtifact(kind, { ...body, title });
  } catch (err: any) {
    return failResponse(`Artifact qurilmadi: ${err?.message || err}`);
  }
  if (!html || html.length < 100) return failResponse("Artifact bo'sh chiqdi");

  const record = await db.aiArtifact.create({
    data: {
      ownerId: guard.actor.userId,
      conversationId: body?.conversationId ? String(body.conversationId) : null,
      kind,
      title,
      html,
      source: String(body?.code || "").slice(0, 60_000),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    select: { id: true, title: true, kind: true, createdAt: true },
  });

  return Response.json({
    ok: true,
    artifact: { ...record, createdAt: record.createdAt.toISOString() },
    url: `/api/ai/artifacts/${record.id}`,
  });
}

/** GET /api/ai/artifacts — oxirgi artifactlar (faqat o'ziningi). */
export async function GET() {
  const guard = await requireAiActor();
  if (!guard.ok) return guard.response;

  const rows = await db.aiArtifact.findMany({
    where: { ownerId: guard.actor.userId },
    select: { id: true, title: true, kind: true, viewCount: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return Response.json({
    ok: true,
    artifacts: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      url: `/api/ai/artifacts/${r.id}`,
    })),
  });
}