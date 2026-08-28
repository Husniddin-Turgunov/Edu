import type { KnowledgeProfile } from "@/lib/scoring";

export const ENTRANCE_TEST_QUESTION_COUNT = 15;
export const ENTRANCE_TEST_DURATION_MINUTES = 25;

export type EntranceQuestionSection = "basic" | "situation" | "advanced";

export type EntranceTestTelemetry = {
  answerChanges: number;
  pageExits: number;
  timedOut: boolean;
  userAgent?: string;
  attemptNumber?: number;
  durationSeconds?: number;
};

export type EntranceTestProfile = KnowledgeProfile & {
  entranceLevel: string;
  recommendation: string;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  weakTopics: string[];
  telemetry: EntranceTestTelemetry;
  verifixSummary: string;
};

export function entranceLevelForScore(score: number) {
  if (score >= 90) {
    return {
      code: "strong",
      label: "Сильный кандидат",
      confirmation: "Знания подтверждены.",
      recommendation: "Рекомендован к следующему этапу.",
    };
  }
  if (score >= 75) {
    return {
      code: "middle",
      label: "Middle",
      confirmation: "Знания подтверждены.",
      recommendation: "Допустить к 5-дневному пробному периоду.",
    };
  }
  if (score >= 60) {
    return {
      code: "junior",
      label: "Junior",
      confirmation: "Знания подтверждены частично.",
      recommendation: "Допустить к 5-дневному пробному периоду.",
    };
  }
  if (score >= 40) {
    return {
      code: "intern",
      label: "Слабый уровень, возможен стажёром",
      confirmation: "Знания подтверждены частично.",
      recommendation: "Рассмотреть стажировку с усиленным обучением.",
    };
  }
  return {
    code: "not_confirmed",
    label: "Знания не подтверждены",
    confirmation: "Знания не подтверждены.",
    recommendation: "Не допускать к пробному периоду без повторной подготовки.",
  };
}

export function entranceSection(
  value: string | null | undefined,
): EntranceQuestionSection {
  const normalized = String(value ?? "").toLowerCase();
  if (
    normalized.includes("advanced") ||
    normalized.includes("слож") ||
    normalized.includes("senior")
  ) {
    return "advanced";
  }
  if (
    normalized.includes("situation") ||
    normalized.includes("ситуац") ||
    normalized.includes("case")
  ) {
    return "situation";
  }
  return "basic";
}

export function selectEntranceQuestions<T extends { difficulty?: string | null }>(
  questions: T[],
  seed = 0,
  count = ENTRANCE_TEST_QUESTION_COUNT,
  randomOrder = true,
): T[] {
  const perSection = Math.max(1, Math.floor(count / 3));
  const selected: T[] = [];
  const used = new Set<T>();
  const rotate = (pool: T[]) => {
    if (!pool.length || !randomOrder) return [...pool];
    const offset = seed % pool.length;
    return [...pool.slice(offset), ...pool.slice(0, offset)];
  };
  for (const section of ["basic", "situation", "advanced"] as const) {
    const pool = questions.filter(
      (question) => entranceSection(question.difficulty) === section,
    );
    const rotated = rotate(pool);
    for (const question of rotated) {
      selected.push(question);
      used.add(question);
      if (
        selected.filter(
          (item) => entranceSection(item.difficulty) === section,
        ).length === perSection
      ) break;
    }
  }
  const fallback = rotate(questions);
  for (const question of fallback) {
    if (selected.length >= count) break;
    if (!used.has(question)) selected.push(question);
  }
  return selected.slice(0, count);
}
