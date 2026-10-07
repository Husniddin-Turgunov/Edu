import { requireAiActor, failResponse } from "@/lib/ai/guard";
import { runTool, getTool } from "@/lib/ai/tools";
import { checkRateLimit } from "@/lib/ai/agent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * POST /api/ai/tools/[name]
 *
 * "Imkoniyatlar" sahifasidagi kartalardan to'g'ridan-to'g'ri bajarish.
 * Chat bilan bir xil yo'l: xavfsizlik, validatsiya, audit — hammasi bir joyda.
 */
export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const guard = await requireAiActor();
  if (!guard.ok) return guard.response;
  const actor = guard.actor;

  const { name } = await params;
  const tool = getTool(name);
  if (!tool) return failResponse(`Noma'lum vosita: ${name}`, 404);

  // Rate limit — LLM chaqiradigan tool'lar (masalan test.generate) cheksiz bo'lmasligi uchun
  const quota = await checkRateLimit(actor.userId);
  if (!quota.allowed) {
    return failResponse(`Kunlik limitdan oshdingiz (${quota.used}/${quota.limit})`, 429);
  }

  let args: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) args = JSON.parse(text);
  } catch {
    return failResponse("Argumentlar JSON emas");
  }

  const result = await runTool(name, args, {
    actor,
    conversationId: null,
    source: "capability",
  });

  return Response.json(result, { status: result.ok ? 200 : 400 });
}

/** GET вЂ” vosita shakli (maydonlar) */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const guard = await requireAiActor();
  if (!guard.ok) return guard.response;

  const { name } = await params;
  const tool = getTool(name);
  if (!tool) return failResponse(`Noma'lum vosita: ${name}`, 404);

  return Response.json({
    ok: true,
    tool: {
      name: tool.name,
      title: tool.title,
      category: tool.category,
      description: tool.description,
      example: tool.example,
      needsConfirm: !!tool.needsConfirm,
      mutating: tool.mutating,
      fields: tool.fields,
    },
  });
}