/** Phase 7 — 3-month learning program to Middle. */

export const LESSON_WORKFLOW_STATUSES = [
  "not_started",
  "studying",
  "submitted",
  "returned",
  "fixing",
  "accepted",
  "recheck",
  "credited",
] as const;

export type LessonWorkflowStatus = (typeof LESSON_WORKFLOW_STATUSES)[number];

export const PROGRAM_PATH_MODES = [
  "full",
  "check_only",
  "hard_case",
  "skip",
] as const;

export type ProgramPathMode = (typeof PROGRAM_PATH_MODES)[number];

export const LEARNING_MONTH_THEMES: Record<
  1 | 2 | 3,
  { titleKey: string; bullets: string[] }
> = {
  1: {
    titleKey: "learn_month_1_title",
    bullets: [
      "learn_month_1_b1",
      "learn_month_1_b2",
      "learn_month_1_b3",
      "learn_month_1_b4",
      "learn_month_1_b5",
    ],
  },
  2: {
    titleKey: "learn_month_2_title",
    bullets: [
      "learn_month_2_b1",
      "learn_month_2_b2",
      "learn_month_2_b3",
      "learn_month_2_b4",
      "learn_month_2_b5",
    ],
  },
  3: {
    titleKey: "learn_month_3_title",
    bullets: [
      "learn_month_3_b1",
      "learn_month_3_b2",
      "learn_month_3_b3",
      "learn_month_3_b4",
      "learn_month_3_b5",
    ],
  },
};

export function isLessonWorkflowStatus(
  value: string,
): value is LessonWorkflowStatus {
  return (LESSON_WORKFLOW_STATUSES as readonly string[]).includes(value);
}

export function isProgramPathMode(value: string): value is ProgramPathMode {
  return (PROGRAM_PATH_MODES as readonly string[]).includes(value);
}

/** Confirmed enough for Middle bar → check / skip basic. */
export function competencyLooksConfirmed(status: string) {
  return ["middle_minus", "middle", "junior_plus"].includes(status);
}

export function competencyNeedsFullPath(status: string) {
  return [
    "not_checked",
    "doesnt_know",
    "partial",
    "junior",
    "needs_recheck",
  ].includes(status);
}

/** Infer month 1–3 from program day (Junior→Middle ≈ 60 work days). */
export function inferProgramMonth(input: {
  programMonth?: number | null;
  dayNumber?: number | null;
  slug?: string | null;
}) {
  if (input.programMonth && input.programMonth >= 1 && input.programMonth <= 3) {
    return input.programMonth as 1 | 2 | 3;
  }
  let day = input.dayNumber ?? 0;
  if (!day && input.slug) {
    const match = input.slug.match(/-j2m-day-(\d+)/i);
    if (match) day = Number(match[1]) || 0;
  }
  if (day <= 0) return 1 as const;
  if (day <= 20) return 1 as const;
  if (day <= 40) return 2 as const;
  return 3 as const;
}

export function pickPathMode(input: {
  confirmed: boolean;
  weakTopic: boolean;
}): ProgramPathMode {
  if (input.confirmed && !input.weakTopic) return "check_only";
  if (input.confirmed && input.weakTopic) return "hard_case";
  return "full";
}

export function statusIsDone(status: string) {
  return status === "credited" || status === "accepted" || status === "skip";
}

export function statusIsInProgress(status: string) {
  return [
    "studying",
    "submitted",
    "returned",
    "fixing",
    "recheck",
    "accepted",
  ].includes(status);
}

/** Day number from slug/title for sequential unlock (1, 2, 3…). 0 = no day. */
export function lessonDayNumber(input: {
  slug?: string | null;
  id?: string | null;
  title?: string | null;
}) {
  const slug = `${input.slug ?? ""} ${input.id ?? ""}`;
  const fromSlug = slug.match(/-(?:j2m-|staff-)?day-(\d+)/i);
  if (fromSlug) return Number(fromSlug[1]) || 0;
  const fromTitle = `${input.title ?? ""}`.match(/(?:день|day)\s*[·.\-]?\s*(\d+)/i);
  if (fromTitle) return Number(fromTitle[1]) || 0;
  return 0;
}

/**
 * Day N opens only after every earlier day in the same catalog is completed.
 * Lessons without a day number stay available (level gate still applies).
 */
export function isLessonDayUnlocked(
  lesson: { slug?: string | null; id?: string | null; title?: string | null },
  catalog: {
    slug?: string | null;
    id?: string | null;
    title?: string | null;
    completed?: boolean;
  }[],
) {
  const day = lessonDayNumber(lesson);
  if (day <= 1) return true;
  const earlier = catalog.filter((item) => {
    const itemDay = lessonDayNumber(item);
    return itemDay > 0 && itemDay < day;
  });
  if (earlier.length === 0) return true;
  return earlier.every((item) => item.completed);
}
