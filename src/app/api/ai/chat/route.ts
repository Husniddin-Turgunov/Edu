import { requireAiActor, failResponse } from "@/lib/ai/guard";
import { runAgent, recordUsage } from "@/lib/ai/agent";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * POST /api/ai/chat
 *
 * SSE (text/event-stream) streaming: mijoz har bir bosqichni darhol ko'radi —
 * "rejalashyapti", "vosita ishga tushdi", "natija", "yakuniy javob".
 * Token-level: model yozayotganda `reply_delta` eventlari jonli keladi.
 */
export async function POST(req: Request) {
  const guard = await requireAiActor();
  if (!guard.ok) return guard.response;
  const actor = guard.actor;

  let body: {
    message?: string;
    conversationId?: string | null;
    attachmentIds?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return failResponse("So'rov tanasi JSON emas");
  }

  const message = String(body.message || "").trim();
  if (!message) return failResponse("Xabar bo'sh");
  if (message.length > 6000) return failResponse("Xabar juda uzun (6000 belgi limit)");

  const attachmentIds = Array.isArray(body.attachmentIds)
    ? body.attachmentIds.filter((v) => typeof v === "string").slice(0, 10)
    : [];

  const encoder = new TextEncoder();
  const controller = new AbortController();
  req.signal.addEventListener("abort", () => controller.abort());

  const stream = new ReadableStream({
    async start(streamController) {
      // SSE formati: `data: {...}\n\n`. Mijoz POST orqali fetch reader
      // bilan o'qiydi (EventSource faqat GET'ni qo'llaydi).
      const send = (event: Record<string, unknown>) => {
        try {
          streamController.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* mijoz uzib tashlagan */
        }
      };

      try {
        send({ type: "start", provider: actor.isAdmin ? "ai" : "ai" });

        // Jonli oqim: har bir bosqich (reja → vosita → dashboard → javob)
        // YARATILISHI BILAN darhol yuboriladi. Mijoz shu tufayli "nima
        // qilayotgani"ni real vaqtda ko'radi — yakuniy yig'indi emas.
        const result = await runAgent({
          actor,
          conversationId: body.conversationId || null,
          message,
          attachmentIds,
          signal: controller.signal,
          onEvent: (event) => send(event),
        });

        send({ type: "reply", reply: result.reply, conversationId: result.conversationId });
        send({ type: "usage", usage: result.usage, providerLive: result.providerLive });
        if (result.error) send({ type: "error", error: result.error });

        if (result.conversationId) {
          await recordUsage(actor.userId, {
            requests: 1,
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            cost: result.usage.cost,
          });
        }
      } catch (err: any) {
        send({ type: "error", error: err?.message || "Noma'lum xato" });
      } finally {
        streamController.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "connection": "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

/** GET /api/ai/chat?conversationId=... вЂ” suhbat tarixi. */
export async function GET(req: Request) {
  const guard = await requireAiActor();
  if (!guard.ok) return guard.response;
  const actor = guard.actor;

  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversationId");

  if (!conversationId) {
    const conversations = await db.aiConversation.findMany({
      where: { userId: actor.userId },
      select: { id: true, title: true, messageCount: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    return Response.json({ ok: true, conversations });
  }

  const conversation = await db.aiConversation.findFirst({
    where: { id: conversationId, userId: actor.userId },
    select: { id: true, title: true },
  });
  if (!conversation) return failResponse("Suhbat topilmadi", 404);

  const messages = await db.aiMessage.findMany({
    where: { conversationId },
    select: { id: true, role: true, content: true, actions: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return Response.json({
    ok: true,
    conversation,
    messages: messages.map((m) => ({
      ...m,
      actions: m.actions ? safeParse(m.actions) : null,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

function safeParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}