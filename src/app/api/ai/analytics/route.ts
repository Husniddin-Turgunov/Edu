import { requireAiActor, failResponse } from "@/lib/ai/guard";
import { departmentComparison, overviewAnalytics, testAnalytics, userAnalytics } from "@/lib/ai/analytics";
import { resolveProvider } from "@/lib/ai/provider";
import { dailyRequestLimit } from "@/lib/ai/agent";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * GET /api/ai/analytics
 *   ?view=overview            вЂ” umumiy ko'rinish
 *   ?view=test&testId=...     вЂ” bitta test
 *   ?view=user&userId=...     вЂ” bitta xodim
 *   ?view=departments         вЂ” bo'limlar kesimi
 *   ?view=audit               вЂ” AI amal izlari
 */
export async function GET(req: Request) {
  const guard = await requireAiActor();
  if (!guard.ok) return guard.response;
  const actor = guard.actor;

  const url = new URL(req.url);
  const view = url.searchParams.get("view") || "overview";

  try {
    if (view === "test") {
      const testId = url.searchParams.get("testId") || "";
      if (!testId) return failResponse("testId kerak");
      const data = await testAnalytics(testId);
      if (!data) return failResponse("Test topilmadi", 404);
      return Response.json({ ok: true, view, data });
    }

    if (view === "user") {
      const userId = url.searchParams.get("userId") || "";
      if (!userId) return failResponse("userId kerak");
      const data = await userAnalytics(userId);
      if (!data) return failResponse("Foydalanuvchi topilmadi", 404);
      return Response.json({ ok: true, view, data });
    }

    if (view === "departments") {
      const data = await departmentComparison();
      return Response.json({ ok: true, view, data });
    }

    if (view === "audit") {
      const rows = await db.aiAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return Response.json({
        ok: true,
        view,
        data: rows.map((r) => ({
          id: r.id,
          date: r.createdAt.toISOString(),
          actor: r.actorEmail,
          role: r.actorRole,
          action: r.action,
          outcome: r.outcome,
          detail: r.detail,
          resource: `${r.resourceType}:${r.resourceId}`.replace(/:$/, ""),
          source: r.source,
        })),
      });
    }

    if (view === "usage") {
      const day = new Date().toISOString().slice(0, 10);
      const rows = await db.aiUsage.findMany({
        orderBy: { day: "desc" },
        take: 60,
        include: { user: { select: { email: true } } },
      });
      const provider = resolveProvider();
      return Response.json({
        ok: true,
        view,
        data: {
          provider: { name: provider.name, model: provider.model, live: provider.live },
          dailyLimit: dailyRequestLimit(),
          today: day,
          rows: rows.map((r) => ({
            day: r.day,
            email: r.user.email,
            requests: r.requests,
            promptTokens: r.promptTokens,
            completionTokens: r.completionTokens,
            cost: Number(r.estimatedCost.toFixed(6)),
          })),
        },
      });
    }

    const data = await overviewAnalytics();
    return Response.json({ ok: true, view: "overview", data, generatedFor: actor.email });
  } catch (err: any) {
    console.error("[ai/analytics]", err);
    return failResponse(err?.message || "Statistikani hisoblashda xato", 500);
  }
}