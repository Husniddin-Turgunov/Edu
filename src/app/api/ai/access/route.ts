import { requireAiActor, failResponse } from "@/lib/ai/guard";
import { deleteRule, upsertRule, type SubjectType, type ResourceType, type Effect } from "@/lib/ai/access";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Ko'rinish va ruxsat qoidalalari вЂ” "hamma funksiyadan foydalana oladigan"
 * to'g'ridan-to'g'ri boshqaruv yo'li.
 *
 * GET    вЂ” qoidalar ro'yxati (?resourceType=test|lesson|... &resourceId=...)
 * POST   вЂ” qoida yaratish/yangilash
 * DELETE вЂ” qoida o'chirish (?id=...)
 */
export async function GET(req: Request) {
  const guard = await requireAiActor();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const resourceType = url.searchParams.get("resourceType");
  const resourceId = url.searchParams.get("resourceId");
  const subjectType = url.searchParams.get("subjectType");
  const subjectValue = url.searchParams.get("subjectValue");

  const where: Record<string, unknown> = {};
  if (resourceType) where.resourceType = resourceType;
  if (resourceId) where.resourceId = resourceId;
  if (subjectType) where.subjectType = subjectType;
  if (subjectValue) where.subjectValue = subjectValue;

  const rules = await db.accessRule.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const userIds: string[] = [
    ...new Set(rules.filter((r) => r.subjectType === "user").map((r) => r.subjectValue)),
  ];
  const users = userIds.length
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, name: true, surname: true, department: true, position: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const testIds: string[] = [
    ...new Set(rules.filter((r) => r.resourceType === "test").map((r) => r.resourceId)),
  ];
  const lessonIds: string[] = [
    ...new Set(rules.filter((r) => r.resourceType === "lesson").map((r) => r.resourceId)),
  ];
  const [tests, lessons]: [{ id: string; title: string }[], { id: string; title: string }[]] =
    await Promise.all([
      testIds.length
        ? db.test.findMany({ where: { id: { in: testIds } }, select: { id: true, title: true } })
        : Promise.resolve([] as { id: string; title: string }[]),
      lessonIds.length
        ? db.lesson.findMany({ where: { id: { in: lessonIds } }, select: { id: true, title: true } })
        : Promise.resolve([] as { id: string; title: string }[]),
    ]);
  const testMap = new Map<string, string>(tests.map((t) => [t.id, t.title]));
  const lessonMap = new Map<string, string>(lessons.map((l) => [l.id, l.title]));

  return Response.json({
    ok: true,
    rules: rules.map((r) => {
      const user = r.subjectType === "user" ? userMap.get(r.subjectValue) : undefined;
      return {
        id: r.id,
        subjectType: r.subjectType,
        subjectValue: r.subjectValue,
        subjectLabel: user
          ? `${[user.surname, user.name].filter(Boolean).join(" ").trim() || user.email} <${user.email}>`
          : `${r.subjectValue}`,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        resourceLabel:
          r.resourceType === "test"
            ? testMap.get(r.resourceId) || r.resourceId
            : r.resourceType === "lesson"
              ? lessonMap.get(r.resourceId) || r.resourceId
              : r.resourceId,
        effect: r.effect,
        allowRetake: r.allowRetake,
        maxAttempts: r.maxAttempts,
        reason: r.reason,
        createdByName: r.createdByName,
        expiresAt: r.expiresAt?.toISOString() || null,
        createdAt: r.createdAt.toISOString(),
        expired: !!r.expiresAt && r.expiresAt.getTime() < Date.now(),
      };
    }),
  });
}

export async function POST(req: Request) {
  const guard = await requireAiActor();
  if (!guard.ok) return guard.response;
  const actor = guard.actor;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return failResponse("JSON kutilgan");
  }

  const subjectType = String(body.subjectType || "") as SubjectType;
  const resourceType = String(body.resourceType || "") as ResourceType;
  const effect = String(body.effect || "allow") as Effect;

  if (!["user", "department", "position", "role"].includes(subjectType)) {
    return failResponse("subjectType: user | department | position | role");
  }
  if (!["lesson", "test", "course", "module", "video", "job"].includes(resourceType)) {
    return failResponse("resourceType: lesson | test | course | module | video | job");
  }
  if (effect !== "allow" && effect !== "deny") {
    return failResponse("effect: allow yoki deny");
  }
  const subjectValue = String(body.subjectValue || "").trim();
  const resourceId = String(body.resourceId || "").trim();
  if (!subjectValue) return failResponse("subjectValue kerak");
  if (!resourceId) return failResponse("resourceId kerak");

  // Resurs mavjudligini tekshiramiz вЂ” noto'g'ri ID yozib qolmasin
  const exists = await resourceExists(resourceType, resourceId);
  if (!exists) return failResponse("Bunday resurs bazada topilmadi", 404);

  let subjectId = subjectValue;
  if (subjectType === "user") {
    const user = await db.user.findUnique({ where: { id: subjectValue }, select: { id: true } });
    if (user) subjectId = user.id;
    else {
      const byEmail = await db.user.findUnique({
        where: { email: subjectValue },
        select: { id: true, email: true },
      });
      if (!byEmail) return failResponse(`Foydalanuvchi topilmadi: ${subjectValue}`, 404);
      subjectId = byEmail.id;
    }
  }

  const rule = await upsertRule({
    subjectType,
    subjectValue: subjectId,
    resourceType,
    resourceId,
    effect,
    allowRetake: body.allowRetake === true,
    maxAttempts: body.maxAttempts == null ? null : Number(body.maxAttempts),
    reason: body.reason ? String(body.reason).slice(0, 500) : null,
    expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : null,
    createdBy: actor.userId,
    createdByName: actor.email,
  });

  await db.aiAuditLog.create({
    data: {
      actorId: actor.userId,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "access.rule.set",
      outcome: "ok",
      detail: `${subjectType}:${subjectId} -> ${resourceType}:${resourceId} = ${effect}${rule.allowRetake ? " +retake" : ""}`,
      resourceType,
      resourceId,
      source: "capability",
    },
  });

  return Response.json({ ok: true, rule });
}

export async function DELETE(req: Request) {
  const guard = await requireAiActor();
  if (!guard.ok) return guard.response;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return failResponse("id kerak");

  await deleteRule(id);
  await db.aiAuditLog.create({
    data: {
      actorId: guard.actor.userId,
      actorEmail: guard.actor.email,
      actorRole: guard.actor.role,
      action: "access.rule.delete",
      outcome: "ok",
      detail: id,
      source: "capability",
    },
  });

  return Response.json({ ok: true, id });
}

async function resourceExists(type: string, id: string) {
  switch (type) {
    case "test":
      return (await db.test.count({ where: { id } })) > 0;
    case "lesson":
      return (await db.lesson.count({ where: { id } })) > 0;
    case "course":
      return (await db.course.count({ where: { id } })) > 0;
    case "module":
      return (await db.module.count({ where: { id } })) > 0;
    case "video":
      return (await db.video.count({ where: { id } })) > 0;
    case "job":
      return (await db.jobCourse.count({ where: { id } })) > 0;
    default:
      return false;
  }
}