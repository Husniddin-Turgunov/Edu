/** Fixed 5-day trial (пробный период) themes and helpers. */

export const TRIAL_DAY_COUNT = 5;

export const TRIAL_DAY_THEMES = [
  {
    day: 1,
    titleKey: "trial_day_1_title" as const,
    bodyKey: "trial_day_1_body" as const,
    items: [
      "trial_day_1_item_1",
      "trial_day_1_item_2",
      "trial_day_1_item_3",
      "trial_day_1_item_4",
      "trial_day_1_item_5",
      "trial_day_1_item_6",
    ] as const,
  },
  {
    day: 2,
    titleKey: "trial_day_2_title" as const,
    bodyKey: "trial_day_2_body" as const,
    items: [
      "trial_day_2_item_1",
      "trial_day_2_item_2",
      "trial_day_2_item_3",
      "trial_day_2_item_4",
      "trial_day_2_item_5",
      "trial_day_2_item_6",
      "trial_day_2_item_7",
    ] as const,
  },
  {
    day: 3,
    titleKey: "trial_day_3_title" as const,
    bodyKey: "trial_day_3_body" as const,
    items: [
      "trial_day_3_item_1",
      "trial_day_3_item_2",
      "trial_day_3_item_3",
      "trial_day_3_item_4",
      "trial_day_3_item_5",
      "trial_day_3_item_6",
      "trial_day_3_item_7",
      "trial_day_3_item_8",
    ] as const,
  },
  {
    day: 4,
    titleKey: "trial_day_4_title" as const,
    bodyKey: "trial_day_4_body" as const,
    items: [
      "trial_day_4_item_1",
      "trial_day_4_item_2",
      "trial_day_4_item_3",
      "trial_day_4_item_4",
      "trial_day_4_item_5",
      "trial_day_4_item_6",
      "trial_day_4_item_7",
    ] as const,
  },
  {
    day: 5,
    titleKey: "trial_day_5_title" as const,
    bodyKey: "trial_day_5_body" as const,
    items: [
      "trial_day_5_item_1",
      "trial_day_5_item_2",
      "trial_day_5_item_3",
      "trial_day_5_item_4",
      "trial_day_5_item_5",
      "trial_day_5_item_6",
      "trial_day_5_item_7",
    ] as const,
  },
] as const;

export type TrialDecision =
  | "hired"
  | "repeat_day"
  | "extended"
  | "other_role"
  | "ended";

export const TRIAL_DECISIONS: TrialDecision[] = [
  "hired",
  "repeat_day",
  "extended",
  "other_role",
  "ended",
];

export function isTrialDecision(value: string): value is TrialDecision {
  return (TRIAL_DECISIONS as string[]).includes(value);
}

export function addDaysIso(iso: string, days: number) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + days);
    return fallback.toISOString();
  }
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function defaultFiveDayTrialWindow(startsAt?: string | null) {
  const start =
    startsAt && !Number.isNaN(new Date(startsAt).getTime())
      ? new Date(startsAt).toISOString()
      : new Date().toISOString();
  return {
    trialStartsAt: start,
    /** Inclusive 5 calendar days: start + 4 days end-of-day window. */
    trialEndsAt: addDaysIso(start, TRIAL_DAY_COUNT - 1),
  };
}

export function clampTrialDay(day: number) {
  if (!Number.isFinite(day) || day < 1) return 1;
  if (day > TRIAL_DAY_COUNT) return TRIAL_DAY_COUNT;
  return Math.floor(day);
}

export function trialThemeForDay(day: number) {
  const n = clampTrialDay(day);
  return TRIAL_DAY_THEMES[n - 1] ?? TRIAL_DAY_THEMES[0];
}

export function trialProgressPercent(input: {
  currentDay: number;
  reportsDone: number;
  reportsReviewed: number;
}) {
  const dayShare = (clampTrialDay(input.currentDay) - 1) / TRIAL_DAY_COUNT;
  const reportShare =
    Math.min(TRIAL_DAY_COUNT, Math.max(0, input.reportsDone)) /
    TRIAL_DAY_COUNT;
  const reviewShare =
    Math.min(TRIAL_DAY_COUNT, Math.max(0, input.reportsReviewed)) /
    TRIAL_DAY_COUNT;
  return Math.round(
    Math.min(100, (dayShare * 0.4 + reportShare * 0.35 + reviewShare * 0.25) * 100),
  );
}
