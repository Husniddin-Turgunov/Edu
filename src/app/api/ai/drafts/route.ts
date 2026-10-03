import { requireAiActor, failResponse } from "@/lib/ai/guard";
import { runTool } from "@/lib/ai/tools";
import { checkRateLimit } from "@/lib/ai/agent";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET  /api/ai/drafts вЂ” qoralamalar ro'yxati (?id=... bilan bitta qoralama)
 * POST /api/ai/drafts вЂ” {draftId, action: "apply"|"reject", status}
 *
 * "Tasdiqlagandan keyin testni qo'shish" shu yo'l orqali bajariladi.
 */
export async function GET(req: Request) {
  const guard = await requireAiActor();
  if (!guard.ok) return guard.response;

  const id = new URL(req.url).searchParams.get("id");

  if (!id) {
    const drafts = await db.aiDraft.findMany({
      select: {
        id: true,
        title: true,
        topic: true,
        status: true,
        sourceMode: true,
        sourceIds: true,
        sourceNotes: true,
        testId: true,
        updatedAt: true,
        owner: { select: { email: true, name: true, surname: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    return Response.json({
      ok: true,
      drafts: drafts.map((d) => ({
        ...d,
        sourceIds: safeArray(d.sourceIds),
        updatedAt: d.updatedAt.toISOString(),
      })),
    });
  }

  const draft = await db.aiDraft.findUnique({ where: { id } });
  if (!draft) return failResponse("Qoralama topilmadi", 404);

  let payload: unknown = null;
  try {
    payload = JSON.parse(draft.payload);
  } catch {
    payload = null;
  }

  const attachmentIds: string[] = safeStringArray(draft.sourceIds);
  const attachments = attachmentIds.length
    ? await db.aiAttachment.findMany({
        where: { id: { in: attachmentIds } },
        select: { id: true, fileName: true, charCount: true, wordCount: true, parser: true },
      })
    : [];

  return Response.json({
    ok: true,
    draft: {
      id: draft.id,
      title: draft.title,
      topic: draft.topic,
      status: draft.status,
      sourceMode: draft.sourceMode,
      testId: draft.testId,
      sourceNotes: draft.sourceNotes,
      sourceIds: attachmentIds,
      webRefs: safeArray(draft.webRefs),
      attachments,
      updatedAt: draft.updatedAt.toISOString(),
      payload,
    },
  });
}

export async function POST(req: Request) {
  const guard = await requireAiActor();
  if (!guard.ok) return guard.response;

  // Rate limit — apply qilganda LLM/test yaratish xarajati cheksiz bo'lmasligi uchun
  const quota = await checkRateLimit(guard.actor.userId);
  if (!quota.allowed) {
    return failResponse(`Kunlik limitdan oshdingiz (${quota.used}/${quota.limit})`, 429);
  }

  let body: { draftId?: string; action?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return failResponse("JSON kutilgan");
  }

  const draftId = String(body.draftId || "").trim();
  if (!draftId) return failResponse("draftId kerak");

  if (body.action === "reject") {
    const result = await runTool(
      "draft.reject",
      { draftId, confirm: true },
      { actor: guard.actor, conversationId: null, source: "capability" },
    );
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }

  if (body.action === "apply") {
    const result = await runTool(
      "test.applyDraft",
      { draftId, confirm: true, status: body.status === "active" ? "active" : "draft" },
      { actor: guard.actor, conversationId: null, source: "capability" },
    );
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }

  return failResponse("action: 'apply' yoki 'reject' bo'lishi kerak");
}

function safeArray(raw: string | null): unknown[] {
  try {
    const value = JSON.parse(raw || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function safeStringArray(raw: string | null): string[] {
  return safeArray(raw).filter((v): v is string => typeof v === "string");
}