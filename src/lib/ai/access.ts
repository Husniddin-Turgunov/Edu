/**
 * lib/ai/access.ts
 *
 * Ko'rinish va ruxsat qoidalari.
 *
 * Misollar:
 *   "Shu foydalanuvchiga shu darslik ko'rinmasin"       -> deny  (lesson)
 *   "Shu testni faqat shu odamlar ko'sin"               -> allow (test) + deny boshqalarga
 *   "Alisherga shu testni qayta topshirishga ruxsat ber" -> allowRetake + maxAttempts
 *
 * Qoida: DENY har doim ustun. Keyin ALLOW. Keyin o'z-o'zidan (default).
 * Bitta (subject, resource) juftligi uchun bitta qoida saqlanadi.
 */

import { db } from "@/lib/db";

export type SubjectType = "user" | "department" | "position" | "role";
export type ResourceType = "lesson" | "test" | "course" | "module" | "video" | "job";
export type Effect = "allow" | "deny";

export const SUBJECT_TYPES: SubjectType[] = ["user", "department", "position", "role"];
export const RESOURCE_TYPES: ResourceType[] = ["lesson", "test", "course", "module", "video", "job"];

export type AccessRuleInput = {
  subjectType: SubjectType;
  subjectValue: string;
  resourceType: ResourceType;
  resourceId: string;
  effect: Effect;
  allowRetake?: boolean;
  maxAttempts?: number | null;
  reason?: string | null;
  expiresAt?: Date | null;
  createdBy?: string | null;
  createdByName?: string | null;
};

/** Foydalanuvchi xususiyatlari — qoidalarni bir xil darajada tekshirish uchun. */
export type AccessSubject = {
  id: string;
  department: string | null;
  position: string | null;
  role: string;
};

export type ResolvedAccess = {
  allowed: boolean;
  /** qoidani bergan kontekst ("user:xxx", "department:IT", "default") */
  matchedBy: string;
  allowRetake: boolean;
  maxAttempts: number | null;
  reason: string | null;
};

/**
 * Foydalanuvchining bitta resursga kirish huquqini aniqlaydi.
 * `defaultAllowed` — bazaviy qoida (masalan test `visibility` maydoni).
 */
export async function resolveAccess(
  subject: AccessSubject,
  resourceType: ResourceType,
  resourceId: string,
  defaultAllowed: boolean,
): Promise<ResolvedAccess> {
  const rules = await db.accessRule.findMany({
    where: {
      resourceType,
      resourceId,
      OR: [
        { subjectType: "user", subjectValue: subject.id },
        { subjectType: "department", subjectValue: subject.department || "__none__" },
        { subjectType: "position", subjectValue: subject.position || "__none__" },
        { subjectType: "role", subjectValue: subject.role },
      ],
    },
  });

  const now = Date.now();
  const active = rules.filter((r) => !r.expiresAt || r.expiresAt.getTime() > now);

  // 1) DENY ustun
  const deny = pickStrongest(active.filter((r) => r.effect === "deny"));
  if (deny) {
    return {
      allowed: false,
      matchedBy: labelOf(deny),
      allowRetake: false,
      maxAttempts: null,
      reason: deny.reason || null,
    };
  }

  // 2) ALLOW
  const allow = pickStrongest(active.filter((r) => r.effect === "allow"));
  if (allow) {
    return {
      allowed: true,
      matchedBy: labelOf(allow),
      allowRetake: !!allow.allowRetake,
      maxAttempts: allow.maxAttempts ?? null,
      reason: allow.reason || null,
    };
  }

  // 3) Default
  return {
    allowed: defaultAllowed,
    matchedBy: "default",
    allowRetake: false,
    maxAttempts: null,
    reason: null,
  };
}

/**
 * O'z-o'zidan "foydalanuvchiga ko'rinadimi" qoidasi.
 * Test uchun `visibility` maydoni ham hisobga olinadi: `selected` bo'lsa
 * foydalanuvchi `assignedUserIds` ichida bo'lishi shart.
 */
export function defaultAllowedForTest(test: {
  visibility: string;
  assignedUserIds: string;
  status: string;
}, userId: string) {
  if (test.status !== "active") return false;
  if (test.visibility === "all") return true;
  try {
    const ids: string[] = JSON.parse(test.assignedUserIds || "[]");
    return ids.includes(userId);
  } catch {
    return false;
  }
}

/** Foydalanuvchining barcha "user" qoidalari (matritsa uchun). */
export async function getUserRules(userId: string) {
  return db.accessRule.findMany({
    where: {
      OR: [
        { subjectType: "user", subjectValue: userId },
        { subjectType: "department", subjectValue: { not: "" } },
        { subjectType: "position", subjectValue: { not: "" } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Bir nechta resurs uchun qoidalarni bitta so'rovda oladi (N+1 yo'q). */
export async function getRulesForResources(resourceType: ResourceType, resourceIds: string[]) {
  if (resourceIds.length === 0) return new Map<string, Awaited<ReturnType<typeof db.accessRule.findMany>>>();
  const rules = await db.accessRule.findMany({
    where: { resourceType, resourceId: { in: resourceIds } },
  });
  const map = new Map<string, typeof rules>();
  for (const rule of rules) {
    const list = map.get(rule.resourceId) || [];
    list.push(rule);
    map.set(rule.resourceId, list);
  }
  return map;
}

/** Qoida yaratadi yoki yangilaydi (juftlik bo'yicha unikal). */
export async function upsertRule(input: AccessRuleInput) {
  const subjectValue = input.subjectValue.trim().slice(0, 191);
  if (!subjectValue) throw new Error("Qoidalash subyekti bo'sh bo'lishi mumkin emas");
  if (!input.resourceId) throw new Error("Resurs tanlanmagan");

  const payload = {
    effect: input.effect,
    allowRetake: input.resourceType === "test" ? !!input.allowRetake : false,
    maxAttempts:
      input.resourceType === "test" && input.maxAttempts != null && input.maxAttempts > 0
        ? Math.min(100, Math.floor(input.maxAttempts))
        : null,
    reason: input.reason?.trim() || null,
    expiresAt: input.expiresAt || null,
    createdBy: input.createdBy || null,
    createdByName: input.createdByName || null,
  };

  return db.accessRule.upsert({
    where: {
      subjectType_subjectValue_resourceType_resourceId: {
        subjectType: input.subjectType,
        subjectValue,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      },
    },
    create: {
      subjectType: input.subjectType,
      subjectValue,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      ...payload,
    },
    update: payload,
  });
}

export async function deleteRule(id: string) {
  return db.accessRule.delete({ where: { id } });
}

export async function deleteRulesForResource(resourceType: ResourceType, resourceId: string) {
  return db.accessRule.deleteMany({ where: { resourceType, resourceId } });
}

const SUBJECT_PRIORITY: Record<SubjectType, number> = {
  user: 4,
  position: 3,
  department: 2,
  role: 1,
};

type Picked = {
  subjectType: string;
  subjectValue: string;
  expiresAt: Date | null;
  allowRetake: boolean;
  maxAttempts: number | null;
  reason: string | null;
};

/**
 * Bir xil ta'sirga ega qoidalar ichida eng kuchlisi: foydalanuvchi > lavozim >
 * bo'lim > rol. Kelgusi bo'lsa muddati eng uzoq bo'lgani.
 */
function pickStrongest(rules: Picked[]): Picked | null {
  const priority = (type: string) => SUBJECT_PRIORITY[type as SubjectType] ?? 0;
  let best: Picked | null = null;
  for (const rule of rules) {
    if (!best) {
      best = rule;
      continue;
    }
    const diff = priority(rule.subjectType) - priority(best.subjectType);
    if (diff > 0) {
      best = rule;
    } else if (diff === 0) {
      const ruleExp = rule.expiresAt?.getTime() ?? Infinity;
      const bestExp = best.expiresAt?.getTime() ?? Infinity;
      if (rule.allowRetake !== best.allowRetake) {
        if (rule.allowRetake) best = rule;
      } else if (ruleExp > bestExp) {
        best = rule;
      }
    }
  }
  return best;
}

function labelOf(rule: { subjectType: string; subjectValue: string }) {
  const names: Record<string, string> = {
    user: "Foydalanuvchi",
    department: "Bo'lim",
    position: "Lavozim",
    role: "Rol",
  };
  return `${names[rule.subjectType] || rule.subjectType}: ${rule.subjectValue}`;
}

/** Test uchun ruxsat + qayta topshirish chegarasini bitta obyektda beradi. */
export async function resolveTestPermissions(
  user: AccessSubject,
  test: { id: string; visibility: string; assignedUserIds: string; status: string; maxAttempts: number },
  attemptCount: number,
) {
  const access = await resolveAccess(user, "test", test.id, defaultAllowedForTest(test, user.id));
  // Qayta topshirish chegarasi: qoidadan kelgan maxAttempts ustun turadi
  const effectiveMax = access.maxAttempts ?? test.maxAttempts;
  const canAttempt =
    access.allowed && (effectiveMax === 0 || attemptCount < effectiveMax || access.allowRetake);
  return {
    allowed: access.allowed,
    allowRetake: access.allowRetake,
    canAttempt,
    effectiveMaxAttempts: effectiveMax,
    attemptsUsed: attemptCount,
    matchedBy: access.matchedBy,
    reason: access.reason,
  };
}