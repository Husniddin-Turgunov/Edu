import { LEVEL_ORDER, type LevelCode } from "@/lib/levels";
import {
  lessonAssignedToStaffRole,
  normalizeRole,
  roleTokens,
} from "@/lib/role-match";
import type { KnowledgeProfile } from "@/lib/scoring";

export type LessonLevel = Exclude<LevelCode, "unassessed"> | "all";

export type Lesson = {
  id: string;
  title: string;
  summary: string;
  level: LessonLevel;
  /** Role family keys used for matching, e.g. office, hr, it */
  roleFamilies: string[];
  /** Topic tags matched against knowledge gaps / sections */
  topics: string[];
  durationMin: number;
};

export const ROLE_FAMILIES: { id: string; label: string; tokens: string[] }[] =
  [
    {
      id: "office",
      label: "Офис и администрация",
      tokens: ["офис", "ресепш", "ассистент", "помощник"],
    },
    {
      id: "it",
      label: "IT и инфраструктура",
      tokens: ["системный", "администратор", "devops", "кибер", "интеграц", "разработ"],
    },
    {
      id: "hr",
      label: "HR и персонал",
      tokens: ["hr", "рекрутер", "кадр", "персонал", "коуч"],
    },
    {
      id: "sales",
      label: "Продажи",
      tokens: ["продаж", "коммерч", "менеджер проектных"],
    },
    {
      id: "call",
      label: "Колл-центр",
      tokens: ["колл", "call", "оператор", "супервайзер"],
    },
    {
      id: "security",
      label: "Безопасность",
      tokens: ["охран", "безопасн"],
    },
    {
      id: "logistics",
      label: "Хозяйство и логистика",
      tokens: ["водитель", "хозяйств", "диспетчер", "уборщ", "разнораб"],
    },
    {
      id: "marketing",
      label: "Маркетинг и контент",
      tokens: ["маркетолог", "smm", "контент", "таргет", "дизайн", "мобилограф"],
    },
    {
      id: "finance",
      label: "Финансы и юристы",
      tokens: ["бухгалтер", "юрист", "финанс"],
    },
    {
      id: "leadership",
      label: "Руководство",
      tokens: ["директор", "начальник", "управляющ", "ceo", "chro"],
    },
    {
      id: "general",
      label: "Общие навыки",
      tokens: [],
    },
  ];

/** Former demo lesson slugs — removed from DB on migrate, not re-seeded. */
export const DEMO_LESSON_SLUGS = ["gen-junior-basics", "gen-junior-quality", "gen-middle-ownership", "gen-middle-feedback", "gen-senior-complexity", "gen-lead-metrics", "gen-expert-standards", "office-docs", "office-calendar", "office-ops", "it-security-basics", "it-incidents", "it-infra", "hr-brief", "hr-sourcing", "hr-offer", "sales-discovery", "sales-pipeline", "sales-complex", "call-script", "call-hard", "call-qa", "sec-protocol", "sec-incident", "log-route", "log-dispatch", "mkt-brief", "mkt-metrics", "fin-docs", "law-contract", "lead-1on1", "lead-delegation"] as const;

/** Live catalog lives in DB (admin /learning). Kept empty on purpose. */
export const LESSON_CATALOG: Lesson[] = [];

export function detectRoleFamilies(roleTitle: string): string[] {
  const norm = normalizeRole(roleTitle);
  const tokens = roleTokens(roleTitle);
  const priority = [
    "it",
    "hr",
    "sales",
    "call",
    "security",
    "logistics",
    "marketing",
    "finance",
    "leadership",
    "office",
  ];

  for (const familyId of priority) {
    const family = ROLE_FAMILIES.find((item) => item.id === familyId);
    if (!family) continue;
    const hit = family.tokens.some(
      (token) =>
        norm.includes(token) ||
        tokens.some((t) => t.includes(token) || token.includes(t)),
    );
    if (hit) return [family.id];
  }
  return ["general"];
}

export function levelRank(code: string): number {
  if (code === "all") return -1;
  if (code === "unassessed") return -1;
  return LEVEL_ORDER.indexOf(code as (typeof LEVEL_ORDER)[number]);
}

export function isLevelAccessible(lessonLevel: string, currentLevel: string) {
  if (lessonLevel === "all") return true;
  const current =
    currentLevel === "unassessed" ? "junior" : currentLevel;
  // Intern rank only unlocks intern / all content until promoted to Junior.
  if (current === "intern") {
    return lessonLevel === "intern" || lessonLevel === "all";
  }
  return levelRank(lessonLevel) <= levelRank(current);
}

export function lessonsForRole(roleTitle: string, catalog: Lesson[] = LESSON_CATALOG) {
  return catalog.filter((lesson) =>
    lessonAssignedToStaffRole(lesson.roleFamilies, roleTitle),
  );
}

export function recommendLessons(input: {
  roleTitle: string;
  currentLevel: string;
  gaps: string[];
  weakSections: string[];
  limit?: number;
  catalog?: Lesson[];
}): { lesson: Lesson; reasons: string[] }[] {
  const current =
    input.currentLevel === "unassessed" ? "junior" : input.currentLevel;
  const currentRank = levelRank(current);
  const gapBlob = [...input.gaps, ...input.weakSections]
    .join(" ")
    .toLowerCase();
  const catalog = input.catalog ?? LESSON_CATALOG;

  const scored = catalog
    .filter((lesson) =>
      lessonAssignedToStaffRole(lesson.roleFamilies, input.roleTitle),
    )
    .filter(
      (lesson) =>
        lesson.level === "all" || levelRank(lesson.level) <= currentRank,
    )
    .map((lesson) => {
    const reasons: string[] = [];
    let score = 5;
    reasons.push("подходит вашей должности");

    const lessonLevel = lesson.level;
    if (lessonLevel === current) {
      score += 5;
      reasons.push("уровень совпадает с вашим");
    } else if (lessonLevel === "all") {
      score += 2;
    } else {
      const diff = Math.abs(levelRank(lessonLevel) - currentRank);
      score += Math.max(0, 2 - diff);
      reasons.push("доступен на вашем уровне");
    }

    const topicHit = lesson.topics.some((topic) => gapBlob.includes(topic));
    if (topicHit) {
      score += 5;
      reasons.push("закрывает пробел из тестов");
    }

    if (reasons.length === 0) reasons.push("полезная база для роста");

    return { lesson, score, reasons };
    });

  return scored
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? 8)
    .map(({ lesson, reasons }) => ({ lesson, reasons }));
}

export function extractLearningSignals(profile: KnowledgeProfile | null): {
  gaps: string[];
  weakSections: string[];
  summary: string | null;
} {
  if (!profile) {
    return { gaps: [], weakSections: [], summary: null };
  }
  const weakSections = profile.sections
    .filter((s) => s.autoCount > 0 && s.pct < 0.7)
    .sort((a, b) => a.pct - b.pct)
    .map((s) => s.name);
  return {
    gaps: profile.gaps ?? [],
    weakSections,
    summary: profile.summary || null,
  };
}
